"use client";

import { useEffect, useState } from "react";
import { PROPERTY_NAMES, StatusTag } from "@/components/Analyzer";
import type { ModelCard } from "@/lib/types";

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function ModelEvidence() {
  const [card, setCard] = useState<ModelCard | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/model-card", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(setCard)
      .catch((error: Error) => {
        if (error.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, []);

  if (failed) return <p className="notice">Model results are unavailable because the API is not running.</p>;
  if (!card) return <p className="empty">Loading model results…</p>;

  const { soil, crop } = card;
  return (
    <>
      <p className="section-note">
        Scored on {soil.test_fields} whole fields held out from training. The soil data has {soil.samples}{" "}
        samples from {soil.fields} fields, and repeat readings of one field never appear on both sides of
        the split.
      </p>
      <div className="card table-scroll" tabIndex={0} role="region" aria-label="Soil model test results">
        <table>
          <thead>
            <tr>
              <th scope="col">Property</th>
              <th scope="col">Selected model</th>
              <th scope="col" className="num">R², unseen fields</th>
              <th scope="col" className="num">R², random split</th>
              <th scope="col" className="num">Mean error</th>
              <th scope="col" className="num">Guessing the mean</th>
              <th scope="col" className="num">90% range hit rate</th>
              <th scope="col">Reliability</th>
            </tr>
          </thead>
          <tbody>
            {soil.targets.map((row) => (
              <tr key={row.target}>
                <th scope="row">{PROPERTY_NAMES[row.target] ?? row.target}</th>
                <td>{row.selected_model}</td>
                <td className="num strong">{row.test.r2.toFixed(2)}</td>
                <td className="num">{row.random_split_r2.toFixed(2)}</td>
                <td className="num">{row.test.mae.toFixed(3)}</td>
                <td className="num">{row.baseline_mae.toFixed(3)}</td>
                <td className="num">{Math.round(row.interval_test_coverage * 100)}%</td>
                <td>
                  <StatusTag level={row.reliability === "low" ? "act" : row.reliability === "moderate" ? "watch" : "ok"}>
                    {row.reliability[0].toUpperCase() + row.reliability.slice(1)}
                  </StatusTag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="kpis kpis-three">
        <div className="card">
          <dt>Crop model accuracy</dt>
          <dd>{percent(crop.test.accuracy)}</dd>
        </div>
        <div className="card">
          <dt>Correct crop in top three</dt>
          <dd>{percent(crop.test.top3_accuracy)}</dd>
        </div>
        <div className="card">
          <dt>Crops ranked</dt>
          <dd>{crop.crops}</dd>
        </div>
      </dl>
      <p className="section-note">
        Crop ranking uses {crop.selected_model} on climate and pH, tested on a tidy public benchmark, so
        field accuracy will be lower. The benchmark’s N, P and K are excluded because they are not on the
        same scale as lab results in kg/ha.
      </p>
    </>
  );
}
