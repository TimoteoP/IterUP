import { describe, it, expect } from "vitest";
import {
  calculateBMR,
  calculateMaintenanceTDEE,
  calculateTDEE,
  calculateAge,
  ACTIVITY_MULTIPLIERS,
  MODE_KCAL_ADJUSTMENT,
  type ActivityLevel,
  type GoalMode,
} from "../tdee";

const BASE = {
  sex: "m" as const,
  weightKg: 80,
  heightCm: 180,
  age: 30,
  activityLevel: "sedentario" as ActivityLevel,
  mode: "mantenimento" as GoalMode,
  dietaryRegime: "mediterraneo",
};

describe("calculateBMR — Mifflin-St Jeor (1990)", () => {
  it("uomo: 10*peso + 6.25*altezza - 5*età + 5", () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(calculateBMR("m", 80, 180, 30)).toBe(1780);
  });

  it("donna: 10*peso + 6.25*altezza - 5*età - 161", () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 650 + 1031.25 - 150 - 161 = 1370.25
    expect(calculateBMR("f", 65, 165, 30)).toBe(1370.25);
  });
});

describe("ACTIVITY_MULTIPLIERS applicati correttamente al BMR", () => {
  const bmr = calculateBMR("m", 80, 180, 30); // 1780

  for (const [level, multiplier] of Object.entries(ACTIVITY_MULTIPLIERS) as [ActivityLevel, number][]) {
    it(`${level} -> BMR * ${multiplier}`, () => {
      const { tdee } = calculateMaintenanceTDEE("m", 80, 180, 30, level);
      expect(tdee).toBe(Math.round(bmr * multiplier));
    });
  }

  it("i 5 moltiplicatori attesi sono esattamente questi valori", () => {
    expect(ACTIVITY_MULTIPLIERS).toEqual({
      sedentario: 1.2,
      leggero: 1.375,
      moderato: 1.55,
      attivo: 1.725,
      molto_attivo: 1.9,
    });
  });
});

describe("MODE_KCAL_ADJUSTMENT — segno corretto per ciascuna modalità", () => {
  it("dimagrimento è negativo (deficit)", () => {
    expect(MODE_KCAL_ADJUSTMENT.dimagrimento).toBeLessThan(0);
  });
  it("mantenimento è zero", () => {
    expect(MODE_KCAL_ADJUSTMENT.mantenimento).toBe(0);
  });
  it("costruzione_muscolare è positivo (surplus)", () => {
    expect(MODE_KCAL_ADJUSTMENT.costruzione_muscolare).toBeGreaterThan(0);
  });
  it("recupero è positivo (surplus)", () => {
    expect(MODE_KCAL_ADJUSTMENT.recupero).toBeGreaterThan(0);
  });

  it("calculateTDEE applica l'aggiustamento al dailyKcal rispetto al tdee di mantenimento", () => {
    const maintenance = calculateTDEE({ ...BASE, mode: "mantenimento" });
    const loss = calculateTDEE({ ...BASE, mode: "dimagrimento" });
    const gain = calculateTDEE({ ...BASE, mode: "costruzione_muscolare" });

    expect(maintenance.dailyKcal).toBe(maintenance.tdee);
    expect(loss.dailyKcal).toBeLessThan(maintenance.tdee);
    expect(gain.dailyKcal).toBeGreaterThan(maintenance.tdee);
  });
});

describe("calculateAge — casi limite", () => {
  it("compleanno oggi: età corretta, non off-by-one", () => {
    const today = new Date("2026-08-17T12:00:00Z");
    expect(calculateAge("2000-08-17", today)).toBe(26);
  });

  it("compleanno domani (non ancora oggi): un anno in meno", () => {
    const today = new Date("2026-08-17T12:00:00Z");
    expect(calculateAge("2000-08-18", today)).toBe(25);
  });

  it("nato il 29 febbraio: restituisce un numero valido, non NaN", () => {
    const today = new Date("2025-03-01T00:00:00Z");
    const age = calculateAge("2000-02-29", today);
    expect(Number.isFinite(age)).toBe(true);
    expect(age).toBe(25);
  });

  it("data di nascita nel futuro: restituisce un numero (anche negativo), mai NaN", () => {
    const today = new Date("2026-08-17T00:00:00Z");
    const age = calculateAge("2030-01-01", today);
    expect(Number.isFinite(age)).toBe(true);
    expect(age).toBe(-4);
  });
});

describe("Regressione: bug storico ~462g proteine/giorno", () => {
  // Il bug osservato: un peso anomalo inserito per errore (210kg invece di
  // ~75kg) produceva un target proteine assurdo (~462g/giorno) perché la
  // vecchia formula derivava le proteine da un valore g/kg di peso corporeo
  // (peso * 2.2 per dimagrimento). La formula attuale deriva le proteine
  // dalla percentuale di kcal del regime alimentare (macroSplitForRegime),
  // indipendente dal peso: questo test blocca un'eventuale reintroduzione
  // del calcolo g/kg-di-peso.
  it("le proteine non scalano linearmente col peso (niente g/kg)", () => {
    const normal = calculateTDEE({ ...BASE, weightKg: 80, mode: "dimagrimento", dietaryRegime: "keto" });
    const anomalous = calculateTDEE({ ...BASE, weightKg: 210, mode: "dimagrimento", dietaryRegime: "keto" });

    // Vecchia formula bacata: 210 * 2.2 = 462g esatti. Non deve più accadere.
    expect(anomalous.proteinG).not.toBe(Math.round(210 * 2.2));

    // Le proteine restano ~35% delle kcal (split keto) in entrambi i casi,
    // non una funzione diretta del peso corporeo.
    const pctNormal = (normal.proteinG * 4) / normal.dailyKcal;
    const pctAnomalous = (anomalous.proteinG * 4) / anomalous.dailyKcal;
    expect(pctNormal).toBeCloseTo(0.35, 1);
    expect(pctAnomalous).toBeCloseTo(0.35, 1);
  });

  it("split esatto Keto 10/35/55 richiesto dall'utente", () => {
    const r = calculateTDEE({ ...BASE, mode: "dimagrimento", dietaryRegime: "keto" });
    expect((r.carbsG * 4) / r.dailyKcal).toBeCloseTo(0.1, 1);
    expect((r.proteinG * 4) / r.dailyKcal).toBeCloseTo(0.35, 1);
    expect((r.fatG * 9) / r.dailyKcal).toBeCloseTo(0.55, 1);
  });

  it("split esatto Mediterranea 55/30/15 richiesto dall'utente", () => {
    const r = calculateTDEE({ ...BASE, mode: "dimagrimento", dietaryRegime: "mediterraneo" });
    expect((r.carbsG * 4) / r.dailyKcal).toBeCloseTo(0.55, 1);
    expect((r.proteinG * 4) / r.dailyKcal).toBeCloseTo(0.3, 1);
    expect((r.fatG * 9) / r.dailyKcal).toBeCloseTo(0.15, 1);
  });
});
