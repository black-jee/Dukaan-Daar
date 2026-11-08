"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import type { Shop } from "@/types/database";
import Link from "next/link";

export default function QRPage() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle();

      setShop(data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading…</div>;
  }

  if (!shop) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="mb-4">Create your shop first to generate a QR code.</p>
        <Link href="/dashboard/shop" className="btn-primary">
          Create Shop
        </Link>
      </div>
    );
  }

  // QR payload: deep link or just shop ID for the app to handle
  const qrValue = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${shop.id}`;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-center">Your Shop QR Code</h1>
      <p className="text-center text-slate-600">
        Print this or show it to customers. They scan to join your khata.
      </p>

      <div className="card flex flex-col items-center gap-4 py-8">
        <div className="rounded-2xl bg-white p-4 shadow-inner">
          <QRCodeSVG value={qrValue} size={220} level="H" includeMargin />
        </div>
        <div className="text-center">
          <p className="font-bold text-lg">{shop.name}</p>
          <p className="text-sm text-slate-500">{shop.category}</p>
          <p className="mt-2 text-xs text-slate-400">Scan to join our ledger & track your dues</p>
        </div>
      </div>

      <div className="card text-sm text-slate-600">
        <p className="font-medium text-slate-800 mb-1">How customers join:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Open KhataLink app (or this website)</li>
          <li>Scan this QR or open the link</li>
          <li>Tap &quot;Join Khata&quot;</li>
        </ol>
      </div>

      <button
        onClick={() => window.print()}
        className="btn-outline w-full"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
