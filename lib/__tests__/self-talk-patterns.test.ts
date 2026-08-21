import { describe, it, expect } from "vitest";
import { detectFrequencyHigh, detectIntensityHigh, detectThemeConcentration, detectAllPatterns } from "../self-talk-patterns";

const TODAY = "2026-08-21";

function entry(daysAgo: number, theme: "lavoro" | "corpo" | "relazioni" | "economico" | "altro" | null, moodBefore: number | null = null) {
  const d = new Date(TODAY + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return { createdAt: d.toISOString(), theme, moodBefore };
}

describe("detectFrequencyHigh", () => {
  it("meno di 8 entry sullo stesso tema in 7 giorni: nessun trigger", () => {
    const entries = Array.from({ length: 7 }, (_, i) => entry(i, "lavoro"));
    expect(detectFrequencyHigh(entries, TODAY)).toBeNull();
  });

  it("8+ entry sullo stesso tema in 7 giorni: trigger", () => {
    const entries = Array.from({ length: 8 }, (_, i) => entry(i % 7, "lavoro"));
    const result = detectFrequencyHigh(entries, TODAY);
    expect(result?.flagType).toBe("frequency_high");
    expect(result?.summaryText).toContain("Lavoro");
  });

  it("8 entry ma sparse su temi diversi: nessun trigger (nessun tema raggiunge la soglia)", () => {
    const entries = [
      ...Array.from({ length: 4 }, (_, i) => entry(i, "lavoro")),
      ...Array.from({ length: 4 }, (_, i) => entry(i, "corpo")),
    ];
    expect(detectFrequencyHigh(entries, TODAY)).toBeNull();
  });

  it("entry fuori dalla finestra di 7 giorni non contano", () => {
    const entries = [
      ...Array.from({ length: 7 }, (_, i) => entry(i, "lavoro")),
      entry(10, "lavoro"),
    ];
    expect(detectFrequencyHigh(entries, TODAY)).toBeNull();
  });
});

describe("detectIntensityHigh", () => {
  it("meno di 5 entry con mood nella finestra: nessun trigger", () => {
    const entries = Array.from({ length: 4 }, (_, i) => entry(i, "altro", 1));
    expect(detectIntensityHigh(entries, TODAY)).toBeNull();
  });

  it("5+ entry con mood medio <= 3 in 14 giorni: trigger", () => {
    const entries = Array.from({ length: 5 }, (_, i) => entry(i, "altro", 2));
    const result = detectIntensityHigh(entries, TODAY);
    expect(result?.flagType).toBe("intensity_high");
  });

  it("5+ entry ma mood medio > 3: nessun trigger", () => {
    const entries = Array.from({ length: 5 }, (_, i) => entry(i, "altro", 6));
    expect(detectIntensityHigh(entries, TODAY)).toBeNull();
  });

  it("entry senza mood_before non contano nel conteggio minimo", () => {
    const entries = [
      ...Array.from({ length: 3 }, (_, i) => entry(i, "altro", 1)),
      ...Array.from({ length: 3 }, (_, i) => entry(i + 3, "altro", null)),
    ];
    expect(detectIntensityHigh(entries, TODAY)).toBeNull();
  });
});

describe("detectThemeConcentration", () => {
  it("meno di 5 entry nella finestra: nessun trigger anche al 100%", () => {
    const entries = Array.from({ length: 4 }, (_, i) => entry(i, "corpo"));
    expect(detectThemeConcentration(entries, TODAY)).toBeNull();
  });

  it("60%+ delle entry su un tema in 30 giorni: trigger", () => {
    const entries = [
      ...Array.from({ length: 6 }, (_, i) => entry(i, "corpo")),
      ...Array.from({ length: 4 }, (_, i) => entry(i + 6, "lavoro")),
    ];
    const result = detectThemeConcentration(entries, TODAY);
    expect(result?.flagType).toBe("theme_concentration");
    expect(result?.summaryText).toContain("60%");
  });

  it("distribuzione equilibrata tra temi: nessun trigger", () => {
    const entries = [
      ...Array.from({ length: 3 }, (_, i) => entry(i, "corpo")),
      ...Array.from({ length: 3 }, (_, i) => entry(i + 3, "lavoro")),
    ];
    expect(detectThemeConcentration(entries, TODAY)).toBeNull();
  });
});

describe("detectAllPatterns", () => {
  it("nessuna entry: nessun flag", () => {
    expect(detectAllPatterns([], TODAY)).toEqual([]);
  });

  it("più pattern possono scattare insieme", () => {
    const entries = Array.from({ length: 8 }, (_, i) => entry(i % 7, "corpo", 2));
    const results = detectAllPatterns(entries, TODAY);
    const types = results.map((r) => r.flagType).sort();
    expect(types).toEqual(["frequency_high", "intensity_high", "theme_concentration"]);
  });
});
