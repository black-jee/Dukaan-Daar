"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { ShopCustomer, Profile } from "@/types/database";
import { useMerchantShops } from "@/components/MerchantShopProvider";
type Row = ShopCustomer & { profiles: Profile | null };
export default function CustomersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedShop, loading: shopsLoading } = useMerchantShops();
  useEffect(() => {
    let active = true;
    async function load() {
      if (shopsLoading) return;
      if (!selectedShop) { setRows([]); setError(null); setLoading(false); return; }
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.from("shop_customers").select("*, profiles(full_name, phone)").eq("shop_id", selectedShop.id).order("current_balance", { ascending: false });
      if (!active) return;
      setRows(error ? [] : (data as Row[]) || []);
      setError(error ? "Customers could not be loaded. Please retry." : null);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [selectedShop, shopsLoading]);
  if (shopsLoading || loading) return <div className="py-20 text-center text-slate-500">Loading…</div>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Customers{selectedShop ? ` · ${selectedShop.name}` : ""}</h1>
      <div className="card">
        {error ? <p role="alert" className="py-8 text-center text-red-700">{error}</p> : rows.length === 0 ? <p className="py-8 text-center text-slate-500">No customers yet. Share your QR code to get started.</p> : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => <li key={r.id}><Link href={`/dashboard/customers/${r.customer_id}`} className="flex min-h-16 items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-slate-50"><div><p className="font-medium">{r.profiles?.full_name || "Unknown"}</p><p className="text-sm text-slate-500">{r.profiles?.phone || "—"} · {r.status}</p></div><p className={`amount text-lg ${Number(r.current_balance) > 0 ? "text-debit" : "text-credit"}`}>{formatCurrency(r.current_balance)}</p></Link></li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
