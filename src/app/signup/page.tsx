"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Store, User } from "lucide-react";

function SignupForm() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "merchant" ? "merchant" : "customer";

  const supabase = createClient();
  const [role, setRole] = useState<"merchant" | "customer">(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          phone: phone || null,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      window.location.assign("/dashboard");
      return;
    }

    setError("Account created. Check your email to confirm your address, then sign in.");
    setLoading(false);
  }

  async function handleGoogleSignup() {
    setGoogleLoading(true);
    setError(null);

    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("role", role);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100 via-[#f6f8f7] to-[#f6f8f7] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-primary-800">Clear dues. Better business.</p>
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold text-primary-700">
            <Store className="h-7 w-7" />
            KhataLink
          </Link>
          <p className="mt-2 text-slate-600">Create your account</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole("merchant")}
            aria-pressed={role === "merchant"}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition ${
              role === "merchant"
                ? "border-primary-500 bg-primary-50 text-primary-800"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            <Store className="h-6 w-6" />
            <span className="text-sm font-semibold">Shop Owner</span>
          </button>
          <button
            type="button"
            onClick={() => setRole("customer")}
            aria-pressed={role === "customer"}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition ${
              role === "customer"
                ? "border-primary-500 bg-primary-50 text-primary-800"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            <User className="h-6 w-6" />
            <span className="text-sm font-semibold">Customer</span>
          </button>
        </div>

        <div className="card space-y-5 p-6 sm:p-8">
          {error && (
            <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading || loading}
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden="true" className="text-lg font-bold text-blue-600">G</span>
            {googleLoading ? "Connecting to Google…" : `Continue with Google as ${role === "merchant" ? "Shop Owner" : "Customer"}`}
          </button>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            OR
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
              <input
                type="text"
                required
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ramesh Kumar"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone (optional)</label>
              <input
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                required
                minLength={6}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
              />
            </div>

            <button type="submit" disabled={loading || googleLoading} className="btn-primary w-full">
              {loading ? "Creating account…" : "Create account with email"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}
