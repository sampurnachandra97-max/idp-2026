"""Agronomic interpretation bands for soil indicators.

Thresholds follow the fertility ratings commonly used on Indian soil health
cards (available N/P/K in kg/ha, organic carbon in %, EC in dS/m, and sulphur
and micronutrients in mg/kg). Local extension guidance should take precedence.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import inf


@dataclass(frozen=True)
class Band:
    upper: float
    label: str
    level: str  # "ok", "watch" or "act"


@dataclass(frozen=True)
class Indicator:
    key: str
    name: str
    unit: str
    scale: tuple[float, float]
    bands: tuple[Band, ...]
    action: str

    def band_for(self, value: float) -> Band:
        return next(band for band in self.bands if value < band.upper)


def _deficiency(limit: float) -> tuple[Band, ...]:
    return (Band(limit, "Deficient", "act"), Band(inf, "Adequate", "ok"))


def _fertility(low: float, high: float) -> tuple[Band, ...]:
    return (Band(low, "Low", "act"), Band(high, "Medium", "ok"), Band(inf, "High", "ok"))


INDICATORS: dict[str, Indicator] = {
    item.key: item
    for item in (
        Indicator(
            "pH", "Soil pH", "", (4, 10),
            (
                Band(5.5, "Strongly acidic", "act"),
                Band(6.5, "Slightly acidic", "watch"),
                Band(7.5, "Neutral", "ok"),
                Band(8.5, "Alkaline", "watch"),
                Band(inf, "Strongly alkaline", "act"),
            ),
            "Correct pH first: lime acidic soil, or use gypsum and organic matter on alkaline soil.",
        ),
        Indicator(
            "EC", "Electrical conductivity", "dS/m", (0, 3),
            (
                Band(1, "Normal", "ok"),
                Band(2, "Elevated", "watch"),
                Band(inf, "Saline", "act"),
            ),
            "Improve drainage, leach with good-quality water, and favour salt-tolerant crops.",
        ),
        Indicator(
            "N", "Available nitrogen", "kg/ha", (0, 700), _fertility(280, 560),
            "Split nitrogen across growth stages and add a legume or compost to the rotation.",
        ),
        Indicator(
            "P", "Available phosphorus", "kg/ha", (0, 40), _fertility(10, 25),
            "Band phosphorus near the root zone at sowing rather than broadcasting it.",
        ),
        Indicator(
            "K", "Available potassium", "kg/ha", (0, 400), _fertility(110, 280),
            "Apply potash before the peak demand stage and return crop residue to the field.",
        ),
        Indicator(
            "OC", "Organic carbon", "%", (0, 1.2), _fertility(0.5, 0.75),
            "Build organic matter with farmyard manure, cover crops and residue retention.",
        ),
        Indicator(
            "S", "Sulphur", "mg/kg", (0, 30), _deficiency(10),
            "Use a sulphur-bearing fertiliser such as gypsum or single superphosphate.",
        ),
        Indicator(
            "Zn", "Zinc", "mg/kg", (0, 2.5), _deficiency(0.6),
            "Apply zinc sulphate to the soil, or as a foliar spray once symptoms appear.",
        ),
        Indicator(
            "B", "Boron", "mg/kg", (0, 2), _deficiency(0.5),
            "Apply borax at a low rate; the margin between deficiency and toxicity is narrow.",
        ),
        Indicator(
            "Fe", "Iron", "mg/kg", (0, 15), _deficiency(4.5),
            "Use a foliar iron sulphate spray; soil-applied iron locks up quickly at high pH.",
        ),
        Indicator(
            "Mn", "Manganese", "mg/kg", (0, 6), _deficiency(2),
            "Use a foliar manganese sulphate spray during early growth.",
        ),
        Indicator(
            "Cu", "Copper", "mg/kg", (0, 1.5), _deficiency(0.2),
            "Apply copper sulphate at a low rate and retest before repeating it.",
        ),
    )
}
