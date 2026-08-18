import { describe, it, expect } from "vitest";
import {
  calculateNavyBF,
  calculateFatMass,
  calculateEnergyBalance,
  calculateRecompositionIndex,
  calculateEnergyScore,
  determineDirection,
  daysBetween,
} from "../composition";

describe("calculateNavyBF — formula Navy (Hodgdon & Beckett, 1984)", () => {
  it("uomo: altezza 180cm, collo 38cm, vita 85cm -> ~16.1% (verificato contro calcolatrici Navy pubbliche, range atteso 15-16%)", () => {
    const bf = calculateNavyBF({ sex: "m", waistCm: 85, neckCm: 38, heightCm: 180 });
    expect(bf).toBeCloseTo(16.1, 0);
  });

  it("donna: altezza 165cm, collo 32cm, vita 75cm, fianchi 95cm -> ~27.4%", () => {
    const bf = calculateNavyBF({ sex: "f", waistCm: 75, neckCm: 32, heightCm: 165, hipCm: 95 });
    expect(bf).toBeCloseTo(27.4, 0);
  });

  it("donna senza fianchi: lancia un errore esplicito (dato obbligatorio mancante)", () => {
    expect(() => calculateNavyBF({ sex: "f", waistCm: 75, neckCm: 32, heightCm: 165 })).toThrow();
  });

  it("uomo con vita <= collo: lancia un errore esplicito (log10 di un numero non positivo)", () => {
    expect(() => calculateNavyBF({ sex: "m", waistCm: 35, neckCm: 38, heightCm: 180 })).toThrow();
  });
});

describe("calculateFatMass", () => {
  it("FM/FFM sommano sempre al peso totale", () => {
    const { fm, ffm } = calculateFatMass(80, 20);
    expect(fm).toBeCloseTo(16, 5);
    expect(ffm).toBeCloseTo(64, 5);
    expect(fm + ffm).toBeCloseTo(80, 5);
  });
});

describe("calculateEnergyBalance — Wishnofsky (1958)", () => {
  it("2000 tdee * 7 giorni, 12000 kcal ingerite -> bilancio -2000, Δpeso atteso -0.26kg", () => {
    const r = calculateEnergyBalance({ tdee: 2000, days: 7, kcalPeriod: 12000 });
    expect(r.maintenancePeriod).toBe(14000);
    expect(r.balance).toBe(-2000);
    expect(r.expectedDeltaWeightKg).toBeCloseTo(-2000 / 7700, 5);
  });
});

describe("calculateRecompositionIndex", () => {
  it("guadagno FFM + perdita FM + percezione positiva -> IR alto, comp_score clampato a 1", () => {
    const r = calculateRecompositionIndex({ ffmNow: 61, ffmPrev: 60, fmNow: 14, fmPrev: 15, neckFeel: 1, wristFeel: 1 });
    expect(r.irRaw).toBe(2); // (61-60) - (14-15) = 1 - (-1) = 2
    expect(r.qualNudge).toBeCloseTo(0.25, 5); // 1*0.15 + 1*0.1
    expect(r.compScoreRaw).toBeCloseTo(2.25, 5);
    expect(r.compScore).toBe(1); // clamp(2.25/1.5, -1, 1)
  });
});

describe("calculateEnergyScore", () => {
  it("con bilancio noto: normalizzato su maintenancePeriod * 0.15", () => {
    const score = calculateEnergyScore({ balance: -2000, maintenancePeriod: 14000, weightNow: 74, weightPrev: 75 });
    expect(score).toBeCloseTo(-2000 / 2100, 5);
  });

  it("senza bilancio: fallback sul delta peso / 1.5", () => {
    const score = calculateEnergyScore({ balance: null, maintenancePeriod: null, weightNow: 74, weightPrev: 75.5 });
    expect(score).toBeCloseTo((74 - 75.5) / 1.5, 5);
  });
});

describe("determineDirection — le 5 zone + ambigua, nell'ordine dell'addendum", () => {
  it("Ricomposizione ideale: deficit + comp_score_raw > 0.05", () => {
    const r = determineDirection({ compScoreRaw: 0.5, balance: -1000, maintenancePeriod: 20000, weightNow: 74, weightPrev: 75 });
    expect(r.zone).toBe("ricomposizione_ideale");
    expect(r.isWarning).toBe(false);
  });

  it("Bulk pulito: surplus + comp_score_raw > 0.05", () => {
    const r = determineDirection({ compScoreRaw: 0.5, balance: 2000, maintenancePeriod: 20000, weightNow: 76, weightPrev: 75 });
    expect(r.zone).toBe("bulk_pulito");
  });

  it("Accumulo di grasso: surplus + comp_score_raw < -0.05", () => {
    const r = determineDirection({ compScoreRaw: -0.5, balance: 2000, maintenancePeriod: 20000, weightNow: 76, weightPrev: 75 });
    expect(r.zone).toBe("accumulo_grasso");
  });

  it("Perdita muscolare: deficit + comp_score_raw < -0.05, e va segnalata come warning", () => {
    const r = determineDirection({ compScoreRaw: -0.5, balance: -2000, maintenancePeriod: 20000, weightNow: 74, weightPrev: 75 });
    expect(r.zone).toBe("perdita_muscolare");
    expect(r.isWarning).toBe(true);
  });

  it("Mantenimento stabile: comp_score_raw quasi zero + bilancio entro il 5% del mantenimento", () => {
    const r = determineDirection({ compScoreRaw: 0.02, balance: 500, maintenancePeriod: 20000, weightNow: 75, weightPrev: 75 });
    expect(r.zone).toBe("mantenimento_stabile");
  });

  it("Direzione ambigua: nessuna condizione soddisfatta (bilancio ignoto, peso invariato)", () => {
    const r = determineDirection({ compScoreRaw: 0.5, balance: null, maintenancePeriod: null, weightNow: 75, weightPrev: 75 });
    expect(r.zone).toBe("ambigua");
  });

  it("senza bilancio noto, la direzione deficit/surplus deriva dal peso", () => {
    const r = determineDirection({ compScoreRaw: 0.5, balance: null, maintenancePeriod: null, weightNow: 74, weightPrev: 75 });
    expect(r.zone).toBe("ricomposizione_ideale");
  });
});

describe("daysBetween", () => {
  it("7 giorni esatti", () => {
    expect(daysBetween("2026-01-01", "2026-01-08")).toBe(7);
  });
  it("stessa data: minimo 1 giorno (mai zero, evita divisioni degeneri)", () => {
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(1);
  });
});
