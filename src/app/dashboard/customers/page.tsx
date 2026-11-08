"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { ShopCustomer, Profile } from "@/types/database";

type Row = ShopCustomer & { profiles: Profile | null };

export default function CustomersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: shops } = await supabase
        .from("shops")
        .select("id")
        .eq("owner_id", user.id)
        .limit(1);

      if (!shops?.[0]) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("shop_customers")
        .select("*, profiles(*)")
        .eq("shop_id", shops[0].id)
        .order("current_balance", { ascending: false });

      setRows((data as Row[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="py-20 text-center text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Customers</h1>
      <div className="card">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            No customers yet. Share your QR code to get started.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/customers/${r.customer_id}`}
                  className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{r.profiles?.full_name || "Unknown"}</p>
                    <p className="text-sm text-slate-500">
                      {r.profiles?.phone || "—"} · {r.status}
                    </p>
                  </div>
                  <p
                    className={`amount text-lg ${
                      Number(r.current_balance) > 0 ? "text-debit" : "text-credit"
                    }`}
                  >
                    {formatCurrency(r.current_balance)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
