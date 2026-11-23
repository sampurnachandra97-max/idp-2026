"use client";

import { Carrot, CircleAlert, CircleCheck, Sparkles, Wheat } from "lucide-react";
import type { Analysis, CropEvaluation, FertilityResult } from "@/lib/types";

const DEFAULT_MILLETS: CropEvaluation[] = [
  { name: "Pearl Millet (Bajra)", suitable: false, criteria: "pH 6.5–8.5, EC ≤ 1.5 dS/m, N ≥ 100, P ≥ 5.0, K ≥ 100 kg/ha" },
  { name: "Sorghum (Jowar)", suitable: false, criteria: "pH 6.5–8.6, EC ≤ 1.5 dS/m, N ≥ 150, P ≥ 7.0, K ≥ 120 kg/ha" },
  { name: "Finger Millet (Ragi)", suitable: false, criteria: "pH 6.0–7.8, EC ≤ 1.0 dS/m, N ≥ 120, P ≥ 6.5, K ≥ 100 kg/ha" },
  { name: "Foxtail Millet (Kangni)", suitable: false, criteria: "pH 6.2–8.2, EC ≤ 1.2 dS/m, N ≥ 80, K ≥ 80 kg/ha" },
  { name: "Barnyard Millet (Sanwa)", suitable: false, criteria: "pH 6.0–8.5, EC ≤ 1.2 dS/m, K ≥ 60 kg/ha" },
];

const DEFAULT_VEGETABLES: CropEvaluation[] = [
  { name: "Tomato", suitable: false, criteria: "pH 6.5–7.8, EC ≤ 1.0 dS/m, N ≥ 180, P ≥ 7.5, K ≥ 180, OC ≥ 0.35%" },
  { name: "Onion", suitable: false, criteria: "pH 6.5–7.8, EC ≤ 0.8 dS/m, N ≥ 160, P ≥ 7.0, K ≥ 150, S ≥ 5.0 mg/kg" },
  { name: "Brinjal", suitable: false, criteria: "pH 6.5–8.0, EC ≤ 1.0 dS/m, N ≥ 170, P ≥ 6.5, K ≥ 140 kg/ha" },
  { name: "Okra", suitable: false, criteria: "pH 6.5–8.2, EC ≤ 1.0 dS/m, N ≥ 150, P ≥ 6.0, K ≥ 120 kg/ha" },
  { name: "Spinach", suitable: false, criteria: "pH 6.5–7.8, EC ≤ 1.0 dS/m, N ≥ 220 kg/ha, Fe ≥ 2.0 mg/kg" },
  { name: "Cabbage", suitable: false, criteria: "pH 6.5–7.8, EC ≤ 1.0 dS/m, N ≥ 200, P ≥ 7.5, K ≥ 180, B ≥ 0.25 mg/kg" },
];

function evaluateCrop(name: string, nutrients: Record<string, number>): boolean {
  const pH = nutrients["pH"] ?? 7.0;
  const EC = nutrients["EC"] ?? 0.5;
  const N = nutrients["N"] ?? 0;
  const P = nutrients["P"] ?? 0;
  const K = nutrients["K"] ?? 0;
  const OC = nutrients["OC"] ?? 0.5;
  const S = nutrients["S"] ?? 10;
  const Fe = nutrients["Fe"] ?? 5;
  const B = nutrients["B"] ?? 0.5;

  switch (name) {
    case "Pearl Millet (Bajra)":
      return pH >= 6.5 && pH <= 8.5 && EC <= 1.5 && N >= 100 && P >= 5.0 && K >= 100;
    case "Sorghum (Jowar)":
      return pH >= 6.5 && pH <= 8.6 && EC <= 1.5 && N >= 150 && P >= 7.0 && K >= 120;
    case "Finger Millet (Ragi)":
      return pH >= 6.0 && pH <= 7.8 && EC <= 1.0 && N >= 120 && P >= 6.5 && K >= 100;
    case "Foxtail Millet (Kangni)":
      return pH >= 6.2 && pH <= 8.2 && EC <= 1.2 && N >= 80 && K >= 80;
    case "Barnyard Millet (Sanwa)":
      return pH >= 6.0 && pH <= 8.5 && EC <= 1.2 && K >= 60;
    case "Tomato":
      return pH >= 6.5 && pH <= 7.8 && EC <= 1.0 && N >= 180 && P >= 7.5 && K >= 180 && OC >= 0.35;
    case "Onion":
      return pH >= 6.5 && pH <= 7.8 && EC <= 0.8 && N >= 160 && P >= 7.0 && K >= 150 && S >= 5.0;
    case "Brinjal":
      return pH >= 6.5 && pH <= 8.0 && EC <= 1.0 && N >= 170 && P >= 6.5 && K >= 140;
    case "Okra":
      return pH >= 6.5 && pH <= 8.2 && EC <= 1.0 && N >= 150 && P >= 6.0 && K >= 120;
    case "Spinach":
      return pH >= 6.5 && pH <= 7.8 && EC <= 1.0 && N >= 220 && Fe >= 2.0;
    case "Cabbage":
      return pH >= 6.5 && pH <= 7.8 && EC <= 1.0 && N >= 200 && P >= 7.5 && K >= 180 && B >= 0.25;
    default:
      return false;
  }
}

export function FertilityBanner({ fertility }: { fertility?: FertilityResult }) {
  if (!fertility) return null;
  const percentConfidence = Math.round(fertility.confidence * 100);
  const isHigh = fertility.class === 2;
  const isFertile = fertility.class === 1;
  const tierClass = isHigh ? "tier-high" : isFertile ? "tier-fertile" : "tier-low";

  return (
    <div className={`fertility-banner card ${tierClass}`}>
      <div className="fertility-top">
        <div className="fertility-left">
          <span className="fertility-kicker">
            <Sparkles size={13} className="kicker-sparkle" />
            Machine Learning Soil Fertility Analysis
          </span>
          <h2 className="fertility-main-title">{fertility.label}</h2>
        </div>
        <div className="fertility-right">
          <div className="confidence-chip">
            <span className="confidence-dot" />
            <div className="confidence-content">
              <span className="confidence-val">{percentConfidence}% Confidence</span>
              <span className="confidence-lbl">Soft Voting Ensemble Model</span>
            </div>
          </div>
        </div>
      </div>
      <p className="fertility-narrative">
        {fertility.class === 0 &&
          "Low fertility classification: Baseline macronutrient reserve (N, P, K) or organic content is below optimal yield thresholds. Prioritize balanced NPK basal application and compost addition prior to sowing demanding crops."}
        {fertility.class === 1 &&
          "Fertile classification: Balanced chemical reaction and macronutrient profile capable of sustaining healthy staple crops and pulses with routine agronomic care."}
        {fertility.class === 2 &&
          "High fertility classification: Exceptional nutrient balance and organic matter availability. Well-suited for high-value horticultural crops, intensive vegetable cultivation, and premium commercial yields."}
      </p>
    </div>
  );
}

export function CropSuitabilitySection({ result }: { result: Analysis }) {
  const nutrients: Record<string, number> = {};
  for (const r of [...result.measured, ...result.estimated]) {
    nutrients[r.key] = r.value;
  }

  const millets: CropEvaluation[] =
    result.crop_suitability?.detailed_millets ??
    DEFAULT_MILLETS.map((m) => {
      const isSuitable = result.crop_suitability?.millets
        ? result.crop_suitability.millets.includes(m.name)
        : evaluateCrop(m.name, nutrients);
      return { ...m, suitable: isSuitable };
    });

  const vegetables: CropEvaluation[] =
    result.crop_suitability?.detailed_vegetables ??
    DEFAULT_VEGETABLES.map((v) => {
      const isSuitable = result.crop_suitability?.vegetables
        ? result.crop_suitability.vegetables.includes(v.name)
        : evaluateCrop(v.name, nutrients);
      return { ...v, suitable: isSuitable };
    });

  const suitableMilletsCount = millets.filter((m) => m.suitable).length;
  const suitableVegCount = vegetables.filter((v) => v.suitable).length;

  return (
    <div className="suitability-panels">
      {/* Millets Panel */}
      <section className="card panel-suitability">
        <div className="panel-title-row">
          <div className="panel-title-left">
            <div className="panel-title-badge millet-badge">
              <Wheat size={18} strokeWidth={2} />
            </div>
            <div>
              <h2 className="suitability-heading">Millets Suitability</h2>
              <p className="section-subtitle">
                ICAR arid & semi-arid nutrient thresholds · {suitableMilletsCount} of {millets.length} suitable
              </p>
            </div>
          </div>
          <div className="suit-badge-wrap">
            <span className="badge-count count-millet">
              {suitableMilletsCount}/{millets.length}
            </span>
          </div>
        </div>

        <div className="suitability-progress-track">
          <div
            className="suitability-progress-bar bar-millet"
            style={{ width: `${(suitableMilletsCount / millets.length) * 100}%` }}
          />
        </div>

        <ul className="suitability-list">
          {millets.map((crop) => (
            <li key={crop.name} className={`suitability-item ${crop.suitable ? "is-suitable" : "not-suitable"}`}>
              <div className="crop-icon-box millet-icon-box" aria-hidden="true">
                <Wheat size={19} strokeWidth={1.8} />
              </div>
              <div className="suitability-info">
                <div className="crop-title-row">
                  <strong className="crop-primary-name">{crop.name}</strong>
                </div>
                <div className="criteria-pills">
                  {crop.criteria.split(", ").map((crit, idx) => (
                    <span key={idx} className="criteria-tag">{crit}</span>
                  ))}
                </div>
              </div>
              <div className="suitability-status">
                {crop.suitable ? (
                  <span className="suit-tag suit-ok">
                    <CircleCheck size={15} strokeWidth={2.2} /> Suitable
                  </span>
                ) : (
                  <span className="suit-tag suit-no">
                    <CircleAlert size={15} strokeWidth={2} /> Unsuitable
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Vegetables Panel */}
      <section className="card panel-suitability">
        <div className="panel-title-row">
          <div className="panel-title-left">
            <div className="panel-title-badge veg-badge">
              <Carrot size={18} strokeWidth={2} />
            </div>
            <div>
              <h2 className="suitability-heading">Vegetables Suitability</h2>
              <p className="section-subtitle">
                Horticultural micronutrient & pH standards · {suitableVegCount} of {vegetables.length} suitable
              </p>
            </div>
          </div>
          <div className="suit-badge-wrap">
            <span className="badge-count count-veg">
              {suitableVegCount}/{vegetables.length}
            </span>
          </div>
        </div>

        <div className="suitability-progress-track">
          <div
            className="suitability-progress-bar bar-veg"
            style={{ width: `${(suitableVegCount / vegetables.length) * 100}%` }}
          />
        </div>

        <ul className="suitability-list">
          {vegetables.map((crop) => (
            <li key={crop.name} className={`suitability-item ${crop.suitable ? "is-suitable" : "not-suitable"}`}>
              <div className="crop-icon-box veg-icon-box" aria-hidden="true">
                <Carrot size={19} strokeWidth={1.8} />
              </div>
              <div className="suitability-info">
                <div className="crop-title-row">
                  <strong className="crop-primary-name">{crop.name}</strong>
                </div>
                <div className="criteria-pills">
                  {crop.criteria.split(", ").map((crit, idx) => (
                    <span key={idx} className="criteria-tag">{crit}</span>
                  ))}
                </div>
              </div>
              <div className="suitability-status">
                {crop.suitable ? (
                  <span className="suit-tag suit-ok">
                    <CircleCheck size={15} strokeWidth={2.2} /> Suitable
                  </span>
                ) : (
                  <span className="suit-tag suit-no">
                    <CircleAlert size={15} strokeWidth={2} /> Unsuitable
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
