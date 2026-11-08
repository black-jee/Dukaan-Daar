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

  // The signup page may request a merchant/customer role. Only apply it to a
  // freshly created OAuth account; never change an existing user's role on login.
  if (requestedRole === "merchant" || requestedRole === "customer") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("id", data.user.id)
      .maybeSingle();

    const userCreatedAt = Date.parse(data.user.created_at);
    const profileCreatedAt = profile?.created_at
      ? Date.parse(profile.created_at)
      : Number.NaN;
    const isNewProfile =
      Number.isFinite(userCreatedAt) &&
      Number.isFinite(profileCreatedAt) &&
      Math.abs(userCreatedAt - profileCreatedAt) <= 60_000;

    if (profileError || !profile) {
      return NextResponse.redirect(new URL("/login?oauth=profile", origin));
    }

    if (isNewProfile) {
      const { error: roleError } = await supabase
        .from("profiles")
        .update({ role: requestedRole })
        .eq("id", data.user.id);

      if (roleError) {
        return NextResponse.redirect(new URL("/login?oauth=profile", origin));
      }
    }
  }

  return NextResponse.redirect(new URL("/dashboard", origin));
}
