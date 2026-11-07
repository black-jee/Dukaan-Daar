"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { Shop, ShopCustomer, Profile } from "@/types/database";
import { Suspense } from "react";

const PRESETS = [10, 20, 50, 100, 200, 500];

type CustomerWithProfile = ShopCustomer & { profiles: Profile | null };

function EntryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomer = searchParams.get("customer");

  const supabase = createClient();
  const [shop, setShop] = useState<Shop | null>(null);
  const [customers, setCustomers] = useState<CustomerWithProfile[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomer || "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState<"credit" | "payment">("credit");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: shops } = await supabase
      .from("shops")
      .select("*")
      .eq("owner_id", user.id)
      .limit(1);

    if (!shops?.[0]) {
      setLoading(false);
      return;
    }
    setShop(shops[0]);

    const { data: sc } = await supabase
      .from("shop_customers")
      .select("*, profiles(*)")
      .eq("shop_id", shops[0].id)
      .eq("status", "active")
      .order("profiles(full_name)");

    setCustomers((sc as CustomerWithProfile[]) || []);
    setLoading(false);
  }

  const selected = customers.find((c) => c.customer_id === selectedCustomerId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shop || !selectedCustomerId || !amount) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const requestKey = idempotencyKey || globalThis.crypto.randomUUID();
    setIdempotencyKey(requestKey);

    const { error } = await supabase.rpc("add_transaction", {
      p_shop_id: shop.id,
      p_customer_id: selectedCustomerId,
      p_amount: Number(amount),
      p_type: type,
      p_idempotency_key: requestKey,
      p_note: note || null,
    });

    if (error) {
      setError(error.message);
    } else {
      setIdempotencyKey(globalThis.crypto.randomUUID());
      setSuccess(true);
      // Haptic / sound feedback simulation
      if (navigator.vibrate) navigator.vibrate(50);
      setTimeout(() => {
        router.push("/dashboard");
      }, 800);
    }
    setSubmitting(false);
  }

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading…</div>;
  }

  if (!shop) {
    return (
      <div className="card text-center">
        <p>Create a shop first.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">Quick Entry</h1>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            Entry saved! Balance updated.
          </div>
        )}

        {/* Customer select */}
        <div>
          <label className="mb-1 block text-sm font-medium">Customer *</label>
          <select
            required
            className="input"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.customer_id} value={c.customer_id}>
                {c.profiles?.full_name || "Unknown"} — Due {formatCurrency(c.current_balance)}
              </option>
            ))}
          </select>
          {selected && (
            <p className="mt-1 text-xs text-slate-500">
              Limit: {formatCurrency(selected.credit_limit)} · Current:{" "}
              {formatCurrency(selected.current_balance)}
            </p>
          )}
        </div>

        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setType("credit")}
            className={`rounded-xl py-3 font-semibold transition ${
              type === "credit"
                ? "bg-debit text-white shadow-md"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            उधार दिया
            <br />
            <span className="text-xs font-normal">Gave Credit</span>
          </button>
          <button
            type="button"
            onClick={() => setType("payment")}
            className={`rounded-xl py-3 font-semibold transition ${
              type === "payment"
                ? "bg-credit text-white shadow-md"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            जमा लिया
            <br />
            <span className="text-xs font-normal">Received Payment</span>
          </button>
        </div>

        {/* Amount presets */}
        <div>
          <label className="mb-2 block text-sm font-medium">Amount *</label>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={`rounded-xl py-3 text-lg font-bold transition ${
                  amount === String(p)
                    ? "bg-primary-600 text-white"
                    : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}
              >
                ₹{p}
              </button>
            ))}
          </div>
          <input
            type="number"
            required
            min="1"
            step="1"
            className="input text-center text-2xl amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Custom amount"
          />
        </div>

        {/* Note */}
        <div>
          <label className="mb-1 block text-sm font-medium">Note (optional)</label>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tea x2 + Smoke, Cold Drink…"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !selectedCustomerId || !amount}
          className={`w-full py-4 text-lg ${
            type === "credit" ? "btn-debit" : "btn-credit"
          }`}
        >
          {submitting
            ? "Saving…"
            : type === "credit"
            ? `Add ₹${amount || 0} Credit`
            : `Record ₹${amount || 0} Payment`}
        </button>
      </form>
    </div>
  );
}

export default function EntryPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center">Loading…</div>}>
      <EntryForm />
    </Suspense>
  );
}
