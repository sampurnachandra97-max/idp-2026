"use client";

import { Download, FileSpreadsheet, Loader2, RefreshCw, Search, Upload } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { StatusTag } from "@/components/Analyzer";
import type { Analysis, Level } from "@/lib/types";

interface EnrichedRow {
  index: number;
  N: number;
  P: number;
  K: number;
  pH: number;
  EC: number;
  OC?: number;
  fertilityLabel: string;
  fertilityLevel: Level;
  confidence: number;
  suitableMillets: string[];
  suitableVegetables: string[];
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

export function DatasetUploader() {
  const [rows, setRows] = useState<EnrichedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const processRecords = async (records: Record<string, any>[]) => {
    setLoading(true);
    setError(null);
    try {
      const payloadSamples = records.map((r) => ({
        pH: parseFloat(r["pH"] ?? r["ph"] ?? "7.0") || 7.0,
        EC: parseFloat(r["EC"] ?? r["ec"] ?? "0.5") || 0.5,
        N: parseFloat(r["N"] ?? r["n"] ?? "150") || 150,
        P: parseFloat(r["P"] ?? r["p"] ?? "10") || 10,
        K: parseFloat(r["K"] ?? r["k"] ?? "150") || 150,
        temperature: parseFloat(r["temperature"] ?? "25") || 25,
        humidity: parseFloat(r["humidity"] ?? "70") || 70,
        rainfall: parseFloat(r["rainfall"] ?? "150") || 150,
        OC: r["OC"] ? parseFloat(r["OC"]) : undefined,
        S: r["S"] ? parseFloat(r["S"]) : undefined,
        Zn: r["Zn"] ? parseFloat(r["Zn"]) : undefined,
        Fe: r["Fe"] ? parseFloat(r["Fe"]) : undefined,
        Cu: r["Cu"] ? parseFloat(r["Cu"]) : undefined,
        Mn: r["Mn"] ? parseFloat(r["Mn"]) : undefined,
        B: r["B"] ? parseFloat(r["B"]) : undefined,
      }));

      const res = await fetch("/api/analyze-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: payloadSamples }),
      });

      if (!res.ok) throw new Error("Batch analysis failed. Please verify API status.");

      const data = await res.json();
      const enriched: EnrichedRow[] = (data.results as Analysis[]).map((result, idx) => {
        const fert = result.fertility;
        const fertLevel: Level =
          fert?.class === 1 || fert?.class === 2 ? "ok" : "watch";

        return {
          index: idx + 1,
          N: payloadSamples[idx].N,
          P: payloadSamples[idx].P,
          K: payloadSamples[idx].K,
          pH: payloadSamples[idx].pH,
          EC: payloadSamples[idx].EC,
          OC: payloadSamples[idx].OC,
          fertilityLabel: fert?.label ?? "Evaluated",
          fertilityLevel: fertLevel,
          confidence: fert ? Math.round(fert.confidence * 100) : 90,
          suitableMillets: result.crop_suitability?.millets ?? [],
          suitableVegetables: result.crop_suitability?.vegetables ?? [],
        };
      });

      setRows(enriched);
      setPage(0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const records = parseCSV(text);
      if (records.length === 0) {
        setError("Could not parse valid soil records from the uploaded file.");
        return;
      }
      processRecords(records);
    };
    reader.readAsText(file);
  };

  const loadSampleDataset = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dataset-sample");
      if (!res.ok) throw new Error("Could not load sample dataset.");
      const data = await res.json();
      if (data.rows && data.rows.length > 0) {
        processRecords(data.rows);
      } else {
        throw new Error("No sample records available.");
      }
    } catch (err) {
      setError((err as Error).message);
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
          `"${r.fertilityLabel}"`,
          r.confidence,
          `"${r.suitableMillets.join("; ")}"`,
          `"${r.suitableVegetables.join("; ")}"`,
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
      r.fertilityLabel.toLowerCase().includes(q) ||
      r.suitableMillets.some((m) => m.toLowerCase().includes(q)) ||
      r.suitableVegetables.some((v) => v.toLowerCase().includes(q))
    );
  });

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const displayed = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const fertileCount = rows.filter((r) => r.fertilityLabel.toLowerCase().includes("fertile") && !r.fertilityLabel.toLowerCase().includes("low")).length;
  const lowCount = rows.filter((r) => r.fertilityLabel.toLowerCase().includes("low")).length;

  return (
    <div className="dataset-section card">
      <div className="dataset-header">
        <div>
          <h2>Soil Dataset Batch Upload & Suitability Analysis</h2>
          <p className="section-subtitle">
            Upload your soil CSV file (e.g. dataset1.csv) to compute ML fertility tiers and individual crop suitability for each sample.
          </p>
        </div>
        <div className="dataset-actions">
          <label className="button upload-btn">
            <Upload size={16} />
            <span>Upload CSV</span>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="sr-only" />
          </label>
          <button type="button" className="button button-secondary" onClick={loadSampleDataset} disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
            <span>Load dataset1.csv</span>
          </button>
        </div>
      </div>

      {error && <p className="notice">{error}</p>}

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
                      <StatusTag level={row.fertilityLevel}>
                        {row.fertilityLabel} ({row.confidence}%)
                      </StatusTag>
                    </td>
                    <td>
                      <div className="crop-pills">
                        {row.suitableMillets.length > 0 ? (
                          row.suitableMillets.map((m) => (
                            <span key={m} className="pill pill-millet">{m.split(" ")[0]}</span>
                          ))
                        ) : (
                          <span className="empty">None</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="crop-pills">
                        {row.suitableVegetables.length > 0 ? (
                          row.suitableVegetables.map((v) => (
                            <span key={v} className="pill pill-veg">{v}</span>
                          ))
                        ) : (
                          <span className="empty">None</span>
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
