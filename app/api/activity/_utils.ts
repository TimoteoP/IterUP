// ============================================================
// IterUp — utility condivise dal modulo Attività Fisica (A6)
// ------------------------------------------------------------
// Non è una route (niente "route.ts"), Next.js la ignora nel routing.
// ============================================================

import { NextResponse } from "next/server";
import type { Tables } from "@/lib/types";

/** Data odierna in formato YYYY-MM-DD, in timezone locale del server. */
export function todayISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export type ActivityLog = Tables<"activity_logs">;

/** Payload condiviso da ingest (webhook) e create (form manuale). */
export interface ActivityPayload {
  steps?: number;
  workout_type?: string;
  workout_minutes?: number;
  calories_burned?: number;
  recorded_at?: string;
  source?: string;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
