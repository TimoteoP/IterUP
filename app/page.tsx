import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { CURRENT_USER_ID } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: profile } = await supabaseServer
    .from("profiles")
    .select("id")
    .eq("id", CURRENT_USER_ID)
    .maybeSingle();

  redirect(profile ? "/diario" : "/onboarding");
}
