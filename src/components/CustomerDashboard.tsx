"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Store, Search } from "lucide-react";
import type { Shop, ShopCustomer } from "@/types/database";

type LinkedShop = ShopCustomer & {
  shops: Shop | null;
};

export default function CustomerDashboard({ userId }: { userId: string }) {
  const supabase = createClient();
  const [links, setLinks] = useState<LinkedShop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("customer-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_customers", filter: `customer_id=eq.${userId}` },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions", filter: `customer_id=eq.${userId}` },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function loadData() {
    const { data } = await supabase
      .from("shop_customers")
      .select("*, shops(*)")
      .eq("customer_id", userId)
      .order("current_balance", { ascending: false });

    setLinks((data as LinkedShop[]) || []);
    setLoading(false);
  }

  const totalDue = links.reduce((sum, l) => sum + Number(l.current_balance), 0);

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading your khatas…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Khatas</h1>
          <p className="text-sm text-slate-500">
            {links.length} shop{links.length !== 1 ? "s" : ""} linked
          </p>
        </div>
        <Link href="/dashboard/discover" className="btn-outline gap-2">
          <Search className="h-4 w-4" />
          Find Shops
        </Link>
      </div>

      {/* Total */}
      <div className="card bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <p className="text-sm opacity-90">Total outstanding across all shops</p>
        <p className="amount mt-1 text-3xl">{formatCurrency(totalDue)}</p>
      </div>

      {links.length === 0 ? (
        <div className="card text-center">
          <Store className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <h3 className="mb-2 font-semibold">No shops linked yet</h3>
          <p className="mb-4 text-sm text-slate-600">
            Scan a shop QR code or search nearby shops to start tracking your dues.
          </p>
          <Link href="/dashboard/discover" className="btn-primary">
            Discover Shops
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {links.map((link) => (
            <Link
              key={link.id}
              href={`/dashboard/ledger/${link.shop_id}`}
              className="card transition hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {link.shops?.name || "Shop"}
                  </h3>
                  <p className="text-sm text-slate-500">{link.shops?.category}</p>
                </div>
                <span
                  className={`amount text-xl ${
                    Number(link.current_balance) > 0 ? "text-debit" : "text-credit"
                  }`}
                >
                  {formatCurrency(link.current_balance)}
                </span>
              </div>
              {Number(link.current_balance) > 0 && (
                <p className="mt-2 text-xs text-slate-400">Tap to view ledger & pay</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
