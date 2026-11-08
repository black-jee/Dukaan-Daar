import { createServerClient } from "@supabase/ssr";
import { cache } from "react";
import { cookies } from "next/headers";
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

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabasePublicConfig();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components cannot write cookies; middleware refreshes sessions.
        }
      },
    },
  });
}

// Layout and page Server Components share this request-scoped lookup.
// React cache deduplicates the auth/profile round trips during one render.
export const getDashboardContext = cache(async () => {
  const supabase = await createClient();

  // Middleware still calls getUser() to refresh/validate the session cookie.
  // On the server render, verify the refreshed JWT through getClaims() rather
  // than making a second Auth user-info request on every dashboard navigation.
  // getClaims verifies the token (using cached JWKS where supported); RLS still
  // authorizes all subsequent database reads and writes independently.
  const { data: claims } = await supabase.auth.getClaims();

  if (!claims?.sub) {
    return { user: null, profile: null };
  }

  const user = { id: claims.sub };
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile };
});
