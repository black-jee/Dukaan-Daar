"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useMerchantShops } from "@/components/MerchantShopProvider";
import Link from "next/link";

export default function QRPage() {
  const { selectedShop: shop, loading } = useMerchantShops();
  const [origin, setOrigin] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function shareInvite() {
    if (!shop || !origin) return;
    const url = `${origin}/join/${shop.id}`;
    const title = `Join ${shop.name} on KhataLink`;
    const text = `View your account and keep your transactions clear with ${shop.name} on KhataLink.`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        setShareMessage("Invite shared.");
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareMessage("Invite link copied. Send it to your customers.");
    } catch {
      setShareMessage("Sharing isn't available here. Ask customers to scan the QR code.");
    }
  }

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

  const qrValue = `${origin}/join/${shop.id}`;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-center text-2xl font-bold">Your Shop QR Code</h1>
      <p className="text-center text-slate-600">
        Invite customers to view their account and keep their shop transactions clear.
      </p>

      <div className="card flex flex-col items-center gap-4 py-8">
        <div className="rounded-2xl bg-white p-4 shadow-inner">
          {origin ? <QRCodeSVG value={qrValue} size={220} level="H" includeMargin /> : <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-slate-500">Preparing QR code…</div>}
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{shop.name}</p>
          <p className="text-sm text-slate-500">{shop.category}</p>
          <p className="mt-2 text-xs text-slate-400">Scan to join this shop&apos;s ledger</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button onClick={() => void shareInvite()} disabled={!origin} className="btn-primary w-full">
          Share customer invite
        </button>
        <button onClick={() => window.print()} className="btn-outline w-full">
          Print / Save as PDF
        </button>
      </div>
      {shareMessage && <p role="status" aria-live="polite" className="text-center text-sm text-slate-600">{shareMessage}</p>}

      <div className="card text-sm text-slate-600">
        <p className="mb-1 font-medium text-slate-800">How customers join:</p>
        <ol className="list-inside list-decimal space-y-1">
          <li>Open the invite link or scan this QR code</li>
          <li>Sign in or create a KhataLink account</li>
          <li>Review the shop and request to join its khata</li>
        </ol>
      </div>
    </div>
  );
}
