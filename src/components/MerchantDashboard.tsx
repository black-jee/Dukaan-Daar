"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Users, IndianRupee, TrendingUp, TrendingDown, Plus, Search } from "lucide-react";
import type { ShopCustomer, Profile } from "@/types/database";
import { useMerchantShops } from "@/components/MerchantShopProvider";

type CustomerWithProfile = ShopCustomer & { profiles: Profile | null };

export default function MerchantDashboard() {
  const { selectedShop: shop, loading: shopsLoading, error: shopsError, refreshShops } = useMerchantShops();
  const [customers, setCustomers] = useState<CustomerWithProfile[]>([]);
  const [stats, setStats] = useState({
    totalOutstanding: 0,
    todayCredit: 0,
    todayRecoveries: 0,
    activeCustomers: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    setLoadError(null);
    if (!shop) {
      setCustomers([]);
      setStats({ totalOutstanding: 0, todayCredit: 0, todayRecoveries: 0, activeCustomers: 0 });
      setLoading(false);
      return;
    }
    const currentShop = shop;

    // These independent, shop-scoped reads run in parallel.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [customersResult, todayResult] = await Promise.all([
      supabase
        .from("shop_customers")
        .select("*, profiles(full_name, phone)")
        .eq("shop_id", currentShop.id)
        .order("current_balance", { ascending: false }),
      supabase
        .from("transactions")
        .select("amount, type")
        .eq("shop_id", currentShop.id)
        .gte("created_at", today.toISOString()),
    ]);

    if (customersResult.error || todayResult.error) {
      setLoadError("Your shop figures couldn’t be loaded. No balances have been changed. Please retry.");
      setLoading(false);
      return;
    }

    const shopCustomers = customersResult.data || [];
    setCustomers(shopCustomers as CustomerWithProfile[]);

    let todayCredit = 0;
    let todayRecoveries = 0;
    todayResult.data?.forEach((transaction) => {
      if (transaction.type === "credit") todayCredit += Number(transaction.amount);
      else todayRecoveries += Number(transaction.amount);
    });

    setStats({
      totalOutstanding: shopCustomers.reduce((sum, customer) => sum + Number(customer.current_balance), 0),
      todayCredit,
      todayRecoveries,
      activeCustomers: shopCustomers.filter((customer) => customer.status === "active").length,
    });
    setLoading(false);
  }, [shop]);

  useEffect(() => {
    if (shopsLoading) return;
    setLoading(true);
    void loadData();
  }, [loadData, shopsLoading]);

  // Subscribe only after the active shop is known. Shop-scoped filtering keeps
  // activity in unrelated shops from refreshing this dashboard.
  useEffect(() => {
    if (!shop?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`merchant-dashboard-${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shop_customers",
          filter: `shop_id=eq.${shop.id}`,
        },
        () => void loadData()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadData, shop?.id]);

  const filtered = customers.filter((customer) => {
    const name = customer.profiles?.full_name?.toLowerCase() || "";
    const phone = customer.profiles?.phone || "";
    const query = search.toLowerCase();
    return name.includes(query) || phone.includes(query);
  });

  if (shopsLoading || loading) {
    return <div className="space-y-4" aria-live="polite" aria-busy="true"><div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200" /><div className="grid grid-cols-2 gap-3"><div className="h-24 animate-pulse rounded-3xl bg-slate-200" /><div className="h-24 animate-pulse rounded-3xl bg-slate-200" /></div><div className="h-48 animate-pulse rounded-3xl bg-slate-200" /></div>;
  }

  if (loadError) {
    return (
      <section role="alert" className="card mx-auto max-w-lg text-center">
        <h2 className="font-bold text-slate-950">Dashboard temporarily unavailable</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{loadError}</p>
        <button onClick={() => { setLoading(true); void loadData(); }} className="btn-primary mx-auto mt-4">Try again</button>
      </section>
    );
  }

  if (shopsError) {
    return <section role="alert" className="card text-center"><p className="text-slate-700">Shop information is temporarily unavailable. Your balances have not been changed.</p><button onClick={() => void refreshShops()} className="btn-primary mt-4">Retry</button></section>;
  }

  if (!shop) {
    return (
      <div className="card mx-auto max-w-md py-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-800"><IndianRupee className="h-7 w-7" /></div>
        <h2 className="mb-2 text-xl font-bold text-slate-950">Set up your shop</h2>
        <p className="mb-6 text-sm leading-6 text-slate-600">Create your shop profile to start recording customer credit and payments.</p>
        <Link href="/dashboard/shop" className="btn-primary">Create your shop</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Shop overview</p>
          <h1 className="page-title truncate">{shop.name}</h1>
          <p className="page-subtitle">{shop.category} · This shop&apos;s ledger only</p>
        </div>
        <Link href="/dashboard/entry" className="btn-primary min-h-12 shrink-0 gap-2">
          <Plus className="h-5 w-5" /> New entry
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 sm:text-sm"><IndianRupee className="h-4 w-4" /> Outstanding</div>
          <p className="amount mt-2 text-2xl text-rose-700">{formatCurrency(stats.totalOutstanding)}</p>
          <p className="mt-1 text-xs text-slate-500">This shop only</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 sm:text-sm"><TrendingUp className="h-4 w-4" /> Today&apos;s credit</div>
          <p className="amount mt-2 text-2xl text-slate-950">{formatCurrency(stats.todayCredit)}</p>
          <p className="mt-1 text-xs text-slate-500">Added today</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 sm:text-sm"><TrendingDown className="h-4 w-4" /> Recovered</div>
          <p className="amount mt-2 text-2xl text-emerald-700">{formatCurrency(stats.todayRecoveries)}</p>
          <p className="mt-1 text-xs text-slate-500">Received today</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 sm:text-sm"><Users className="h-4 w-4" /> Customers</div>
          <p className="amount mt-2 text-2xl text-slate-950">{stats.activeCustomers}</p>
          <p className="mt-1 text-xs text-slate-500">Active accounts</p>
        </div>
      </div>

      <section className="card">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-950">Your customers</h2>
          <p className="mt-1 text-xs text-slate-500">Balances shown here belong only to {shop.name}.</p>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input type="search" placeholder="Search by name or phone…" aria-label="Search customers by name or phone" className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-semibold text-slate-800">{customers.length === 0 ? "No customers yet" : "No matching customers"}</p>
            <p className="mt-1 text-sm text-slate-500">{customers.length === 0 ? "Share your shop QR code to invite customers." : "Try another name or phone number."}</p>
            {customers.length === 0 && <Link href="/dashboard/qr" className="mt-4 inline-flex text-sm font-semibold text-primary-700">Open shop QR code →</Link>}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((customer) => (
              <li key={customer.id}>
                <Link href={`/dashboard/customers/${customer.customer_id}`} className="flex min-h-16 items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{customer.profiles?.full_name || "Unknown"}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{customer.profiles?.phone || "No phone"} · Limit {formatCurrency(customer.credit_limit)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`amount text-lg ${Number(customer.current_balance) > 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatCurrency(customer.current_balance)}</p>
                    <p className="mt-0.5 text-xs capitalize text-slate-500">{customer.status}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
