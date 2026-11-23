# Project Documentation & Artifacts

This directory contains the documentation, research methodology papers, and data assets for the **Web-Based System for Soil Property Analysis Using Machine Learning Techniques** (Interdisciplinary Design Project 2026).

## Directory Structure

```
docs/
├── reports/
│   ├── research_methodology.tex     # Complete LaTeX research methodology report
│   └── research_methodology.pdf     # Published PDF document with author roster
├── datasets/
│   ├── soil_fertility_raw.csv       # Raw soil fertility dataset (880 samples, 12 features)
│   └── soil_fertility_with_crop_suitability.csv # Cleaned & enriched dataset (876 samples, 31 columns)
├── assets/
│   ├── landing.png                  # Landing page interface preview
│   └── dashboard.png                # Live dashboard analysis interface preview
├── DOCUMENTATION.md                 # Full system architecture, installation, & API reference
└── README.md                        # Documentation directory index
```

## Highlights

1. **Research Methodology Report (`reports/research_methodology.pdf`):**
   - Prepared by Sampurna Chandra and project contributors.
   - Comprehensive sections covering Problem Statement, Related Work, Machine Learning Pipeline, Agronomic Crop Suitability Modeling, and System Architecture.

2. **Crop Suitability Enriched Dataset (`datasets/soil_fertility_with_crop_suitability.csv`):**
   - 876 quality-audited soil samples.
   - 11 individual crop evaluation columns (Pearl Millet, Sorghum, Finger Millet, Foxtail Millet, Barnyard Millet, Tomato, Onion, Brinjal, Okra, Spinach, Cabbage).
   - Summary recommendation indicators and counts.

3. **System Documentation (`DOCUMENTATION.md`):**
   - Complete guides for setting up the FastAPI backend, Next.js dashboard, running test suites, and utilizing the batch CSV analysis endpoint.
