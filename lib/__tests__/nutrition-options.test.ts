import { describe, it, expect } from "vitest";
import { DIETARY_REGIME_PRESETS, macroSplitForRegime } from "../nutrition-options";

describe("macroSplitForRegime", () => {
  for (const preset of DIETARY_REGIME_PRESETS) {
    it(`${preset.value}: carb+protein+fat sommano a 100`, () => {
      const split = macroSplitForRegime(preset.value);
      expect(split.carbPct + split.proteinPct + split.fatPct).toBe(100);
    });
  }

  it("regime custom non presente nei preset ritorna il fallback bilanciato, non undefined", () => {
    const split = macroSplitForRegime("un-regime-inventato-dallutente");
    expect(split).toBeDefined();
    expect(split.carbPct + split.proteinPct + split.fatPct).toBe(100);
    // Fallback bilanciato documentato in lib/nutrition-options.ts.
    expect(split).toEqual({ carbPct: 45, proteinPct: 30, fatPct: 25 });
  });

  it("keto: 10/35/55 esatti (valore fornito esplicitamente dall'utente)", () => {
    expect(macroSplitForRegime("keto")).toEqual({ carbPct: 10, proteinPct: 35, fatPct: 55 });
  });

  it("mediterraneo: 55/30/15 esatti (valore fornito esplicitamente dall'utente)", () => {
    expect(macroSplitForRegime("mediterraneo")).toEqual({ carbPct: 55, proteinPct: 30, fatPct: 15 });
  });
});
