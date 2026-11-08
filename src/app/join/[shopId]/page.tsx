"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PublicShop } from "@/types/database";
import Link from "next/link";

export default function JoinShopPage() {
  const params = useParams();
  const shopId = params.shopId as string;
  const router = useRouter();

  const [shop, setShop] = useState<PublicShop | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);

      const { data: shopData } = await supabase
        .from("public_shops")
        .select("*")
        .eq("id", shopId)
        .single();

      setShop(shopData);

      if (user && shopData) {
        const { data: existing } = await supabase
          .from("shop_customers")
          .select("id")
          .eq("shop_id", shopId)
          .eq("customer_id", user.id)
          .maybeSingle();

        if (existing) setAlreadyJoined(true);
      }
      setLoading(false);
    }
    load();
  }, [shopId]);

  async function handleJoin() {
    if (!userId) {
      router.push(`/login?redirect=/join/${shopId}`);
      return;
    }

    setJoining(true);
    setError(null);
    const supabase = createClient();

    const { error } = await supabase.from("shop_customers").insert({
      shop_id: shopId,
      customer_id: userId,
    });

    if (error) {
      if (error.code === "23505") {
        setAlreadyJoined(true);
      } else {
        setError(error.message);
      }
    } else {
      router.push("/dashboard");
    }
    setJoining(false);
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  }

  if (!shop) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="card text-center">
          <p>Shop not found.</p>
          <Link href="/" className="btn-primary mt-4 inline-block">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md card text-center space-y-4">
        <h1 className="text-2xl font-bold">{shop.name}</h1>
        <p className="text-slate-600">{shop.category}</p>
        {shop.address && <p className="text-sm text-slate-500">{shop.address}</p>}

        {alreadyJoined ? (
          <>
            <p className="text-credit font-medium">You are already linked to this shop.</p>
            <Link href="/dashboard" className="btn-primary w-full">
              Go to Dashboard
            </Link>
          </>
        ) : (
          <>
            <p className="text-slate-600">
              Join this shop&apos;s digital khata to track your dues and payments in real time.
            </p>
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <button
              onClick={handleJoin}
              disabled={joining}
              className="btn-primary w-full"
            >
              {joining ? "Joining…" : userId ? "Join Khata" : "Log in to Join"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
