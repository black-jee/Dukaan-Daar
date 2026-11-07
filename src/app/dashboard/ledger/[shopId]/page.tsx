"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Shop, ShopCustomer, Transaction } from "@/types/database";

export default function LedgerPage() {
  const params = useParams();
  const shopId = params.shopId as string;
  const supabase = createClient();

  const [shop, setShop] = useState<Shop | null>(null);
  const [link, setLink] = useState<ShopCustomer | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`ledger-${shopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `shop_id=eq.${shopId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId]);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: s } = await supabase.from("shops").select("*").eq("id", shopId).single();
    setShop(s);

    const { data: sc } = await supabase
      .from("shop_customers")
      .select("*")
      .eq("shop_id", shopId)
      .eq("customer_id", user.id)
      .single();
    setLink(sc);

    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("shop_id", shopId)
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    setTxs(transactions || []);
    setLoading(false);
  }

  function openUPI() {
    if (!shop?.upi_id || !link) return;
    const amount = Number(link.current_balance);
    if (amount <= 0) return;
    // UPI deep link
    const upiUrl = `upi://pay?pa=${encodeURIComponent(shop.upi_id)}&pn=${encodeURIComponent(
      shop.name
    )}&am=${amount}&cu=INR&tn=${encodeURIComponent("Khata payment - " + shop.name)}`;
    window.location.href = upiUrl;
  }

  if (loading) return <div className="py-20 text-center text-slate-500">Loading ledger…</div>;
  if (!shop || !link) return <div className="card text-center">Shop not found or not linked.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{shop.name}</h1>
        <p className="text-sm text-slate-500">{shop.category}</p>
      </div>

      <div className="card bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <p className="text-sm opacity-80">Outstanding balance</p>
        <p className="amount mt-1 text-4xl">{formatCurrency(link.current_balance)}</p>
        {Number(link.current_balance) > 0 && shop.upi_id && (
          <button onClick={openUPI} className="mt-4 w-full rounded-xl bg-white py-3 font-semibold text-slate-900">
            Pay Dues via UPI
          </button>
        )}
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold">Passbook</h2>
        {txs.length === 0 ? (
          <p className="py-8 text-center text-slate-500">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">
                    {t.type === "credit" ? "Credit" : "Payment"}
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
