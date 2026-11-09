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

const respond = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Analyzer", () => {
  it("analyses the starter sample and shows the findings", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respond(analysis)));
    render(<Analyzer />);
    expect(await screen.findByText("3 of 12 indicators need action.")).toBeTruthy();
    expect(screen.getAllByText("rice").length).toBeGreaterThan(0);
    expect(screen.getByText("Band phosphorus near the root zone.")).toBeTruthy();
  });

  it("does not call the API when a value is invalid", async () => {
    const fetchMock = vi.fn(() => respond(analysis));
    vi.stubGlobal("fetch", fetchMock);
    render(<Analyzer />);
    await screen.findByText("3 of 12 indicators need action.");
    fetchMock.mockClear();

    fireEvent.change(document.querySelector('input[name="pH"]')!, { target: { value: "99" } });
    fireEvent.submit(document.querySelector("form")!);

    expect(screen.getByText("Use 0 to 14")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tells the user when the service is down", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respond({}, 500)));
    render(<Analyzer />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("not responding"));
  });
});
