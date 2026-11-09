"""Train and evaluate every Soil Intelligence model.

Run from ``backend/``:  python -m ml.train

Two model families are produced:

* Soil property regressors, trained on AgriNet lab reports. They estimate
  costlier lab measurements from a routine pH / EC / N / P / K test.
* A crop suitability classifier, trained on the Crop Recommendation benchmark
  using climate and pH only. That dataset's N, P and K columns are unitless
  ratios that are not comparable to lab results in kg/ha, so they are excluded.

AgriNet contains runs of near-identical consecutive samples, which are repeat
readings of one field. Those runs are kept together when splitting: a random
split would put the same field on both sides and overstate accuracy.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    r2_score,
    root_mean_squared_error,
)
from sklearn.model_selection import (
    GroupKFold,
    GroupShuffleSplit,
    KFold,
    StratifiedKFold,
    cross_val_predict,
    train_test_split,
)
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from xgboost import XGBClassifier, XGBRegressor

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
ARTIFACTS = ROOT / "artifacts"
SEED = 42

SOIL_FEATURES = ["pH", "EC", "N", "P", "K"]
SOIL_TARGETS = ["OC", "S", "Zn", "B", "Fe", "Mn", "Cu"]
CROP_FEATURES = ["temperature", "humidity", "ph", "rainfall"]
# Standardised distance between consecutive samples. Observed gaps are bimodal
# (repeat readings below 0.5, separate fields above 1.0), so 0.7 sits in the gap.
FIELD_BREAK_DISTANCE = 0.7
INTERVAL_COVERAGE = 0.90


def regressors() -> dict[str, object]:
    return {
        "Ridge regression": make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
        "Random Forest": RandomForestRegressor(
            n_estimators=400, min_samples_leaf=2, random_state=SEED, n_jobs=-1
        ),
        "XGBoost": XGBRegressor(
            n_estimators=300,
            learning_rate=0.05,
            max_depth=3,
            subsample=0.8,
            colsample_bytree=0.9,
            random_state=SEED,
            n_jobs=-1,
        ),
    }


def classifiers() -> dict[str, object]:
    return {
        "Logistic regression": make_pipeline(
            StandardScaler(), LogisticRegression(max_iter=2000)
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=400, random_state=SEED, n_jobs=-1
        ),
        "XGBoost": XGBClassifier(
            n_estimators=300,
            learning_rate=0.1,
            max_depth=4,
            subsample=0.9,
            random_state=SEED,
            n_jobs=-1,
        ),
    }


def load_soil() -> pd.DataFrame:
    frame = pd.read_csv(RAW / "agrinet_soil_tests.csv", encoding="latin1")
    frame.columns = frame.columns.str.strip()
    return frame.dropna(subset=SOIL_FEATURES + SOIL_TARGETS).reset_index(drop=True)


def infer_field_groups(frame: pd.DataFrame) -> np.ndarray:
    """Give consecutive near-identical samples one shared field id."""
    columns = SOIL_FEATURES + SOIL_TARGETS
    scaled = ((frame[columns] - frame[columns].mean()) / frame[columns].std()).to_numpy()
    distance = np.sqrt(((scaled[1:] - scaled[:-1]) ** 2).mean(axis=1))
    return np.r_[0, (distance > FIELD_BREAK_DISTANCE).cumsum()]


def reliability(r2: float) -> str:
    if r2 >= 0.7:
        return "high"
    if r2 >= 0.4:
        return "moderate"
    return "low"


def regression_metrics(y_true, y_pred) -> dict[str, float]:
    return {
        "r2": float(r2_score(y_true, y_pred)),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(root_mean_squared_error(y_true, y_pred)),
    }


def train_soil_models(frame: pd.DataFrame) -> tuple[dict, dict]:
    groups = infer_field_groups(frame)
    features = frame[SOIL_FEATURES]
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
    train_idx, test_idx = next(splitter.split(features, groups=groups))
    x_train, x_test = features.iloc[train_idx], features.iloc[test_idx]
    train_groups = groups[train_idx]
    fitted, report = {}, []

    for target in SOIL_TARGETS:
        y_train, y_test = frame[target].iloc[train_idx], frame[target].iloc[test_idx]
        candidates = []
        for name, model in regressors().items():
            oof = cross_val_predict(
                model, x_train, y_train, cv=GroupKFold(n_splits=5), groups=train_groups
            )
            candidates.append(
                {"model": name, "cv": regression_metrics(y_train, oof), "oof": oof}
            )
        best = min(candidates, key=lambda item: item["cv"]["rmse"])

        evaluated = clone(regressors()[best["model"]]).fit(x_train, y_train)
        baseline = DummyRegressor().fit(x_train, y_train)
        predictions = evaluated.predict(x_test)
        # The width of the 90% band comes from out-of-fold errors on unseen fields.
        half_width = float(np.quantile(np.abs(y_train - best["oof"]), INTERVAL_COVERAGE))
        test = regression_metrics(y_test, predictions)

        random_split = cross_val_predict(
            clone(regressors()[best["model"]]),
            features,
            frame[target],
            cv=KFold(n_splits=5, shuffle=True, random_state=SEED),
        )

        report.append(
            {
                "target": target,
                "selected_model": best["model"],
                "test": test,
                "baseline_mae": float(mean_absolute_error(y_test, baseline.predict(x_test))),
                "cv_by_model": {item["model"]: item["cv"] for item in candidates},
                "interval_half_width": half_width,
                "interval_test_coverage": float((np.abs(y_test - predictions) <= half_width).mean()),
                "random_split_r2": float(r2_score(frame[target], random_split)),
                "reliability": reliability(test["r2"]),
            }
        )
        # After evaluation, the serving model is refit on every available field.
        fitted[target] = clone(regressors()[best["model"]]).fit(features, frame[target])

    summary = {
        "samples": len(frame),
        "fields": int(len(np.unique(groups))),
        "test_samples": len(test_idx),
        "test_fields": int(len(np.unique(groups[test_idx]))),
        "features": SOIL_FEATURES,
        "targets": report,
        "feature_ranges": {
            column: [float(frame[column].min()), float(frame[column].max())]
            for column in SOIL_FEATURES
        },
    }
    return fitted, summary


def train_crop_model(frame: pd.DataFrame) -> tuple[dict, dict]:
    encoder = LabelEncoder()
    labels = encoder.fit_transform(frame["label"])
    features = frame[CROP_FEATURES]
    x_train, x_test, y_train, y_test = train_test_split(
        features, labels, test_size=0.2, stratify=labels, random_state=SEED
    )
    folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)

    candidates = {}
    for name, model in classifiers().items():
        oof = cross_val_predict(model, x_train, y_train, cv=folds)
        candidates[name] = {
            "accuracy": float(accuracy_score(y_train, oof)),
            "macro_f1": float(f1_score(y_train, oof, average="macro")),
        }
    best = max(candidates, key=lambda name: candidates[name]["macro_f1"])
    evaluated = clone(classifiers()[best]).fit(x_train, y_train)
    predicted = evaluated.predict(x_test)
    top3 = np.argsort(evaluated.predict_proba(x_test), axis=1)[:, -3:]

    summary = {
        "samples": len(frame),
        "crops": len(encoder.classes_),
        "features": CROP_FEATURES,
        "selected_model": best,
        "test": {
            "accuracy": float(accuracy_score(y_test, predicted)),
            "macro_f1": float(f1_score(y_test, predicted, average="macro")),
            "top3_accuracy": float(np.mean([truth in row for truth, row in zip(y_test, top3)])),
        },
        "cv_by_model": candidates,
        "feature_ranges": {
            column: [float(frame[column].min()), float(frame[column].max())]
            for column in CROP_FEATURES
        },
    }
    final = clone(classifiers()[best]).fit(features, labels)
    return {"model": final, "classes": encoder.classes_.tolist()}, summary


def main() -> None:
    ARTIFACTS.mkdir(exist_ok=True)
    soil_models, soil_summary = train_soil_models(load_soil())
    crop_bundle, crop_summary = train_crop_model(
        pd.read_csv(RAW / "crop_recommendation.csv")
    )
    joblib.dump({"soil": soil_models, "crop": crop_bundle}, ARTIFACTS / "models.joblib")
    card = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "soil": soil_summary,
        "crop": crop_summary,
    }
    (ARTIFACTS / "metrics.json").write_text(json.dumps(card, indent=2), encoding="utf-8")

    print(f"Soil: {soil_summary['samples']} samples, {soil_summary['fields']} fields")
    for row in soil_summary["targets"]:
        print(
            f"  {row['target']:>2}  {row['selected_model']:<17} R2 {row['test']['r2']:6.3f}"
            f"  random-split R2 {row['random_split_r2']:6.3f}"
            f"  MAE {row['test']['mae']:.3f} (baseline {row['baseline_mae']:.3f})"
            f"  90% cover {row['interval_test_coverage']:.0%}  {row['reliability']}"
        )
    print(f"Crop: {crop_summary['selected_model']} {crop_summary['test']}")
    print({k: round(v["macro_f1"], 3) for k, v in crop_summary["cv_by_model"].items()})


if __name__ == "__main__":
    main()
