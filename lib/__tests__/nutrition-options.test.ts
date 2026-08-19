import { describe, it, expect } from "vitest";
import { DIETARY_REGIME_PRESETS, macroSplitForRegime, isValidMacroSplit } from "../nutrition-options";

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

  it("regime custom con uno split valido fornito: usa lo split custom, non il fallback", () => {
    const custom = { carbPct: 10, proteinPct: 40, fatPct: 50 };
    expect(macroSplitForRegime("digiuno integrato", custom)).toEqual(custom);
  });

  it("regime custom con uno split invalido fornito (somma != 100): usa il fallback bilanciato", () => {
    const invalid = { carbPct: 10, proteinPct: 40, fatPct: 40 };
    expect(macroSplitForRegime("digiuno integrato", invalid)).toEqual({ carbPct: 45, proteinPct: 30, fatPct: 25 });
  });

  it("un preset noto ignora sempre lo split custom, anche se fornito", () => {
    const custom = { carbPct: 1, proteinPct: 1, fatPct: 98 };
    expect(macroSplitForRegime("keto", custom)).toEqual({ carbPct: 10, proteinPct: 35, fatPct: 55 });
  });
});

describe("isValidMacroSplit", () => {
  it("split che somma esattamente a 100: valido", () => {
    expect(isValidMacroSplit({ carbPct: 10, proteinPct: 35, fatPct: 55 })).toBe(true);
  });

  it("split che non somma a 100: non valido", () => {
    expect(isValidMacroSplit({ carbPct: 10, proteinPct: 35, fatPct: 40 })).toBe(false);
  });

  it("valori negativi: non valido", () => {
    expect(isValidMacroSplit({ carbPct: -10, proteinPct: 55, fatPct: 55 })).toBe(false);
  });

  it("campi mancanti o non numerici: non valido", () => {
    expect(isValidMacroSplit({ carbPct: 10, proteinPct: 35 })).toBe(false);
    expect(isValidMacroSplit(null)).toBe(false);
    expect(isValidMacroSplit("keto")).toBe(false);
  });
});
