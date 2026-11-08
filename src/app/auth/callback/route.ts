import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedRole = requestUrl.searchParams.get("role");
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/login?oauth=failed", origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?oauth=failed", origin));
  }

  // A database-created, one-time claim exists only for a newly inserted Google
  // Auth user. Existing Google accounts have no claim, so their role is never
  // changed by a login callback, even if a role query parameter is supplied.
  if (requestedRole === "merchant" || requestedRole === "customer") {
    const { error: roleError } = await supabase.rpc(
      "claim_google_signup_role",
      { p_role: requestedRole }
    );

    if (roleError) {
      return NextResponse.redirect(new URL("/login?oauth=profile", origin));
    }
  }

  return NextResponse.redirect(new URL("/dashboard", origin));
}
