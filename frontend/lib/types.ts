export type Level = "ok" | "watch" | "act";
export type Reliability = "high" | "moderate" | "low";

export interface Reading {
  key: string;
  name: string;
  unit: string;
  value: number;
  status: string;
  level: Level;
  scale: [number, number];
  thresholds: number[];
}

export interface Estimate extends Reading {
  low: number;
  high: number;
  borderline: boolean;
  reliability: Reliability;
  r2: number;
}

export interface CropFit {
  crop: string;
  fit: number;
}

export interface Action {
  key: string;
  name: string;
  status: string;
  level: Level;
  source: "measured" | "estimated";
  confirm_first: boolean;
  action: string;
}

export interface Analysis {
  summary: { in_range: number; needs_action: number; watch: number; total: number };
  measured: Reading[];
  estimated: Estimate[];
  crops: CropFit[];
  actions: Action[];
  warnings: string[];
}

export interface TargetReport {
  target: string;
  selected_model: string;
  test: { r2: number; mae: number; rmse: number };
  baseline_mae: number;
  interval_test_coverage: number;
  random_split_r2: number;
  reliability: Reliability;
}

export interface ModelCard {
  trained_at: string;
  soil: {
    samples: number;
    fields: number;
    test_samples: number;
    test_fields: number;
    targets: TargetReport[];
  };
  crop: {
    samples: number;
    crops: number;
    selected_model: string;
    test: { accuracy: number; macro_f1: number; top3_accuracy: number };
  };
}
