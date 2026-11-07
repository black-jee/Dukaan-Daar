"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Store, User } from "lucide-react";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = (searchParams.get("role") as "merchant" | "customer") || "customer";

  const supabase = createClient();
  const [role, setRole] = useState<"merchant" | "customer">(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
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

    // A user may exist without an active session when email confirmation is enabled.
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setError("Account created. Check your email to confirm your address, then sign in.");
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold text-primary-700">
            <Store className="h-7 w-7" />
            KhataLink
          </Link>
          <p className="mt-2 text-slate-600">Create your account</p>
        </div>

        {/* Role toggle */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole("merchant")}
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

        <form onSubmit={handleSignup} className="card space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Full Name
            </label>
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
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
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
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Phone (optional)
            </label>
            <input
              type="tel"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
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

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

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
