"use client";

import { Download, Loader2, Search, Upload } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { StatusTag } from "@/components/Analyzer";
import { FIELDS } from "@/lib/soil";
import type { Analysis, FertilityResult } from "@/lib/types";

interface EnrichedRow {
  index: number;
  N: number;
  P: number;
  K: number;
  pH: number;
  EC: number;
  fertility?: FertilityResult;
  suitableMillets?: string[];
  suitableVegetables?: string[];
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const fields = (line: string) =>
    line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((value) => value.trim().replace(/^"|"$/g, ""));
  const headers = fields(lines[0]).map((header) => header.toLowerCase());
  return lines.slice(1).map((line, index) => {
    const values = fields(line);
    if (values.length !== headers.length) {
      throw new Error(`Sample ${index + 1} has a different number of columns than the header.`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
}

export function DatasetUploader() {
  const [rows, setRows] = useState<EnrichedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const processRecords = async (records: Record<string, string>[]) => {
    if (records.length > 1000) throw new Error("Upload a CSV with at most 1,000 soil records.");

    const keys = [...FIELDS.map(({ key }) => key), "OC", "S", "Zn", "Fe", "Cu", "Mn", "B"];
    const payloadSamples = records.map((record) =>
      Object.fromEntries(keys.flatMap((key) => {
        const value = record[key.toLowerCase()];
        return value ? [[key, value]] : [];
      })),
    );

    const res = await fetch("/api/analyze-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ samples: payloadSamples }),
    });

    if (res.status === 401) {
      window.location.assign("/login");
      return;
    }
    if (res.status === 422) {
      const { detail } = await res.json();
      const issue = detail[0];
      const [, , row, field] = issue.loc;
      throw new Error(`Sample ${row + 1}, ${field}: ${issue.msg}.`);
    }
    if (!res.ok) throw new Error("Batch analysis is unavailable. Please try again.");

    const data = await res.json();
    const enriched: EnrichedRow[] = (data.results as Analysis[]).map((result, idx) => ({
      index: idx + 1,
      N: Number(payloadSamples[idx].N),
      P: Number(payloadSamples[idx].P),
      K: Number(payloadSamples[idx].K),
      pH: Number(payloadSamples[idx].pH),
      EC: Number(payloadSamples[idx].EC),
      fertility: result.fertility,
      suitableMillets: result.crop_suitability?.millets,
      suitableVegetables: result.crop_suitability?.vegetables,
    }));

    setRows(enriched);
    setPage(0);
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setLoading(true);
    setRows([]);
    setError(null);
    try {
      const records = parseCSV(await file.text());
      if (!records.length) throw new Error("The CSV needs a header and at least one soil record.");
      await processRecords(records);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const downloadEnrichedCSV = () => {
    if (rows.length === 0) return;
    const header = [
      "Sample_ID",
      "N",
      "P",
      "K",
      "pH",
      "EC",
      "Fertility_Prediction",
      "Confidence_Percent",
      "Suitable_Millets",
      "Suitable_Vegetables",
    ];
    const csvLines = [header.join(",")];

    for (const r of rows) {
      csvLines.push(
        [
          r.index,
          r.N,
          r.P,
          r.K,
          r.pH,
          r.EC,
          `"${r.fertility?.label ?? ""}"`,
          r.fertility?.confidence == null ? "" : Math.round(r.fertility.confidence * 100),
          `"${r.suitableMillets?.join("; ") ?? ""}"`,
          `"${r.suitableVegetables?.join("; ") ?? ""}"`,
        ].join(",")
      );
    }

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `soil_analysis_enriched_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.fertility?.label.toLowerCase().includes(q) ||
      r.suitableMillets?.some((m) => m.toLowerCase().includes(q)) ||
      r.suitableVegetables?.some((v) => v.toLowerCase().includes(q))
    );
  });

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const displayed = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const fertileCount = rows.filter((r) => r.fertility?.class === 1 || r.fertility?.class === 2).length;
  const lowCount = rows.filter((r) => r.fertility?.class === 0).length;

  return (
    <div className="dataset-section card">
      <div className="dataset-header">
        <div>
          <h2>Soil Dataset Batch Upload & Suitability Analysis</h2>
          <p className="section-subtitle">
            Upload a CSV with pH, EC, N, P and K columns. The models estimate micronutrients and organic carbon when those readings are missing.
          </p>
        </div>
        <div className="dataset-actions">
          <label className="button upload-btn">
            <Upload size={16} />
            <span>Upload CSV</span>
            <input type="file" accept=".csv" disabled={loading} onChange={handleFileUpload} className="sr-only" />
          </label>
        </div>
      </div>

      {error && <p className="notice" role="alert">{error}</p>}

      {loading && (
        <div className="upload-loading">
          <Loader2 size={24} className="spin" />
          <span>Processing dataset with ML models…</span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="dataset-results">
          <dl className="kpis">
            <div className="card">
              <dt>Total Samples</dt>
              <dd>{rows.length}</dd>
            </div>
            <div className="card">
              <dt><StatusTag level="ok">Fertile Tier</StatusTag></dt>
              <dd>{fertileCount}<small> ({Math.round((fertileCount / rows.length) * 100)}%)</small></dd>
            </div>
            <div className="card">
              <dt><StatusTag level="watch">Low Fertility</StatusTag></dt>
              <dd>{lowCount}<small> ({Math.round((lowCount / rows.length) * 100)}%)</small></dd>
            </div>
            <div className="card">
              <dt>Enriched Export</dt>
              <dd style={{ fontSize: "16px", marginTop: "8px" }}>
                <button type="button" className="button download-btn" onClick={downloadEnrichedCSV}>
                  <Download size={15} /> Download CSV
                </button>
              </dd>
            </div>
          </dl>

          <div className="table-controls">
            <div className="search-wrap">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Filter by fertility, millet, or vegetable…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="search-input"
              />
            </div>
            <span className="record-count">
              Showing {filtered.length} samples
            </span>
          </div>

          <div className="table-scroll">
            <table aria-label="Soil batch analysis results">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col" className="num">N</th>
                  <th scope="col" className="num">P</th>
                  <th scope="col" className="num">K</th>
                  <th scope="col" className="num">pH</th>
                  <th scope="col" className="num">EC</th>
                  <th scope="col">Fertility Classification</th>
                  <th scope="col">Suitable Millets</th>
                  <th scope="col">Suitable Vegetables</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((row) => (
                  <tr key={row.index}>
                    <td><strong>{row.index}</strong></td>
                    <td className="num">{row.N}</td>
                    <td className="num">{row.P}</td>
                    <td className="num">{row.K}</td>
                    <td className="num">{row.pH}</td>
                    <td className="num">{row.EC}</td>
                    <td>
                      {row.fertility ? (
                        <StatusTag level={row.fertility.class === 0 ? "watch" : "ok"}>
                          {row.fertility.label}
                          {row.fertility.confidence != null && ` (${Math.round(row.fertility.confidence * 100)}%)`}
                        </StatusTag>
                      ) : "Unavailable"}
                    </td>
                    <td>
                      <div className="crop-pills">
                        {row.suitableMillets?.length ? (
                          row.suitableMillets.map((m) => (
                            <span key={m} className="pill pill-millet">{m.split(" ")[0]}</span>
                          ))
                        ) : (
                          <span className="empty">{row.suitableMillets ? "None" : "Unavailable"}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="crop-pills">
                        {row.suitableVegetables?.length ? (
                          row.suitableVegetables.map((v) => (
                            <span key={v} className="pill pill-veg">{v}</span>
                          ))
                        ) : (
                          <span className="empty">{row.suitableVegetables ? "None" : "Unavailable"}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="pagination">
              <button
                type="button"
                className="button button-small"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>Page {page + 1} of {pageCount}</span>
              <button
                type="button"
                className="button button-small"
                disabled={page >= pageCount - 1}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
