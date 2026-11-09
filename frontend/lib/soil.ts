export type FieldKey = "pH" | "EC" | "N" | "P" | "K" | "temperature" | "humidity" | "rainfall";

export interface FieldSpec {
  key: FieldKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: string;
  group: "soil" | "climate";
}

export const FIELDS: FieldSpec[] = [
  { key: "pH", label: "pH", unit: "", min: 0, max: 14, step: "0.01", group: "soil" },
  { key: "EC", label: "EC", unit: "dS/m", min: 0, max: 20, step: "0.01", group: "soil" },
  { key: "N", label: "Nitrogen", unit: "kg/ha", min: 0, max: 1500, step: "1", group: "soil" },
  { key: "P", label: "Phosphorus", unit: "kg/ha", min: 0, max: 500, step: "0.01", group: "soil" },
  { key: "K", label: "Potassium", unit: "kg/ha", min: 0, max: 2000, step: "1", group: "soil" },
  { key: "temperature", label: "Temperature", unit: "°C", min: -10, max: 60, step: "0.1", group: "climate" },
  { key: "humidity", label: "Humidity", unit: "%", min: 0, max: 100, step: "1", group: "climate" },
  { key: "rainfall", label: "Rainfall", unit: "mm", min: 0, max: 5000, step: "1", group: "climate" },
];

export type FormValues = Record<FieldKey, string>;
export type FormErrors = Partial<Record<FieldKey, string>>;

export function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  for (const field of FIELDS) {
    const raw = values[field.key].trim();
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) {
      errors[field.key] = "Enter a number";
    } else if (value < field.min || value > field.max) {
      errors[field.key] = `Use ${field.min} to ${field.max}`;
    }
  }
  return errors;
}

export function toPayload(values: FormValues): Record<FieldKey, number> {
  return Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key])])) as Record<FieldKey, number>;
}

export function formatValue(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}
