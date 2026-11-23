"""Data preprocessing and agronomic crop suitability pipeline.

Handles:
- Column normalization and type casting
- Detection and removal of corrupt / impossible agronomic values
- Missing value verification
- Sample-by-sample suitability evaluation for millets and vegetables
- Statistical summary and export of cleaned, enriched data
"""

from __future__ import annotations

import json
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DOCS_RAW = Path(r"e:\idp_sampurna\docs\dataset1.csv")
DATA_RAW = ROOT / "data" / "raw"
DATA_CLEAN = ROOT / "data" / "clean"
DOCS_DIR = ROOT.parent / "docs"

SOIL_FEATURES = ["pH", "EC", "N", "P", "K"]
SOIL_TARGETS = ["OC", "S", "Zn", "B", "Fe", "Mn", "Cu"]
ALL_NUTRIENTS = ["N", "P", "K", "pH", "EC", "OC", "S", "Zn", "Fe", "Cu", "Mn", "B"]

FERTILITY_MAP = {
    0: "Low Fertility",
    1: "Fertile",
    2: "High Fertility"
}


def evaluate_crop_suitability(row: pd.Series) -> dict:
    """Evaluate agronomic suitability for millets and vegetables for a single soil sample.
    
    Thresholds follow ICAR / FAO and Indian Soil Health Card agronomic recommendations:
    - Millets: C4 hardy crops, high drought and alkaline tolerance, low to moderate NPK requirement.
    - Vegetables: Higher nutrient demand, strict salinity sensitivity (EC < 1.0), and micronutrient dependencies.
    """
    ph = float(row["pH"])
    ec = float(row["EC"])
    n = float(row["N"])
    p = float(row["P"])
    k = float(row["K"])
    oc = float(row["OC"])
    s = float(row["S"])
    b = float(row["B"])
    fe = float(row["Fe"])

    # --- MILLETS SUITABILITY ---
    # 1. Pearl Millet / Bajra: Warm, semi-arid, neutral to alkaline, low-medium NPK
    bajra = bool((6.5 <= ph <= 8.5) and (ec <= 1.5) and (n >= 100) and (p >= 5.0) and (k >= 100))

    # 2. Sorghum / Jowar: Resilient in alkaline & clay soils, moderate NPK demand
    jowar = bool((6.5 <= ph <= 8.6) and (ec <= 1.5) and (n >= 150) and (p >= 7.0) and (k >= 120))

    # 3. Finger Millet / Ragi: Prefers neutral to slight alkalinity, good calcium/loam
    ragi = bool((6.0 <= ph <= 7.8) and (ec <= 1.0) and (n >= 120) and (p >= 6.5) and (k >= 100))

    # 4. Foxtail Millet / Kangni: Highly drought-hardy, low input demand
    foxtail = bool((6.2 <= ph <= 8.2) and (ec <= 1.2) and (n >= 80) and (k >= 80))

    # 5. Barnyard Millet / Sanwa: Fastest growing, excels in poor/marginal soils
    barnyard = bool((6.0 <= ph <= 8.5) and (ec <= 1.2) and (k >= 60))

    # --- VEGETABLES SUITABILITY ---
    # 1. Tomato: Sensitive to high salinity (EC < 1.0), needs phosphorus for flowering & boron for fruit set
    tomato = bool((6.5 <= ph <= 7.8) and (ec <= 1.0) and (n >= 180) and (p >= 7.5) and (k >= 180) and (oc >= 0.35))

    # 2. Onion: Shallow root system (EC <= 0.8), high sulphur requirement for pungency and bulb quality
    onion = bool((6.5 <= ph <= 7.8) and (ec <= 0.8) and (n >= 160) and (p >= 7.0) and (k >= 150) and (s >= 5.0))

    # 3. Brinjal (Eggplant): Wide adaptation among vegetables, moderate fertility
    brinjal = bool((6.5 <= ph <= 8.0) and (ec <= 1.0) and (n >= 170) and (p >= 6.5) and (k >= 140))

    # 4. Okra (Bhindi): High alkali tolerance, well-suited for warm subtropical soils
    okra = bool((6.5 <= ph <= 8.2) and (ec <= 1.0) and (n >= 150) and (p >= 6.0) and (k >= 120))

    # 5. Spinach: High nitrogen and iron requirements for lush vegetative leaf growth
    spinach = bool((6.5 <= ph <= 7.8) and (ec <= 1.0) and (n >= 220) and (fe >= 2.0))

    # 6. Cabbage / Cauliflower: High nutrient feeder, requires boron to prevent hollow stem/browning
    cabbage = bool((6.5 <= ph <= 7.8) and (ec <= 1.0) and (n >= 200) and (p >= 7.5) and (k >= 180) and (b >= 0.25))

    # Compile suitable names
    suitable_millets = []
    if bajra: suitable_millets.append("Pearl Millet (Bajra)")
    if jowar: suitable_millets.append("Sorghum (Jowar)")
    if ragi: suitable_millets.append("Finger Millet (Ragi)")
    if foxtail: suitable_millets.append("Foxtail Millet (Kangni)")
    if barnyard: suitable_millets.append("Barnyard Millet (Sanwa)")

    suitable_veggies = []
    if tomato: suitable_veggies.append("Tomato")
    if onion: suitable_veggies.append("Onion")
    if brinjal: suitable_veggies.append("Brinjal")
    if okra: suitable_veggies.append("Okra")
    if spinach: suitable_veggies.append("Spinach")
    if cabbage: suitable_veggies.append("Cabbage")

    top_millet = suitable_millets[0] if suitable_millets else "None (Requires soil remediation)"
    top_veggie = suitable_veggies[0] if suitable_veggies else "None (Requires NPK/organic matter enhancement)"

    return {
        "Millet_Bajra": "Yes" if bajra else "No",
        "Millet_Jowar": "Yes" if jowar else "No",
        "Millet_Ragi": "Yes" if ragi else "No",
        "Millet_Foxtail": "Yes" if foxtail else "No",
        "Millet_Barnyard": "Yes" if barnyard else "No",
        "Veg_Tomato": "Yes" if tomato else "No",
        "Veg_Onion": "Yes" if onion else "No",
        "Veg_Brinjal": "Yes" if brinjal else "No",
        "Veg_Okra": "Yes" if okra else "No",
        "Veg_Spinach": "Yes" if spinach else "No",
        "Veg_Cabbage": "Yes" if cabbage else "No",
        "Suitable_Millets": ", ".join(suitable_millets) if suitable_millets else "None",
        "Suitable_Vegetables": ", ".join(suitable_veggies) if suitable_veggies else "None",
        "Top_Millet": top_millet,
        "Top_Vegetable": top_veggie,
        "Millet_Count": len(suitable_millets),
        "Vegetable_Count": len(suitable_veggies),
    }


def preprocess_soil_dataset(
    source_path: Path = DOCS_RAW,
    output_dir: Path = DATA_CLEAN
) -> tuple[pd.DataFrame, dict]:
    """Load raw dataset1.csv, clean anomalies, and compute individual crop suitability."""
    if not source_path.exists():
        raise FileNotFoundError(f"Source dataset not found at {source_path}")

    output_dir.mkdir(parents=True, exist_ok=True)
    DATA_RAW.mkdir(parents=True, exist_ok=True)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(source_path)
    df.columns = df.columns.str.strip()

    initial_count = len(df)
    missing_summary = df.isna().sum().to_dict()

    # Agronomic boundary checks
    valid_mask = (
        (df["pH"] >= 3.5) & (df["pH"] <= 12.0) &
        (df["OC"] >= 0.0) & (df["OC"] <= 5.0) &
        (df["Zn"] >= 0.0) & (df["Zn"] <= 10.0) &
        (df["Fe"] >= 0.0) & (df["Fe"] <= 25.0) &
        (df["EC"] >= 0.0) & (df["EC"] <= 5.0)
    )

    anomalies = df[~valid_mask].copy()
    cleaned = df[valid_mask].reset_index(drop=True)

    # 1. Add human-readable fertility label
    cleaned["Fertility_Label"] = cleaned["Output"].map(FERTILITY_MAP)

    # 2. Add sample-by-sample suitability of millets and vegetables
    suitability_records = cleaned.apply(evaluate_crop_suitability, axis=1, result_type="expand")
    enriched = pd.concat([cleaned, suitability_records], axis=1)

    # Save to clean directory and documentation
    clean_csv_path = output_dir / "soil_fertility_clean.csv"
    clean_detailed_path = output_dir / "soil_fertility_with_crop_suitability.csv"
    docs_detailed_path = DOCS_DIR / "soil_fertility_with_crop_suitability.csv"
    raw_copy_path = DATA_RAW / "dataset1.csv"

    enriched.to_csv(clean_csv_path, index=False)
    enriched.to_csv(clean_detailed_path, index=False)
    enriched.to_csv(docs_detailed_path, index=False)
    cleaned.to_csv(raw_copy_path, index=False)

    millet_stats = {
        "Pearl Millet (Bajra)": int((enriched["Millet_Bajra"] == "Yes").sum()),
        "Sorghum (Jowar)": int((enriched["Millet_Jowar"] == "Yes").sum()),
        "Finger Millet (Ragi)": int((enriched["Millet_Ragi"] == "Yes").sum()),
        "Foxtail Millet (Kangni)": int((enriched["Millet_Foxtail"] == "Yes").sum()),
        "Barnyard Millet (Sanwa)": int((enriched["Millet_Barnyard"] == "Yes").sum()),
    }

    vegetable_stats = {
        "Tomato": int((enriched["Veg_Tomato"] == "Yes").sum()),
        "Onion": int((enriched["Veg_Onion"] == "Yes").sum()),
        "Brinjal": int((enriched["Veg_Brinjal"] == "Yes").sum()),
        "Okra": int((enriched["Veg_Okra"] == "Yes").sum()),
        "Spinach": int((enriched["Veg_Spinach"] == "Yes").sum()),
        "Cabbage": int((enriched["Veg_Cabbage"] == "Yes").sum()),
    }

    report = {
        "initial_rows": initial_count,
        "cleaned_rows": len(enriched),
        "anomalies_removed": len(anomalies),
        "removed_indices": anomalies.index.tolist(),
        "missing_values": missing_summary,
        "features": SOIL_FEATURES,
        "targets": SOIL_TARGETS,
        "class_distribution": cleaned["Output"].value_counts().to_dict(),
        "class_labels": FERTILITY_MAP,
        "millet_suitability_summary": millet_stats,
        "vegetable_suitability_summary": vegetable_stats,
        "clean_file": str(clean_csv_path),
        "detailed_file": str(clean_detailed_path),
    }

    report_path = output_dir / "preprocessing_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    return enriched, report


if __name__ == "__main__":
    enriched, report = preprocess_soil_dataset()
    print("=== PREPROCESSING & CROP SUITABILITY COMPLETE ===")
    print(f"Total Samples: {report['cleaned_rows']}")
    print("\nMillet Suitability Breakdown:")
    for crop, count in report["millet_suitability_summary"].items():
        print(f"  {crop:<25}: {count:>4} samples ({count/report['cleaned_rows']:.1%})")
    print("\nVegetable Suitability Breakdown:")
    for crop, count in report["vegetable_suitability_summary"].items():
        print(f"  {crop:<25}: {count:>4} samples ({count/report['cleaned_rows']:.1%})")
    print(f"\nFiles generated:")
    print(f"  Clean & Enriched: {report['clean_file']}")
    print(f"  Detailed View   : {report['detailed_file']}")
