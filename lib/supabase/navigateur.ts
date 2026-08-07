"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase côté navigateur. Sert uniquement à la connexion (§12). */
export function clientSupabaseNavigateur() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
