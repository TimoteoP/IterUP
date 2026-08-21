// ============================================================
// IterUp — POST /api/logout
// ------------------------------------------------------------
// Non richiesto esplicitamente dall'addendum di sicurezza, ma
// aggiunto come naturale complemento del login (es. dispositivo
// condiviso/prestato): distrugge il cookie di sessione.
// ============================================================

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
