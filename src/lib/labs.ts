// Reference ranges for common Indian checkup tests (adult). Used only to draw the "normal" band on the
// dashboard; the high/low status itself comes from the report. Sources: ADA (HbA1c, glucose), NCEP ATP III
// / Lipid Association of India (lipids), common lab reference intervals (creatinine, TSH).
export type RefRange = { low: number; high: number; min: number; max: number; better: "lower" | "range" | "higher" };

const RANGES: [RegExp, RefRange][] = [
  [/hba1c|glycated/i, { low: 4, high: 5.6, min: 3, max: 12, better: "lower" }],
  [/fasting.*(glucose|sugar)|fbs|fbg/i, { low: 70, high: 100, min: 50, max: 250, better: "lower" }],
  [/(post.?prandial|pp|random).*(glucose|sugar)|ppbs|rbs/i, { low: 70, high: 140, min: 50, max: 350, better: "lower" }],
  [/ldl/i, { low: 0, high: 100, min: 0, max: 250, better: "lower" }],
  [/hdl/i, { low: 40, high: 80, min: 0, max: 100, better: "higher" }],
  [/triglycer/i, { low: 0, high: 150, min: 0, max: 400, better: "lower" }],
  [/total.*chol|^cholesterol/i, { low: 0, high: 200, min: 0, max: 350, better: "lower" }],
  [/creatinine/i, { low: 0.7, high: 1.3, min: 0, max: 3, better: "range" }],
  [/tsh/i, { low: 0.4, high: 4, min: 0, max: 10, better: "range" }],
  [/vitamin\s*d|25.?oh/i, { low: 30, high: 100, min: 0, max: 120, better: "range" }],
  [/haemoglobin|hemoglobin|^hb$/i, { low: 12, high: 17, min: 6, max: 20, better: "range" }],
  [/uric/i, { low: 3.5, high: 7.2, min: 0, max: 12, better: "range" }],
];

export function refRangeFor(test: string): RefRange | null {
  return RANGES.find(([re]) => re.test(test))?.[1] ?? null;
}

/** "142/92" → systolic 142 (BP is drawn on its systolic value against 90–120). */
export function numericValue(test: string, value: unknown): number | null {
  if (typeof value === "number") return value;
  const s = String(value ?? "");
  const m = s.match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

export const BP_RANGE: RefRange = { low: 90, high: 120, min: 70, max: 190, better: "range" };
