"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, CreditCard, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PublicShop, ShopCustomer, Transaction } from "@/types/database";

export default function LedgerPage() {
  const params = useParams();
  const shopId = params.shopId as string;
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [link, setLink] = useState<ShopCustomer | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoadError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoadError("Please sign in to view this passbook.");
      setLoading(false);
      return;
    }

    setCustomerId(user.id);
    const [shopResult, linkResult, transactionResult] = await Promise.all([
      supabase.from("public_shops").select("*").eq("id", shopId).maybeSingle(),
      supabase.from("shop_customers").select("*").eq("shop_id", shopId).eq("customer_id", user.id).maybeSingle(),
      supabase.from("transactions").select("*").eq("shop_id", shopId).eq("customer_id", user.id).order("created_at", { ascending: false }).limit(100),
    ]);

    if (shopResult.error || linkResult.error || transactionResult.error) {
      setLoadError("We couldn't load this passbook. Please try again.");
      setLoading(false);
      return;
    }

    setShop(shopResult.data);
    setLink(linkResult.data);
    setTxs(transactionResult.data || []);
    setLoading(false);
  }, [shopId]);

  useEffect(() => {
    const supabase = createClient();
    void load();
    if (!customerId) return;
    const channel = supabase
      .channel(`customer-ledger-${shopId}-${customerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `customer_id=eq.${customerId}` },
        () => void load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_customers", filter: `customer_id=eq.${link?.customer_id || ""}` },
        () => void load()
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [customerId, load, shopId]);

  function openUPI() {
    if (!shop?.upi_id || !link) return;
    const amount = Number(link.current_balance);
    if (amount <= 0) return;
    const upiUrl = `upi://pay?pa=${encodeURIComponent(shop.upi_id)}&pn=${encodeURIComponent(shop.name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Khata payment - " + shop.name)}`;
    window.location.href = upiUrl;
  }

  if (loading) {
    return <div className="space-y-4" aria-live="polite" aria-busy="true"><div className="h-8 w-36 animate-pulse rounded-xl bg-slate-200" /><div className="h-40 animate-pulse rounded-3xl bg-slate-200" /><div className="h-56 animate-pulse rounded-3xl bg-slate-200" /></div>;
  }

  if (loadError || !shop || !link) {
    return (
      <section className="card mx-auto max-w-lg text-center">
        <p className="font-semibold text-slate-900">{loadError || "This shop passbook isn't available."}</p>
        <button onClick={() => { setLoading(true); void load(); }} className="btn-primary mx-auto mt-4">Try again</button>
        <Link href="/dashboard" className="mt-3 inline-block text-sm font-semibold text-primary-700">Back to My Khatas</Link>
      </section>
    );
  }

  const balance = Number(link.current_balance);
  const settled = balance === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-xl pr-3 text-sm font-semibold text-slate-600 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> All my shops
      </Link>

      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-800"><Store className="h-6 w-6" /></div>
        <div className="min-w-0">
          <p className="eyebrow">Separate shop passbook</p>
          <h1 className="page-title truncate">{shop.name}</h1>
          <p className="page-subtitle">{shop.category}{shop.address ? ` · ${shop.address}` : ""}</p>
        </div>
      </header>

      <section className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-lg sm:p-8">
        <p className="text-sm font-medium text-slate-300">{settled ? "No outstanding due at this shop" : "You owe this shop"}</p>
        <p className="amount mt-2 text-4xl sm:text-5xl">{formatCurrency(balance)}</p>
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-300">
          {settled ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <CreditCard className="h-4 w-4 text-amber-300" />}
          {settled ? "Your account with this shop is settled" : "This amount belongs only to this shop"}
        </div>
        {!settled && shop.upi_id && (
          <button onClick={openUPI} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-bold text-slate-950 transition active:scale-[.99] hover:bg-slate-100">
            <CreditCard className="h-5 w-5" /> Pay {formatCurrency(balance)} via UPI
          </button>
        )}
        {!settled && shop.upi_id && (
          <p className="mt-3 text-xs leading-5 text-slate-300">
            UPI opens your payment app. Your passbook changes only after the shop verifies and records the payment.
          </p>
        )}
      </section>

      <section className="card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Passbook</h2>
            <p className="text-xs text-slate-500">Only entries from {shop.name}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{txs.length} entries</span>
        </div>

        {txs.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><CreditCard className="h-5 w-5" /></div>
            <p className="font-semibold text-slate-800">No transactions yet</p>
            <p className="mt-1 text-sm text-slate-500">Entries from this shop will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {txs.map((transaction) => (
              <li key={transaction.id} className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{transaction.is_reversed ? "Reversed entry" : transaction.type === "credit" ? "Credit added" : "Payment recorded"}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(transaction.created_at)}{transaction.note ? ` · ${transaction.note}` : ""}{transaction.is_reversed ? " · Reversed" : ""}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`amount text-lg ${transaction.is_reversed ? "text-slate-400 line-through" : transaction.type === "credit" ? "text-rose-700" : "text-emerald-700"}`}>
                    {transaction.type === "credit" ? "+" : "−"}{formatCurrency(transaction.amount)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">Balance: {formatCurrency(transaction.running_balance)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
