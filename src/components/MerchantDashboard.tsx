"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Users, IndianRupee, TrendingUp, TrendingDown, Plus, Search } from "lucide-react";
import type { Shop, ShopCustomer, Profile } from "@/types/database";

type CustomerWithProfile = ShopCustomer & {
  profiles: Profile | null;
};

export default function MerchantDashboard({ userId }: { userId: string }) {
  const supabase = createClient();
  const [shop, setShop] = useState<Shop | null>(null);
  const [customers, setCustomers] = useState<CustomerWithProfile[]>([]);
  const [stats, setStats] = useState({
    totalOutstanding: 0,
    todayCredit: 0,
    todayRecoveries: 0,
    activeCustomers: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // Realtime subscription for balance updates
    const channel = supabase
      .channel("merchant-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_customers" },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function loadData() {
    // Get merchant's shop
    const { data: shops } = await supabase
      .from("shops")
      .select("*")
      .eq("owner_id", userId)
      .limit(1);

    if (!shops || shops.length === 0) {
      setLoading(false);
      return;
    }

    const currentShop = shops[0];
    setShop(currentShop);

    // Independent shop-scoped reads run together to avoid a request waterfall.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [customersResult, todayResult] = await Promise.all([
      supabase
        .from("shop_customers")
        .select("*, profiles(*)")
        .eq("shop_id", currentShop.id)
        .order("current_balance", { ascending: false }),
      supabase
        .from("transactions")
        .select("amount, type")
        .eq("shop_id", currentShop.id)
        .gte("created_at", today.toISOString()),
    ]);
    const sc = customersResult.data;
    const todayTx = todayResult.data;
    setCustomers((sc as CustomerWithProfile[]) || []);

    const totalOutstanding =
      sc?.reduce((sum, customer) => sum + Number(customer.current_balance), 0) || 0;
    const activeCustomers = sc?.filter((customer) => customer.status === "active").length || 0;

    let todayCredit = 0;
    let todayRecoveries = 0;
    todayTx?.forEach((t) => {
      if (t.type === "credit") todayCredit += Number(t.amount);
      else todayRecoveries += Number(t.amount);
    });

    setStats({
      totalOutstanding,
      todayCredit,
      todayRecoveries,
      activeCustomers,
    });
    setLoading(false);
  }

  const filtered = customers.filter((c) => {
    const name = c.profiles?.full_name?.toLowerCase() || "";
    const phone = c.profiles?.phone || "";
    const q = search.toLowerCase();
    return name.includes(q) || phone.includes(q);
  });

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading dashboard…</div>;
  }

  if (!shop) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <h2 className="mb-2 text-xl font-bold">Set up your shop</h2>
        <p className="mb-6 text-slate-600">
          Create your shop profile to start tracking customer credit.
        </p>
        <Link href="/dashboard/shop" className="btn-primary">
          Create Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Shop overview</p>
          <h1 className="page-title truncate">{shop.name}</h1>
          <p className="page-subtitle">{shop.category} · This shop only</p>
        </div>
        <Link
          href="/dashboard/entry"
          className="btn-primary gap-2"
        >
          <Plus className="h-5 w-5" />
          New Entry
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <IndianRupee className="h-4 w-4" />
            Outstanding
          </div>
          <p className="mt-1 amount text-2xl text-debit">
            {formatCurrency(stats.totalOutstanding)}
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <TrendingUp className="h-4 w-4" />
            Today Credit
          </div>
          <p className="mt-1 amount text-2xl text-slate-900">
            {formatCurrency(stats.todayCredit)}
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <TrendingDown className="h-4 w-4" />
            Today Recovered
          </div>
          <p className="mt-1 amount text-2xl text-credit">
            {formatCurrency(stats.todayRecoveries)}
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users className="h-4 w-4" />
            Customers
          </div>
          <p className="mt-1 amount text-2xl text-slate-900">
            {stats.activeCustomers}
          </p>
        </div>
      </div>

      {/* Search + list */}
      <div className="card">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search customer by name or phone…"
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            {customers.length === 0
              ? "No customers yet. Share your QR code!"
              : "No matching customers."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/customers/${c.customer_id}`}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {c.profiles?.full_name || "Unknown"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {c.profiles?.phone || "No phone"} · Limit {formatCurrency(c.credit_limit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`amount text-lg ${
                        Number(c.current_balance) > 0 ? "text-debit" : "text-credit"
                      }`}
                    >
                      {formatCurrency(c.current_balance)}
                    </p>
                    <p className="text-xs capitalize text-slate-400">{c.status}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
