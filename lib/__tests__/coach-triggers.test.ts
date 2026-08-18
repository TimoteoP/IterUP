import { describe, it, expect } from "vitest";
import {
  detectWeightPlateau,
  detectHungerPattern,
  detectHabitMissed,
  detectGoalDelayed,
  detectMealOverTarget,
  detectStreakMilestone,
} from "../coach-triggers";

describe("detectWeightPlateau", () => {
  it("meno di 3 punti: nessun trigger", () => {
    const history = [
      { recorded_at: "2026-08-10", weight_kg: 80 },
      { recorded_at: "2026-08-17", weight_kg: 79.9 },
    ];
    expect(detectWeightPlateau(history, "2026-08-18")).toBeNull();
  });

  it("calo netto (>0.15kg/settimana): nessun trigger, non è un plateau", () => {
    const history = [
      { recorded_at: "2026-08-04", weight_kg: 82 },
      { recorded_at: "2026-08-11", weight_kg: 80.5 },
      { recorded_at: "2026-08-18", weight_kg: 79 },
    ];
    expect(detectWeightPlateau(history, "2026-08-18")).toBeNull();
  });

  it("aumento netto: nessun trigger", () => {
    const history = [
      { recorded_at: "2026-08-04", weight_kg: 79 },
      { recorded_at: "2026-08-11", weight_kg: 80 },
      { recorded_at: "2026-08-18", weight_kg: 81 },
    ];
    expect(detectWeightPlateau(history, "2026-08-18")).toBeNull();
  });

  it("peso stabile su 3+ settimane: trigger", () => {
    const history = [
      { recorded_at: "2026-08-04", weight_kg: 80 },
      { recorded_at: "2026-08-11", weight_kg: 79.95 },
      { recorded_at: "2026-08-18", weight_kg: 79.9 },
    ];
    const result = detectWeightPlateau(history, "2026-08-18");
    expect(result?.triggerType).toBe("weight_plateau");
    expect(result?.data.pointsUsed).toBe(3);
  });

  it("span troppo corto anche con 3 punti: nessun trigger", () => {
    const history = [
      { recorded_at: "2026-08-16", weight_kg: 80 },
      { recorded_at: "2026-08-17", weight_kg: 79.98 },
      { recorded_at: "2026-08-18", weight_kg: 79.95 },
    ];
    expect(detectWeightPlateau(history, "2026-08-18")).toBeNull();
  });
});

describe("detectHungerPattern", () => {
  it("meno di 3 giorni distinti nella stessa fascia: nessun trigger", () => {
    const timestamps = [
      "2026-08-10T16:30:00Z",
      "2026-08-11T16:45:00Z",
    ];
    expect(detectHungerPattern(timestamps)).toBeNull();
  });

  it("3+ giorni distinti nella stessa fascia oraria: trigger", () => {
    const timestamps = [
      "2026-08-10T16:30:00Z",
      "2026-08-11T16:45:00Z",
      "2026-08-12T17:10:00Z",
    ];
    const result = detectHungerPattern(timestamps);
    expect(result?.triggerType).toBe("hunger_pattern");
    expect(result?.data.hourBucketStart).toBe(16);
    expect(result?.data.daysCount).toBe(3);
  });

  it("più spuntini nello stesso giorno contano come un solo giorno per la fascia", () => {
    const timestamps = [
      "2026-08-10T16:00:00Z",
      "2026-08-10T16:50:00Z",
      "2026-08-11T16:10:00Z",
    ];
    expect(detectHungerPattern(timestamps)).toBeNull();
  });

  it("nessuno spuntino: nessun trigger", () => {
    expect(detectHungerPattern([])).toBeNull();
  });
});

describe("detectHabitMissed", () => {
  it("tutte le abitudini attive loggate ieri: nessun trigger", () => {
    const habits = [{ id: "h1", name: "Meditazione" }];
    const logged = new Set(["h1"]);
    expect(detectHabitMissed(habits, logged, new Set(), "2026-08-17")).toBeNull();
  });

  it("un'abitudine non loggata ieri e mai segnalata: trigger", () => {
    const habits = [{ id: "h1", name: "Meditazione" }];
    const result = detectHabitMissed(habits, new Set(), new Set(), "2026-08-17");
    expect(result?.triggerType).toBe("habit_missed");
    expect(result?.data.habitId).toBe("h1");
  });

  it("abitudine già segnalata di recente: nessun trigger ripetuto", () => {
    const habits = [{ id: "h1", name: "Meditazione" }];
    const result = detectHabitMissed(habits, new Set(), new Set(["h1"]), "2026-08-17");
    expect(result).toBeNull();
  });
});

describe("detectGoalDelayed", () => {
  it("progresso in linea col ritmo atteso: nessun trigger", () => {
    const goal = { id: "g1", title: "Perdere 5kg", targetDate: "2026-09-17", createdAtIso: "2026-08-18" };
    // metà del periodo trascorsa (15 giorni su 30), progresso al 50%: in linea.
    const result = detectGoalDelayed(goal, 50, "2026-09-02");
    expect(result).toBeNull();
  });

  it("progresso molto indietro rispetto al ritmo atteso: trigger", () => {
    const goal = { id: "g1", title: "Perdere 5kg", targetDate: "2026-09-17", createdAtIso: "2026-08-18" };
    const result = detectGoalDelayed(goal, 10, "2026-09-02");
    expect(result?.triggerType).toBe("goal_delayed");
    expect(result?.data.goalId).toBe("g1");
  });

  it("goal già scaduto: nessun trigger (fuori scope di questo pattern)", () => {
    const goal = { id: "g1", title: "Perdere 5kg", targetDate: "2026-08-01", createdAtIso: "2026-07-01" };
    expect(detectGoalDelayed(goal, 10, "2026-08-18")).toBeNull();
  });
});

describe("detectMealOverTarget", () => {
  it("meno di 14 giorni di storico: nessun trigger anche se sopra soglia", () => {
    expect(detectMealOverTarget(2500, 2000, 5)).toBeNull();
  });

  it("con baseline sufficiente e sopra soglia: trigger", () => {
    const result = detectMealOverTarget(2400, 2000, 20);
    expect(result?.triggerType).toBe("meal_over_target");
    expect(result?.data.pctOver).toBe(20);
  });

  it("con baseline sufficiente ma sotto soglia: nessun trigger", () => {
    expect(detectMealOverTarget(2100, 2000, 20)).toBeNull();
  });
});

describe("detectStreakMilestone", () => {
  it("streak su una milestone (7): trigger", () => {
    const result = detectStreakMilestone("h1", "Meditazione", 7);
    expect(result?.triggerType).toBe("streak_milestone");
    expect(result?.data.streakDays).toBe(7);
  });

  it("streak fuori milestone (8): nessun trigger", () => {
    expect(detectStreakMilestone("h1", "Meditazione", 8)).toBeNull();
  });

  it("streak su 30: trigger", () => {
    expect(detectStreakMilestone("h1", "Meditazione", 30)?.triggerType).toBe("streak_milestone");
  });
});
