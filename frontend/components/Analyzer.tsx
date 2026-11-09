"use client";

import { CircleAlert, CircleCheck, FlaskConical, Leaf, TriangleAlert, Zap, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CropIcon } from "@/components/CropIcon";
import { FIELDS, formatValue, toPayload, validate, type FormErrors, type FormValues } from "@/lib/soil";
import type { Analysis, Estimate, Level, Reading } from "@/lib/types";

export const PROPERTY_NAMES: Record<string, string> = {
  OC: "Organic carbon",
  S: "Sulphur",
  Zn: "Zinc",
  B: "Boron",
  Fe: "Iron",
  Mn: "Manganese",
  Cu: "Copper",
};

const PRESETS: { label: string; values: FormValues }[] = [
  {
    label: "Sample 1",
    values: { pH: "6.78", EC: "0.25", N: "179", P: "7.93", K: "256", temperature: "27", humidity: "72", rainfall: "180" },
  },
  {
    label: "Sample 16",
    values: { pH: "7.41", EC: "0.11", N: "72", P: "18.07", K: "76", temperature: "24", humidity: "60", rainfall: "90" },
  },
];

const LEVEL_ICON: Record<Level, LucideIcon> = { ok: CircleCheck, watch: TriangleAlert, act: CircleAlert };
/* Nutrients have no icon here because their chemical symbol is the exact mark. */
const READING_ICONS: Record<string, LucideIcon> = { pH: FlaskConical, EC: Zap, OC: Leaf };
const INITIAL_ACTIONS = 3;
const SERVICE_DOWN = "The analysis service is not responding. Check that the API is running, then try again.";

export function StatusTag({ level, children }: { level: Level; children: ReactNode }) {
  const Icon = LEVEL_ICON[level];
  return (
    <span className="status">
      <Icon className={`status-icon status-${level}`} size={14} strokeWidth={2} aria-hidden="true" />
      {children}
    </span>
  );
}

function IndicatorRow({ reading }: { reading: Reading | Estimate }) {
  const estimate = "low" in reading ? reading : null;
  const ReadingIcon = READING_ICONS[reading.key];
  const unit = reading.unit ? ` ${reading.unit}` : "";
  const range = estimate ? `, likely ${formatValue(estimate.low)} to ${formatValue(estimate.high)}` : "";
  return (
    <li className="reading" title={`${reading.name}: ${formatValue(reading.value)}${unit}${range}`}>
      <span className="icon-tile" aria-hidden="true">
        {ReadingIcon ? <ReadingIcon size={18} strokeWidth={1.75} /> : reading.key}
      </span>
      <div className="reading-name">
        {reading.name}
        {estimate && (
          <small>
            {estimate.borderline ? "Borderline · " : ""}
            {formatValue(estimate.low)}–{formatValue(estimate.high)} · {estimate.reliability} reliability
          </small>
        )}
      </div>
      <div className="reading-value">
        {formatValue(reading.value)}
        {reading.unit && <small> {reading.unit}</small>}
      </div>
      <div className="reading-status">
        <StatusTag level={reading.level}>{reading.status}</StatusTag>
      </div>
    </li>
  );
}

async function requestAnalysis(values: FormValues, signal: AbortSignal): Promise<Analysis> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toPayload(values)),
    signal,
  });
  if (response.status === 401) {
    window.location.assign("/login");
    throw new DOMException("Signed out", "AbortError");
  }
  if (!response.ok) {
    throw new Error(
      response.status === 422 ? "One of the values could not be accepted. Check the sample and try again." : SERVICE_DOWN,
    );
  }
  return response.json();
}

function headline({ needs_action, total }: Analysis["summary"]): string {
  if (needs_action === 0) return `No indicator out of ${total} needs immediate action.`;
  return `${needs_action} of ${total} indicators need action.`;
}

function Results({ result, busy }: { result: Analysis; busy: boolean }) {
  const { summary, crops } = result;
  const [showAll, setShowAll] = useState(false);
  const actions = showAll ? result.actions : result.actions.slice(0, INITIAL_ACTIONS);
  return (
    <div className="results" aria-live="polite" aria-busy={busy}>
      <h1>{headline(summary)}</h1>

      <dl className="kpis">
        <div className="card">
          <dt><StatusTag level="ok">In range</StatusTag></dt>
          <dd>{summary.in_range}<small> / {summary.total}</small></dd>
        </div>
        <div className="card">
          <dt><StatusTag level="act">Needs action</StatusTag></dt>
          <dd>{summary.needs_action}</dd>
        </div>
        <div className="card">
          <dt><StatusTag level="watch">To watch</StatusTag></dt>
          <dd>{summary.watch}</dd>
        </div>
        <div className="card">
          <dt>Best-fit crop</dt>
          <dd className="kpi-crop">{crops[0].crop}<small> {Math.round(crops[0].fit * 100)}%</small></dd>
        </div>
      </dl>

      {result.warnings.map((warning) => (
        <p className="notice" key={warning}>{warning}</p>
      ))}

      <div className="panels">
        <section className="card panel-actions">
          <h2>What to do first</h2>
          {result.actions.length === 0 ? (
            <p className="empty">No corrective action is indicated by this sample.</p>
          ) : (
            <ol className="action-list">
              {actions.map((action) => (
                <li key={action.key}>
                  <div className="action-head">
                    <strong>{action.name}</strong>
                    <StatusTag level={action.level}>{action.status}</StatusTag>
                    <span className="action-source">
                      {action.source === "measured" ? "Measured" : "Estimated"}
                      {action.confirm_first ? " · confirm with a lab first" : ""}
                    </span>
                  </div>
                  <p>{action.action}</p>
                </li>
              ))}
            </ol>
          )}
          {result.actions.length > INITIAL_ACTIONS && (
            <button className="show-more" type="button" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show all ${result.actions.length}`}
            </button>
          )}
        </section>

        <section className="card panel-crops">
          <h2>Crop suitability</h2>
          <ol className="crops">
            {crops.map(({ crop, fit }) => (
              <li key={crop}>
                <span className="icon-tile"><CropIcon crop={crop} /></span>
                <span className="crop-name">{crop}</span>
                <span className="crop-fit">{Math.round(fit * 100)}%</span>
                <i className="crop-bar" style={{ width: `${Math.max(fit * 100, 1)}%` }} />
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <h2>Measured</h2>
          <ul>{result.measured.map((reading) => <IndicatorRow key={reading.key} reading={reading} />)}</ul>
        </section>

        <section className="card">
          <h2>Estimated by the models</h2>
          <ul>{result.estimated.map((reading) => <IndicatorRow key={reading.key} reading={reading} />)}</ul>
        </section>
      </div>
    </div>
  );
}

export function Analyzer() {
  const [values, setValues] = useState<FormValues>(PRESETS[0].values);
  const [errors, setErrors] = useState<FormErrors>({});
  const [result, setResult] = useState<Analysis | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const run = useCallback(async (next: FormValues) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    setFailure(null);
    try {
      setResult(await requestAnalysis(next, controller.signal));
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setFailure(error instanceof TypeError ? SERVICE_DOWN : (error as Error).message);
    }
    if (inFlight.current === controller) setLoading(false);
  }, []);

  useEffect(() => {
    run(PRESETS[0].values);
    return () => inFlight.current?.abort();
  }, [run]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length === 0) run(values);
  };

  const loadPreset = (preset: FormValues) => {
    setValues(preset);
    setErrors({});
    run(preset);
  };

  const fieldGroup = (group: "soil" | "climate", legend: string) => (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="field-grid">
        {FIELDS.filter((field) => field.group === group).map((field) => (
          <label key={field.key} className="field">
            <span>{field.label}</span>
            <span className="field-input">
              <input
                inputMode="decimal"
                name={field.key}
                value={values[field.key]}
                aria-label={field.unit ? `${field.label} in ${field.unit}` : field.label}
                aria-invalid={Boolean(errors[field.key])}
                aria-describedby={errors[field.key] ? `${field.key}-error` : undefined}
                onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
              />
              {field.unit && <small aria-hidden="true">{field.unit}</small>}
            </span>
            {errors[field.key] && (
              <em id={`${field.key}-error`} className="field-error">{errors[field.key]}</em>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="dash-grid">
      <form className="card sample-form" onSubmit={submit} noValidate>
        <h2>Soil sample</h2>
        {fieldGroup("soil", "Routine soil test")}
        {fieldGroup("climate", "Growing conditions")}
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Analysing…" : "Analyse sample"}
        </button>
        <div className="presets">
          <span>Real lab data</span>
          <div className="segment" role="group" aria-label="Load a real lab sample">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                aria-pressed={FIELDS.every((field) => preset.values[field.key] === values[field.key])}
                onClick={() => loadPreset(preset.values)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </form>

      <div className="dash-main">
        {failure && <p className="notice" role="alert">{failure}</p>}
        {result ? <Results result={result} busy={loading} /> : !failure && <p className="empty">Analysing sample…</p>}
      </div>
    </div>
  );
}
