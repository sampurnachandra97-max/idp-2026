"use client";

import { Carrot, CircleAlert, CircleCheck, Wheat } from "lucide-react";
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
  const levelClass = isHigh || isFertile ? "status-ok" : "status-watch";

  return (
    <div className="fertility-banner card">
      <div className="fertility-head">
        <div>
          <span className="fertility-caption">Soil Fertility Classification</span>
          <h2 className="fertility-title">{fertility.label}</h2>
        </div>
        <div className="fertility-metrics">
          <span className={`status-pill ${levelClass}`}>
            {fertility.label} · {percentConfidence}% confidence
          </span>
        </div>
      </div>
      <p className="fertility-desc">
        {fertility.class === 0 &&
          "Low fertility tier: Baseline macronutrient reserve (N, P, K) or organic matter is constrained. Supplemental organic fertilization and targeted basal applications are recommended before crop establishment."}
        {fertility.class === 1 &&
          "Fertile tier: Well-balanced nutrient status suited for sustainable crop cycles. Standard crop nutrition schedules will yield consistent results across standard staples and coarse cereals."}
        {fertility.class === 2 &&
          "High fertility tier: High active nutrient availability with strong macronutrient profile. Excellent capacity for intensive vegetable cultivation, pulses, and high-demand commercial varieties."}
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
          <div>
            <h2>Millets Suitability</h2>
            <p className="section-subtitle">
              ICAR arid & semi-arid nutrient thresholds ({suitableMilletsCount} of {millets.length} suitable)
            </p>
          </div>
          <span className="badge-count">
            {suitableMilletsCount}/{millets.length}
          </span>
        </div>

        <ul className="suitability-list">
          {millets.map((crop) => (
            <li key={crop.name} className={`suitability-item ${crop.suitable ? "is-suitable" : "not-suitable"}`}>
              <span className="icon-tile" aria-hidden="true">
                <Wheat size={18} strokeWidth={1.75} />
              </span>
              <div className="suitability-info">
                <strong>{crop.name}</strong>
                <small title={crop.criteria}>{crop.criteria}</small>
              </div>
              <div className="suitability-status">
                {crop.suitable ? (
                  <span className="suit-tag suit-ok">
                    <CircleCheck size={14} strokeWidth={2} /> Suitable
                  </span>
                ) : (
                  <span className="suit-tag suit-no">
                    <CircleAlert size={14} strokeWidth={2} /> Unsuitable
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
          <div>
            <h2>Vegetables Suitability</h2>
            <p className="section-subtitle">
              Horticultural micronutrient & pH standards ({suitableVegCount} of {vegetables.length} suitable)
            </p>
          </div>
          <span className="badge-count">
            {suitableVegCount}/{vegetables.length}
          </span>
        </div>

        <ul className="suitability-list">
          {vegetables.map((crop) => (
            <li key={crop.name} className={`suitability-item ${crop.suitable ? "is-suitable" : "not-suitable"}`}>
              <span className="icon-tile" aria-hidden="true">
                <Carrot size={18} strokeWidth={1.75} />
              </span>
              <div className="suitability-info">
                <strong>{crop.name}</strong>
                <small title={crop.criteria}>{crop.criteria}</small>
              </div>
              <div className="suitability-status">
                {crop.suitable ? (
                  <span className="suit-tag suit-ok">
                    <CircleCheck size={14} strokeWidth={2} /> Suitable
                  </span>
                ) : (
                  <span className="suit-tag suit-no">
                    <CircleAlert size={14} strokeWidth={2} /> Unsuitable
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
