import { describe, it, expect } from "vitest";
import { calculateStreak } from "../streak";

describe("calculateStreak", () => {
  it("nessun log: streak 0", () => {
    expect(calculateStreak(new Map(), "2026-08-18")).toBe(0);
  });

  it("oggi completato + 2 giorni precedenti completati: streak 3", () => {
    const m = new Map([
      ["2026-08-18", true],
      ["2026-08-17", true],
      ["2026-08-16", true],
    ]);
    expect(calculateStreak(m, "2026-08-18")).toBe(3);
  });

  it("oggi non ancora loggato: non spezza lo streak, conta da ieri", () => {
    const m = new Map([
      ["2026-08-17", true],
      ["2026-08-16", true],
    ]);
    expect(calculateStreak(m, "2026-08-18")).toBe(2);
  });

  it("oggi loggato ma non completato: streak azzerato anche se ieri era completato", () => {
    const m = new Map([
      ["2026-08-18", false],
      ["2026-08-17", true],
    ]);
    expect(calculateStreak(m, "2026-08-18")).toBe(0);
  });

  it("un buco nello storico interrompe lo streak", () => {
    const m = new Map([
      ["2026-08-18", true],
      // 17 mancante: buco
      ["2026-08-16", true],
    ]);
    expect(calculateStreak(m, "2026-08-18")).toBe(1);
  });
});
