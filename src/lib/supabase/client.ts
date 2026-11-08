import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return { url, key };
}

export function createClient() {
  const { url, key } = getSupabasePublicConfig();
  return createBrowserClient<Database>(url, key);
}
