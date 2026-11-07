"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Shop } from "@/types/database";
import { Store, MapPin } from "lucide-react";

export default function DiscoverPage() {
  const supabase = createClient();
  const [shops, setShops] = useState<Shop[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("shops")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .limit(50);
    setShops(data || []);
    setLoading(false);
  }

  const filtered = shops.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.category.toLowerCase().includes(query.toLowerCase()) ||
      (s.address || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Find Shops</h1>
      <p className="text-slate-600">
        Search registered local shops and join their digital khata.
      </p>

      <input
        type="search"
        className="input"
        placeholder="Search by name, category or area…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading shops…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Store className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-500">No shops found.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((shop) => (
            <Link
              key={shop.id}
              href={`/join/${shop.id}`}
              className="card hover:shadow-md transition"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{shop.name}</h3>
                  <p className="text-sm text-slate-500">{shop.category}</p>
                  {shop.address && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <MapPin className="h-3 w-3" />
                      {shop.address}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
