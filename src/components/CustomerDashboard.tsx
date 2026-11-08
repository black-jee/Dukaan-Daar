"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { ArrowUpRight, CheckCircle2, MapPin, Search, Store } from "lucide-react";
import type { PublicShop, ShopCustomer } from "@/types/database";

type LinkedShop = ShopCustomer & { shop: PublicShop | null };

export default function CustomerDashboard({ userId }: { userId: string }) {
  const [links, setLinks] = useState<LinkedShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    setLoadError(null);

    const { data: memberships, error: membershipError } = await supabase
      .from("shop_customers")
      .select("*")
      .eq("customer_id", userId)
      .order("created_at", { ascending: false });

    if (membershipError) {
      setLoadError("We couldn't load your shop ledgers. Please try again.");
      setLoading(false);
      return;
    }

    const shopIds = (memberships || []).map((membership) => membership.shop_id);
    const { data: shops, error: shopsError } = shopIds.length
      ? await supabase.from("public_shops").select("*").in("id", shopIds)
      : { data: [], error: null };

    if (shopsError) {
      setLoadError("Your shop details couldn't be loaded. Please refresh.");
      setLoading(false);
      return;
    }

    const shopById = new Map((shops || []).map((shop) => [shop.id, shop]));
    setLinks(
      (memberships || []).map((membership) => ({
        ...membership,
        shop: shopById.get(membership.shop_id) || null,
      })) as LinkedShop[]
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    const supabase = createClient();
    void loadData();
    const channel = supabase
      .channel(`customer-dashboard-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_customers", filter: `customer_id=eq.${userId}` },
        () => void loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `customer_id=eq.${userId}` },
        () => void loadData()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadData, userId]);

  if (loading) {
    return (
      <div className="space-y-4" aria-live="polite" aria-busy="true">
        <div className="h-8 w-40 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-28 animate-pulse rounded-3xl bg-slate-200" />
        <div className="h-36 animate-pulse rounded-3xl bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="page-title">My Khatas</h1>
          <p className="page-subtitle">
            Each shop has its own separate balance and passbook.
          </p>
        </div>
        <Link href="/dashboard/discover" className="btn-outline shrink-0 px-3 text-sm">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Find shops</span>
          <span className="sm:hidden">Find</span>
        </Link>
      </header>

      {loadError && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{loadError}</p>
          <button onClick={() => { setLoading(true); void loadData(); }} className="mt-2 font-semibold underline">
            Try again
          </button>
        </div>
      )}

      {links.length === 0 ? (
        <section className="card py-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <Store className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">No shops linked yet</h2>
          <p className="mx-auto mb-5 mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Find a shop or scan its QR code. Once linked, its due and transaction history will appear here.
          </p>
          <Link href="/dashboard/discover" className="btn-primary mx-auto">
            <Search className="h-4 w-4" /> Find a shop
          </Link>
        </section>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">{links.length} linked {links.length === 1 ? "shop" : "shops"}</p>
              <p className="text-xs text-slate-500">Balances are never combined</p>
            </div>
            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-800">
              Private ledgers
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {links.map((link) => {
              const balance = Number(link.current_balance);
              const settled = balance === 0;
              return (
                <Link
                  key={link.id}
                  href={`/dashboard/ledger/${link.shop_id}`}
                  className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Store className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-bold text-slate-950">{link.shop?.name || "Shop details unavailable"}</h2>
                      <p className="mt-0.5 text-sm text-slate-500">{link.shop?.category || "Local shop"}</p>
                      {link.shop?.address && (
                        <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-400">
                          <MapPin className="h-3 w-3 shrink-0" /> {link.shop.address}
                        </p>
                      )}
                    </div>
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:text-primary-700" />
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="eyebrow">{settled ? "Shop balance" : "You owe this shop"}</p>
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <p className={`amount text-3xl ${settled ? "text-emerald-700" : "text-rose-700"}`}>
                        {formatCurrency(balance)}
                      </p>
                      {settled ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-primary-700">View passbook →</span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Only transactions from {link.shop?.name || "this shop"} appear in this passbook.
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
