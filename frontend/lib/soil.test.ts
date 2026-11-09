import { describe, expect, it } from "vitest";
import { formatValue, toPayload, validate, type FormValues } from "./soil";

const valid: FormValues = {
  pH: "6.8",
  EC: "0.25",
  N: "179",
  P: "7.93",
  K: "256",
  temperature: "25",
  humidity: "80",
  rainfall: "200",
};

describe("validate", () => {
  it("accepts a complete sample", () => {
    expect(validate(valid)).toEqual({});
  });

  it("flags blank and non-numeric values", () => {
    expect(validate({ ...valid, N: " ", P: "abc" })).toEqual({
      N: "Enter a number",
      P: "Enter a number",
    });
  });

  it("flags values outside the physical range", () => {
    expect(validate({ ...valid, pH: "15" }).pH).toBe("Use 0 to 14");
  });
});

describe("helpers", () => {
  it("converts form strings to numbers", () => {
    expect(toPayload(valid).P).toBe(7.93);
  });

  it("uses fewer decimals for larger values", () => {
    expect([formatValue(0.246), formatValue(14.26), formatValue(179.4)]).toEqual(["0.25", "14.3", "179"]);
  });
});
