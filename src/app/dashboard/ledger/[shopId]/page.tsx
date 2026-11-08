"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [paymentAmount, setPaymentAmount] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    const supabase = createClient();
    setLoadError(null);
    // This is a browser-side identity hint only. Every ledger query remains
    // protected by Supabase RLS, which validates the signed access token.
    // Reading the already-held session avoids an extra Auth network round trip
    // before the three independent, shop-scoped reads below.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const user = session?.user;
    if (request !== requestId.current) return;
    if (sessionError || !user) {
      setCustomerId(null);
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

    if (request !== requestId.current) return;
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
    setLoading(true);
    setShop(null);
    setLink(null);
    setTxs([]);
    setCustomerId(null);
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (!customerId) return;
    const supabase = createClient();
    const refreshForThisShop = (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
      // Realtime is filtered by customer because Postgres Changes accepts one
      // server-side filter here. Ignore other-shop events in the client.
      // For DELETE events where replica identity omits shop_id, fall back to
      // refreshing rather than risk missing a legitimate ledger change.
      const changedShopId = payload.new.shop_id ?? payload.old.shop_id;
      if (typeof changedShopId === "string" && changedShopId !== shopId) return;
      void load();
    };
    const channel = supabase
      .channel(`customer-ledger-${shopId}-${customerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `customer_id=eq.${customerId}` },
        refreshForThisShop
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_customers", filter: `customer_id=eq.${customerId}` },
        refreshForThisShop
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [customerId, load, shopId]);

  useEffect(() => {
    const balance = Number(link?.current_balance ?? 0);
    if (balance <= 0) {
      setPaymentAmount("");
      return;
    }
    setPaymentAmount((current) => {
      const parsed = Number(current);
      return !current || !Number.isFinite(parsed) || parsed <= 0 || parsed > balance
        ? balance.toFixed(2)
        : current;
    });
  }, [link?.current_balance]);

  function openUPI() {
    if (!shop?.upi_id || !link) return;
    const balance = Number(link.current_balance);
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) return;
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
          <div className="mt-6 space-y-3">
            <label htmlFor="payment-amount" className="block text-sm font-semibold text-slate-200">How much would you like to pay?</label>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-slate-300">₹</span>
              <input id="payment-amount" type="number" inputMode="decimal" min="0.01" max={balance.toFixed(2)} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} aria-describedby="payment-amount-help" className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-lg font-semibold text-white outline-none focus:border-white focus:ring-2 focus:ring-white/30" />
              <button type="button" onClick={() => setPaymentAmount(balance.toFixed(2))} className="min-h-12 rounded-xl border border-slate-600 px-3 text-sm font-semibold text-slate-200 hover:bg-slate-800">Full</button>
            </div>
            <p id="payment-amount-help" className="text-xs text-slate-300">Pay any amount up to {formatCurrency(balance)}. You can clear the rest later.</p>
            <button onClick={openUPI} disabled={!Number.isFinite(Number(paymentAmount)) || Number(paymentAmount) <= 0 || Number(paymentAmount) > balance} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-bold text-slate-950 transition active:scale-[.99] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
              <CreditCard className="h-5 w-5" /> Pay {formatCurrency(Number(paymentAmount) || 0)} via UPI
            </button>
            <p className="text-xs leading-5 text-slate-300">UPI opens your payment app. Your passbook changes only after the shop verifies and records the payment. For cash, pay the shopkeeper and ask them to record the amount you paid.</p>
          </div>
        )}
        {!settled && !shop.upi_id && (
          <p className="mt-6 text-sm leading-5 text-slate-300">You can pay any part of this due directly to the shopkeeper in cash. Ask them to record the amount received; your passbook updates after they record it.</p>
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
