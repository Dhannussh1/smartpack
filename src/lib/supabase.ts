import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

let client: SupabaseClient | null = null;

/** Browser-only Supabase client (the site is a static export, no server). */
export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  client = createClient(url, key, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // exchanges ?code= on the callback page
    },
  });
  return client;
}

/** Absolute URL of a page inside this app, including the GitHub Pages base path. */
export function appUrl(path: string): string {
  return `${window.location.origin}${BASE_PATH}${path}`;
}
