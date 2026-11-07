"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Profile, ShopCustomer, Transaction, Shop } from "@/types/database";

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.customerId as string;
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [link, setLink] = useState<ShopCustomer | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [creditLimit, setCreditLimit] = useState("");
  const [status, setStatus] = useState<"active" | "blocked" | "paused">("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [customerId]);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

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
      .select("*")
      .eq("shop_id", shops[0].id)
      .eq("customer_id", customerId)
      .single();

    if (sc) {
      setLink(sc);
      setCreditLimit(String(sc.credit_limit));
      setStatus(sc.status);
    }

    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", customerId)
      .single();
    setProfile(p);

    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("shop_id", shops[0].id)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50);

    setTxs(transactions || []);
    setLoading(false);
  }

  async function updateSettings() {
    if (!link) return;
    const parsedLimit = Number(creditLimit);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 0) {
      setError("Enter a valid non-negative credit limit.");
      return;
    }

    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("shop_customers")
      .update({ credit_limit: parsedLimit, status })
      .eq("id", link.id);

    if (updateError) {
      setError("Could not update customer settings. Please try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    await load();
  }

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading…</div>;
  }

  if (!link || !profile) {
    return <div className="card text-center">Customer not found.</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{profile.full_name}</h1>
          <p className="text-sm text-slate-500">{profile.phone || "No phone"}</p>
        </div>
        <Link
          href={`/dashboard/entry?customer=${customerId}`}
          className="btn-primary"
        >
          New Entry
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card">
          <p className="text-sm text-slate-500">Current Due</p>
          <p
            className={`amount text-3xl ${
              Number(link.current_balance) > 0 ? "text-debit" : "text-credit"
            }`}
          >
            {formatCurrency(link.current_balance)}
          </p>
        </div>
        <div className="card space-y-3">
          <div>
            <label className="text-sm text-slate-500">Credit Limit</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input mt-1"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-500">Status</label>
            <select
              className="input mt-1"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
          <button onClick={updateSettings} disabled={saving} className="btn-outline w-full">
            {saving ? "Saving…" : "Update"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold">Transaction History</h2>
        {txs.length === 0 ? (
          <p className="text-slate-500 text-center py-6">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">
                    {t.type === "credit" ? "Credit given" : "Payment received"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(t.created_at)}
                    {t.note ? ` · ${t.note}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`amount ${
                      t.type === "credit" ? "text-debit" : "text-credit"
                    }`}
                  >
                    {t.type === "credit" ? "+" : "−"}
                    {formatCurrency(t.amount)}
                  </p>
                  <p className="text-xs text-slate-400">
                    Bal: {formatCurrency(t.running_balance)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
