import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Analyzer } from "./Analyzer";
import type { Analysis } from "@/lib/types";

const analysis: Analysis = {
  summary: { in_range: 9, needs_action: 3, watch: 0, total: 12 },
  measured: [
    { key: "P", name: "Available phosphorus", unit: "kg/ha", value: 7.93, status: "Low", level: "act", scale: [0, 40], thresholds: [10, 25] },
  ],
  estimated: [
    {
      key: "Zn", name: "Zinc", unit: "mg/kg", value: 1.1, status: "Adequate", level: "ok", scale: [0, 2.5],
      thresholds: [0.6], low: 0.9, high: 1.3, borderline: false, reliability: "high", r2: 0.8,
    },
  ],
  crops: [{ crop: "rice", fit: 0.62 }],
  actions: [
    { key: "P", name: "Available phosphorus", status: "Low", level: "act", source: "measured", confirm_first: false, action: "Band phosphorus near the root zone." },
  ],
  warnings: [],
};

function submitSample() {
  const values = { pH: "6.78", EC: "0.25", N: "179", P: "7.93", K: "256", temperature: "25", humidity: "80", rainfall: "200" };
  for (const [name, value] of Object.entries(values)) {
    fireEvent.change(document.querySelector(`input[name="${name}"]`)!, { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Analyse sample" }));
}

const respond = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Analyzer", () => {
  it("waits for a submitted sample and shows the findings", async () => {
    const fetchMock = vi.fn(() => respond(analysis));
    vi.stubGlobal("fetch", fetchMock);
    render(<Analyzer />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((document.querySelector('input[name="pH"]') as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("status").textContent).toContain("Enter your soil test");
    submitSample();
    expect(await screen.findByText("3 of 12 indicators need action.")).toBeTruthy();
    expect(screen.getAllByText("rice").length).toBeGreaterThan(0);
    expect(screen.getByText("Band phosphorus near the root zone.")).toBeTruthy();
  });

  it("does not call the API when a value is invalid", () => {
    const fetchMock = vi.fn(() => respond(analysis));
    vi.stubGlobal("fetch", fetchMock);
    render(<Analyzer />);

    fireEvent.change(document.querySelector('input[name="pH"]')!, { target: { value: "99" } });
    fireEvent.submit(document.querySelector("form")!);

    expect(screen.getByText("Use 0 to 14")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tells the user when the service is down", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respond({}, 500)));
    render(<Analyzer />);
    submitSample();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("not responding"));
  });
});
