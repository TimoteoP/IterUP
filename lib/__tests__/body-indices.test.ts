import { describe, it, expect } from "vitest";
import { calculateBMI, bmiCategory, calculateBodyIndex, type BodyMetricPoint } from "../body-indices";

describe("calculateBMI", () => {
  it("70kg / 175cm -> 22.9", () => {
    expect(calculateBMI(70, 175)).toBe(22.9);
  });
  it("100kg / 180cm -> 30.9", () => {
    expect(calculateBMI(100, 180)).toBe(30.9);
  });
});

describe("bmiCategory — soglie OMS", () => {
  it("sottopeso sotto 18.5", () => {
    expect(bmiCategory(18.4)).toBe("sottopeso");
  });
  it("normopeso 18.5-24.9", () => {
    expect(bmiCategory(18.5)).toBe("normopeso");
    expect(bmiCategory(24.9)).toBe("normopeso");
  });
  it("sovrappeso 25-29.9", () => {
    expect(bmiCategory(25)).toBe("sovrappeso");
    expect(bmiCategory(29.9)).toBe("sovrappeso");
  });
  it("obesità da 30 in su", () => {
    expect(bmiCategory(30)).toBe("obesità");
  });
});

describe("calculateBodyIndex — Indice Corporeo IterUp", () => {
  it("primo giorno con tutte le metriche: indice = 100 (baseline)", () => {
    const history: BodyMetricPoint[] = [
      { date: "2026-01-01", weightKg: 80, waistCm: 90, thighCm: 55, neckCm: 38, chestCm: 100 },
    ];
    const result = calculateBodyIndex(history);
    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(100);
  });

  it("secondo giorno: media pesata corretta (vita 35% / peso 30% / coscia 15% / collo 12% / petto 8%)", () => {
    const history: BodyMetricPoint[] = [
      { date: "2026-01-01", weightKg: 80, waistCm: 90, thighCm: 55, neckCm: 38, chestCm: 100 },
      { date: "2026-01-08", weightKg: 79, waistCm: 88, thighCm: 54.5, neckCm: 37.8, chestCm: 99 },
    ];
    const result = calculateBodyIndex(history);
    expect(result).toHaveLength(2);
    // Calcolato a mano: vita 88/90*100*0.35 + peso 79/80*100*0.30 +
    // coscia 54.5/55*100*0.15 + collo 37.8/38*100*0.12 + petto 99/100*100*0.08
    expect(result[1].index).toBeCloseTo(98.57, 1);
  });

  it("giorno con una sola metrica disponibile: rinormalizza sui pesi delle metriche presenti", () => {
    const history: BodyMetricPoint[] = [
      { date: "2026-01-01", weightKg: 80, waistCm: null, thighCm: null, neckCm: null, chestCm: null },
      { date: "2026-01-08", weightKg: 76, waistCm: null, thighCm: null, neckCm: null, chestCm: null },
    ];
    const result = calculateBodyIndex(history);
    // Con solo il peso disponibile, l'indice coincide con il rapporto del
    // peso da solo (rinormalizzato), non con una media diluita dagli 0.
    expect(result[1].index).toBeCloseTo((76 / 80) * 100, 1);
  });

  it("baseline per metrica = primo valore NON NULLO di quella metrica, non della riga", () => {
    const history: BodyMetricPoint[] = [
      { date: "2026-01-01", weightKg: 80, waistCm: null, thighCm: null, neckCm: null, chestCm: null },
      { date: "2026-01-08", weightKg: 79, waistCm: 90, thighCm: null, neckCm: null, chestCm: null },
      { date: "2026-01-15", weightKg: 78, waistCm: 88, thighCm: null, neckCm: null, chestCm: null },
    ];
    const result = calculateBodyIndex(history);
    // La vita compare per la prima volta l'8 gennaio (90cm): quello è il suo
    // baseline (100), non il 1 gennaio dove waistCm è null.
    const weightPct = 0.3;
    const waistPct = 0.35;
    const day2Expected = ((79 / 80) * 100 * weightPct + 100 * waistPct) / (weightPct + waistPct);
    expect(result[1].index).toBeCloseTo(day2Expected, 1);
  });

  it("giorno senza nessuna metrica disponibile viene escluso dal risultato", () => {
    const history: BodyMetricPoint[] = [
      { date: "2026-01-01", weightKg: 80, waistCm: null, thighCm: null, neckCm: null, chestCm: null },
      { date: "2026-01-08", weightKg: null, waistCm: null, thighCm: null, neckCm: null, chestCm: null },
    ];
    const result = calculateBodyIndex(history);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-01-01");
  });
});
