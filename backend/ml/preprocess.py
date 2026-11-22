"""Data preprocessing pipeline for Soil Intelligence datasets.

Handles:
- Column normalization and type casting
- Detection and removal of corrupt / impossible agronomic values
- Missing value verification
- Statistical summary and export of cleaned data
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

SOIL_FEATURES = ["pH", "EC", "N", "P", "K"]
SOIL_TARGETS = ["OC", "S", "Zn", "B", "Fe", "Mn", "Cu"]
ALL_NUTRIENTS = ["N", "P", "K", "pH", "EC", "OC", "S", "Zn", "Fe", "Cu", "Mn", "B"]

FERTILITY_MAP = {
    0: "Low Fertility",
    1: "Fertile",
    2: "High Fertility"
}


def preprocess_soil_dataset(
    source_path: Path = DOCS_RAW,
    output_dir: Path = DATA_CLEAN
) -> tuple[pd.DataFrame, dict]:
    """Load raw dataset1.csv, validate and clean agronomic anomalies."""
    if not source_path.exists():
        raise FileNotFoundError(f"Source dataset not found at {source_path}")

    output_dir.mkdir(parents=True, exist_ok=True)
    DATA_RAW.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(source_path)
    df.columns = df.columns.str.strip()

    initial_count = len(df)
    missing_summary = df.isna().sum().to_dict()

    # Agronomic boundary checks:
    # 1. Soil pH: Natural agricultural soil pH ranges from 3.5 to 11.0 (pH 0.9 is battery acid level typo).
    # 2. Organic Carbon (OC): Mineral soils range 0.05% - 5.0% (OC 24.0% is a typo for 0.24%).
    # 3. Micronutrients Zn, Fe: Standard lab values are 0.1 - 10 mg/kg Zn and 0.5 - 25 mg/kg Fe (Zn 42/38 and Fe 44/34 are typos).
    valid_mask = (
        (df["pH"] >= 3.5) & (df["pH"] <= 12.0) &
        (df["OC"] >= 0.0) & (df["OC"] <= 5.0) &
        (df["Zn"] >= 0.0) & (df["Zn"] <= 10.0) &
        (df["Fe"] >= 0.0) & (df["Fe"] <= 25.0) &
        (df["EC"] >= 0.0) & (df["EC"] <= 5.0)
    )

    anomalies = df[~valid_mask].copy()
    cleaned = df[valid_mask].reset_index(drop=True)

    # Add fertility label column for clarity
    cleaned["Fertility_Label"] = cleaned["Output"].map(FERTILITY_MAP)

    # Save to clean directory and copy to raw for version control
    clean_csv_path = output_dir / "soil_fertility_clean.csv"
    raw_copy_path = DATA_RAW / "dataset1.csv"
    
    cleaned.to_csv(clean_csv_path, index=False)
    cleaned.to_csv(raw_copy_path, index=False)

    report = {
        "initial_rows": initial_count,
        "cleaned_rows": len(cleaned),
        "anomalies_removed": len(anomalies),
        "removed_indices": anomalies.index.tolist(),
        "missing_values": missing_summary,
        "features": SOIL_FEATURES,
        "targets": SOIL_TARGETS,
        "class_distribution": cleaned["Output"].value_counts().to_dict(),
        "class_labels": FERTILITY_MAP,
        "clean_file": str(clean_csv_path),
    }

    report_path = output_dir / "preprocessing_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    return cleaned, report


if __name__ == "__main__":
    cleaned, report = preprocess_soil_dataset()
    print("=== PREPROCESSING COMPLETE ===")
    print(f"Initial Samples: {report['initial_rows']}")
    print(f"Cleaned Samples: {report['cleaned_rows']}")
    print(f"Removed Anomalies: {report['anomalies_removed']}")
    print(f"Class Distribution: {report['class_distribution']}")
    print(f"Saved to: {report['clean_file']}")
