# Machine Learning Pipeline Architecture

This directory contains the machine learning training, preprocessing, and evaluation pipelines for the Soil Intelligence platform.

## Model Families

The system trains and serves three distinct machine learning model families:

### 1. AgriNet Soil Property Regressors (`soil`)
- **Objective:** Predicts seven costlier micronutrients and chemical properties from routine soil test parameters (`pH`, `EC`, `N`, `P`, `K`).
- **Target Indicators:**
  - Organic Carbon (`OC`, %) — Model: Random Forest ($R^2 \approx 0.910$)
  - Manganese (`Mn`, mg/kg) — Model: Random Forest ($R^2 \approx 0.930$)
  - Iron (`Fe`, mg/kg) — Model: Random Forest ($R^2 \approx 0.886$)
  - Copper (`Cu`, mg/kg) — Model: XGBoost ($R^2 \approx 0.856$)
  - Boron (`B`, mg/kg) — Model: Random Forest ($R^2 \approx 0.734$)
  - Zinc (`Zn`, mg/kg) — Model: Random Forest ($R^2 \approx 0.726$)
  - Sulphur (`S`, mg/kg) — Model: Random Forest ($R^2 \approx 0.554$)
- **Validation:** 5-fold `GroupKFold` across field groupings to ensure strict zero-leakage evaluation between contiguous land plots.

### 2. Soil Fertility Tier Classifier (`fertility`)
- **Objective:** Classifies soil into discrete agronomic fertility tiers:
  - `0`: **Low Fertility** (critical macronutrient depletion, requires remediation)
  - `1`: **Fertile** (balanced nutrient reserve for standard staple crops)
  - `2`: **High Fertility** (optimal nutrient availability for high-demand horticulture)
- **Dataset:** 876 quality-verified soil samples from Indian agricultural zones (`soil_fertility_clean.csv`).
- **Features Used:** `N`, `P`, `K`, `pH`, `EC`, `OC`, `S`, `Zn`, `Fe`, `Cu`, `Mn`, `B` (measured directly or estimated via AgriNet regressors).
- **Candidate Models & Evaluation:**
  - Random Forest Classifier (500 estimators, max depth 12)
  - Extra Trees Classifier (500 estimators, max depth 14)
  - XGBoost Classifier (350 estimators, learning rate 0.04)
  - Soft Voting Ensemble (RF + ExtraTrees + XGBoost)
- **Validation:** 5-fold Stratified Cross-Validation (`StratifiedKFold`), achieving **90.4% CV accuracy** and **89.2% held-out test accuracy**.

### 3. Crop Recommendation Classifier (`crop`)
- **Objective:** Evaluates staple and cash crop suitability across 22 crop varieties based on climate parameters and soil reaction (`temperature`, `humidity`, `pH`, `rainfall`).
- **Selected Model:** Random Forest Classifier.
- **Performance:** **96.4% test accuracy** and **100% top-3 accuracy**.

---

## Agronomic Crop Suitability Thresholds

In addition to statistical multi-class ranking, individual suitability is evaluated per sample for **5 millets** and **6 vegetables** based on standard Indian Council of Agricultural Research (ICAR) and FAO guidelines:

### Millets (Coarse Cereals / Arid Crops)
1. **Pearl Millet (Bajra):** pH 6.5–8.5, EC $\le$ 1.5 dS/m, N $\ge$ 100 kg/ha, P $\ge$ 5.0 kg/ha, K $\ge$ 100 kg/ha
2. **Sorghum (Jowar):** pH 6.5–8.6, EC $\le$ 1.5 dS/m, N $\ge$ 150 kg/ha, P $\ge$ 7.0 kg/ha, K $\ge$ 120 kg/ha
3. **Finger Millet (Ragi):** pH 6.0–7.8, EC $\le$ 1.0 dS/m, N $\ge$ 120 kg/ha, P $\ge$ 6.5 kg/ha, K $\ge$ 100 kg/ha
4. **Foxtail Millet (Kangni):** pH 6.2–8.2, EC $\le$ 1.2 dS/m, N $\ge$ 80 kg/ha, K $\ge$ 80 kg/ha
5. **Barnyard Millet (Sanwa):** pH 6.0–8.5, EC $\le$ 1.2 dS/m, K $\ge$ 60 kg/ha

### Vegetables (Horticultural Crops)
1. **Tomato:** pH 6.5–7.8, EC $\le$ 1.0 dS/m, N $\ge$ 180 kg/ha, P $\ge$ 7.5 kg/ha, K $\ge$ 180 kg/ha, OC $\ge$ 0.35%
2. **Onion:** pH 6.5–7.8, EC $\le$ 0.8 dS/m, N $\ge$ 160 kg/ha, P $\ge$ 7.0 kg/ha, K $\ge$ 150 kg/ha, S $\ge$ 5.0 mg/kg
3. **Brinjal (Eggplant):** pH 6.5–8.0, EC $\le$ 1.0 dS/m, N $\ge$ 170 kg/ha, P $\ge$ 6.5 kg/ha, K $\ge$ 140 kg/ha
4. **Okra (Ladyfinger):** pH 6.5–8.2, EC $\le$ 1.0 dS/m, N $\ge$ 150 kg/ha, P $\ge$ 6.0 kg/ha, K $\ge$ 120 kg/ha
5. **Spinach:** pH 6.5–7.8, EC $\le$ 1.0 dS/m, N $\ge$ 220 kg/ha, Fe $\ge$ 2.0 mg/kg
6. **Cabbage:** pH 6.5–7.8, EC $\le$ 1.0 dS/m, N $\ge$ 200 kg/ha, P $\ge$ 7.5 kg/ha, K $\ge$ 180 kg/ha, B $\ge$ 0.25 mg/kg

---

## Directory Layout

```
backend/ml/
├── preprocess.py       # Data validation, cleaning, anomaly removal & crop suitability enrichment
├── train.py            # Model training orchestrator, cross-validation & artifact bundling
├── README.md           # Pipeline documentation and methodology
└── docs/               # Technical notes & validation reports
```

## Running Pipeline Tasks

```bash
# Preprocess the soil dataset and generate suitability matrices:
python -m ml.preprocess

# Train all three model families and export joblib/json artifacts:
python -m ml.train
```
