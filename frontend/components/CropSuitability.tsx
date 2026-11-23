"use client";

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

export function FertilityBanner({ fertility, hasEstimates }: { fertility?: FertilityResult; hasEstimates: boolean }) {
  if (!fertility) return null;
  const isHigh = fertility.class === 2;
  const isFertile = fertility.class === 1;
  const levelClass = isHigh ? "fertility-high" : isFertile ? "fertility-ok" : "fertility-watch";

  return (
    <div className={`fertility-banner card ${levelClass}`}>
      <div className="fertility-top">
        <div>
          <span className="fertility-kicker">Soil Fertility Classification</span>
          <h2 className="fertility-main-title">{fertility.label}</h2>
        </div>
        {fertility.confidence != null && (
          <span className="fertility-badge">
            {Math.round(fertility.confidence * 100)}% model confidence
          </span>
        )}
      </div>
      <p className="fertility-narrative">
        {fertility.class === 0 &&
          "Review the soil readings and recommended actions to see which nutrients may need attention."}
        {fertility.class === 1 &&
          "Review the individual readings to plan nutrient management for your crop."}
        {fertility.class === 2 &&
          "Check the crop suitability results for crops whose soil requirements match this sample."}
      </p>
      {hasEstimates && <p className="fertility-source">Includes model-estimated nutrients.</p>}
    </div>
  );
}

function SuitabilityPanel({
  title,
  subtitle,
  crops,
}: {
  title: string;
  subtitle: string;
  crops?: CropEvaluation[];
}) {
  return (
    <section className="card panel-suitability">
      <div className="panel-title-row">
        <div>
          <h2 className="suitability-heading">{title}</h2>
          <p className="section-subtitle">{subtitle}</p>
        </div>
        {!!crops?.length && (
          <span className="badge-count">
            {crops.filter((crop) => crop.suitable).length} / {crops.length} Suitable
          </span>
        )}
      </div>

      {crops?.length ? (
        <ul className="suitability-list">
          {crops.map((crop) => (
            <li key={crop.name} className="suitability-item">
              <div className="suitability-info">
                <span className="crop-primary-name">{crop.name}</span>
                <span className="crop-criteria-text">{crop.criteria}</span>
              </div>
              <div className="suitability-status">
                <span className={`suit-tag ${crop.suitable ? "suit-ok" : "suit-no"}`}>
                  {crop.suitable ? "Suitable" : "Not Suitable"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="section-subtitle">Crop suitability is unavailable for this analysis.</p>
      )}
    </section>
  );
}

function expandCropNames(crops: CropEvaluation[], suitableNames?: string[]) {
  if (!suitableNames) return undefined;
  return crops.map((crop) => ({ ...crop, suitable: suitableNames.includes(crop.name) }));
}

export function CropSuitabilitySection({ result }: { result: Analysis }) {
  const suitability = result.crop_suitability;
  const millets =
    suitability?.detailed_millets ?? expandCropNames(DEFAULT_MILLETS, suitability?.millets);
  const vegetables =
    suitability?.detailed_vegetables ?? expandCropNames(DEFAULT_VEGETABLES, suitability?.vegetables);

  return (
    <div className="suitability-panels">
      <SuitabilityPanel
        title="Millets Suitability"
        subtitle="ICAR arid & semi-arid nutrient thresholds"
        crops={millets}
      />
      <SuitabilityPanel
        title="Vegetables Suitability"
        subtitle="Horticultural micronutrient & pH standards"
        crops={vegetables}
      />
    </div>
  );
}
