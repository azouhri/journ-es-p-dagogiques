"use server";

import { redirect } from "next/navigation";

import { clientSupabaseServeur } from "@/lib/supabase/serveur";

export async function seDeconnecter() {
  const supabase = await clientSupabaseServeur();
  await supabase.auth.signOut();
  redirect("/connexion");
}
