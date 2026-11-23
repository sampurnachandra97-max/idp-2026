"""Turn a soil test into estimates, stress findings and ranked crops."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd

from app.rules import INDICATORS, Indicator

ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts"
SOIL_FEATURES = ["pH", "EC", "N", "P", "K"]
TOP_CROPS = 5
LEVEL_ORDER = {"act": 0, "watch": 1, "ok": 2}
CLOSE_TO_LIMIT = "Likely adequate but close to the limit. Get a lab result before treating it."


class ModelsNotTrained(RuntimeError):
    pass


def _reading(indicator: Indicator, value: float) -> dict:
    band = indicator.band_for(value)
    return {
        "key": indicator.key,
        "name": indicator.name,
        "unit": indicator.unit,
        "value": value,
        "status": band.label,
        "level": band.level,
        "scale": list(indicator.scale),
        "thresholds": [b.upper for b in indicator.bands[:-1]],
    }


class Engine:
    def __init__(self, artifacts: Path = ARTIFACTS) -> None:
        models, card = artifacts / "models.joblib", artifacts / "metrics.json"
        if not models.exists() or not card.exists():
            raise ModelsNotTrained("Model artifacts not found. Run: python -m ml.train")
        bundle = joblib.load(models)
        self.soil_models = bundle["soil"]
        self.fertility_bundle = bundle.get("fertility")
        self.crop_model = bundle["crop"]["model"]
        self.crop_classes = bundle["crop"]["classes"]
        self.card = json.loads(card.read_text(encoding="utf-8"))
        self.target_stats = {row["target"]: row for row in self.card["soil"]["targets"]}

    def _coverage_warnings(self, sample: dict) -> list[str]:
        warnings = []
        names = {"ph": "pH", "temperature": "Temperature", "humidity": "Humidity", "rainfall": "Rainfall"}
        ranges = {
            **self.card["soil"]["feature_ranges"],
            **{k: v for k, v in self.card["crop"]["feature_ranges"].items() if k != "ph"},
        }
        for key, (low, high) in ranges.items():
            if not low <= sample[key] <= high:
                warnings.append(
                    f"{names.get(key, key)} {sample[key]:g} is outside the training range "
                    f"{low:g}–{high:g}, so results that depend on it are less certain."
                )
        return warnings

    def _estimate(self, features: pd.DataFrame) -> list[dict]:
        estimates = []
        for target, model in self.soil_models.items():
            stats = self.target_stats[target]
            indicator = INDICATORS[target]
            value = max(float(model.predict(features)[0]), 0.0)
            low = max(value - stats["interval_half_width"], 0.0)
            high = value + stats["interval_half_width"]
            estimates.append(
                {
                    **_reading(indicator, value),
                    "low": low,
                    "high": high,
                    "borderline": indicator.band_for(low) != indicator.band_for(high),
                    "reliability": stats["reliability"],
                    "r2": stats["test"]["r2"],
                }
            )
        return estimates

    def _rank_crops(self, sample: dict) -> list[dict]:
        frame = pd.DataFrame(
            [
                {
                    "temperature": sample["temperature"],
                    "humidity": sample["humidity"],
                    "ph": sample["pH"],
                    "rainfall": sample["rainfall"],
                }
            ]
        )
        probabilities = self.crop_model.predict_proba(frame)[0]
        ranked = sorted(zip(self.crop_classes, probabilities), key=lambda p: p[1], reverse=True)
        return [{"crop": crop, "fit": float(fit)} for crop, fit in ranked[:TOP_CROPS]]

    @staticmethod
    def _actions(measured: list[dict], estimated: list[dict]) -> list[dict]:
        actions = []
        for source, readings in (("measured", measured), ("estimated", estimated)):
            for reading in readings:
                borderline = reading.get("borderline", False)
                if reading["level"] == "ok" and not borderline:
                    continue
                actions.append(
                    {
                        "key": reading["key"],
                        "name": reading["name"],
                        "status": reading["status"],
                        "level": reading["level"],
                        "source": source,
                        "confirm_first": source == "estimated"
                        and (borderline or reading["reliability"] == "low"),
                        "action": CLOSE_TO_LIMIT
                        if reading["level"] == "ok"
                        else INDICATORS[reading["key"]].action,
                    }
                )
        # Measured problems outrank estimates, and severe ones outrank mild ones.
        actions.sort(
            key=lambda a: (LEVEL_ORDER[a["level"]], a["confirm_first"], a["source"] != "measured")
        )
        return actions

    def _predict_fertility(self, features: pd.DataFrame) -> dict | None:
        if not self.fertility_bundle:
            return None
        model = self.fertility_bundle["model"]
        labels = self.fertility_bundle.get("labels", {})
        pred = int(model.predict(features)[0])
        probas = model.predict_proba(features)[0] if hasattr(model, "predict_proba") else None
        confidence = float(probas[pred]) if probas is not None else 1.0
        return {
            "class": pred,
            "label": labels.get(pred, str(pred)),
            "confidence": confidence,
        }

    def analyze(self, sample: dict) -> dict:
        features = pd.DataFrame([{key: sample[key] for key in SOIL_FEATURES}])
        measured = [_reading(INDICATORS[key], float(sample[key])) for key in SOIL_FEATURES]
        estimated = self._estimate(features)
        readings = measured + estimated
        result = {
            "summary": {
                "in_range": sum(r["level"] == "ok" for r in readings),
                "needs_action": sum(r["level"] == "act" for r in readings),
                "watch": sum(r["level"] == "watch" for r in readings),
                "total": len(readings),
            },
            "measured": measured,
            "estimated": estimated,
            "crops": self._rank_crops(sample),
            "actions": self._actions(measured, estimated),
            "warnings": self._coverage_warnings(sample),
        }
        fertility = self._predict_fertility(features)
        if fertility is not None:
            result["fertility"] = fertility

        # Evaluate millet and vegetable suitability
        nutrients = {r["key"]: r["value"] for r in readings}
        result["crop_suitability"] = {
            "millets": [
                crop for crop, suitable in [
                    ("Pearl Millet (Bajra)", (6.5 <= nutrients["pH"] <= 8.5) and (nutrients["EC"] <= 1.5) and (nutrients["N"] >= 100) and (nutrients["P"] >= 5.0) and (nutrients["K"] >= 100)),
                    ("Sorghum (Jowar)", (6.5 <= nutrients["pH"] <= 8.6) and (nutrients["EC"] <= 1.5) and (nutrients["N"] >= 150) and (nutrients["P"] >= 7.0) and (nutrients["K"] >= 120)),
                    ("Finger Millet (Ragi)", (6.0 <= nutrients["pH"] <= 7.8) and (nutrients["EC"] <= 1.0) and (nutrients["N"] >= 120) and (nutrients["P"] >= 6.5) and (nutrients["K"] >= 100)),
                    ("Foxtail Millet (Kangni)", (6.2 <= nutrients["pH"] <= 8.2) and (nutrients["EC"] <= 1.2) and (nutrients["N"] >= 80) and (nutrients["K"] >= 80)),
                    ("Barnyard Millet (Sanwa)", (6.0 <= nutrients["pH"] <= 8.5) and (nutrients["EC"] <= 1.2) and (nutrients["K"] >= 60)),
                ] if suitable
            ],
            "vegetables": [
                crop for crop, suitable in [
                    ("Tomato", (6.5 <= nutrients["pH"] <= 7.8) and (nutrients["EC"] <= 1.0) and (nutrients["N"] >= 180) and (nutrients["P"] >= 7.5) and (nutrients["K"] >= 180) and (nutrients["OC"] >= 0.35)),
                    ("Onion", (6.5 <= nutrients["pH"] <= 7.8) and (nutrients["EC"] <= 0.8) and (nutrients["N"] >= 160) and (nutrients["P"] >= 7.0) and (nutrients["K"] >= 150) and (nutrients["S"] >= 5.0)),
                    ("Brinjal", (6.5 <= nutrients["pH"] <= 8.0) and (nutrients["EC"] <= 1.0) and (nutrients["N"] >= 170) and (nutrients["P"] >= 6.5) and (nutrients["K"] >= 140)),
                    ("Okra", (6.5 <= nutrients["pH"] <= 8.2) and (nutrients["EC"] <= 1.0) and (nutrients["N"] >= 150) and (nutrients["P"] >= 6.0) and (nutrients["K"] >= 120)),
                    ("Spinach", (6.5 <= nutrients["pH"] <= 7.8) and (nutrients["EC"] <= 1.0) and (nutrients["N"] >= 220) and (nutrients["Fe"] >= 2.0)),
                    ("Cabbage", (6.5 <= nutrients["pH"] <= 7.8) and (nutrients["EC"] <= 1.0) and (nutrients["N"] >= 200) and (nutrients["P"] >= 7.5) and (nutrients["K"] >= 180) and (nutrients["B"] >= 0.25)),
                ] if suitable
            ],
        }
        return result
