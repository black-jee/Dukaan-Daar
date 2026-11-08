"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Shop } from "@/types/database";
type ShopContextValue = { shops: Shop[]; selectedShop: Shop | null; selectedShopId: string; setSelectedShopId: (id: string) => void; refreshShops: () => Promise<void>; loading: boolean; error: string | null };
const ShopContext = createContext<ShopContextValue>({ shops: [], selectedShop: null, selectedShopId: "", setSelectedShopId: () => undefined, refreshShops: async () => undefined, loading: false, error: null });
export function MerchantShopProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopIdState] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshShops = useCallback(async () => {
    const supabase = createClient();
    const { data, error: queryError } = await supabase.from("shops").select("*").eq("owner_id", userId).order("created_at", { ascending: true });
    if (queryError) { setError("Your shops could not be loaded. Please refresh and try again."); setLoading(false); return; }
    const owned = data || [];
    setShops(owned);
    const key = `khatalink:selected-shop:${userId}`;
    const saved = window.sessionStorage.getItem(key);
    const active = owned.find((shop) => shop.id === saved) || owned[0] || null;
    setSelectedShopIdState(active?.id || "");
    if (active) window.sessionStorage.setItem(key, active.id);
    setError(null);
    setLoading(false);
  }, [userId]);
  useEffect(() => { void refreshShops(); }, [refreshShops]);
  const setSelectedShopId = useCallback((id: string) => {
    if (!shops.some((shop) => shop.id === id)) return;
    setSelectedShopIdState(id);
    window.sessionStorage.setItem(`khatalink:selected-shop:${userId}`, id);
  }, [shops, userId]);
  const selectedShop = shops.find((shop) => shop.id === selectedShopId) || null;
  const value = useMemo(() => ({ shops, selectedShop, selectedShopId, setSelectedShopId, refreshShops, loading, error }), [shops, selectedShop, selectedShopId, setSelectedShopId, refreshShops, loading, error]);
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
export function MerchantShopStatus() {
  const { error, refreshShops } = useMerchantShops();
  if (!error) return null;
  return (
    <div role="alert" className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span>{error}</span>
        <button type="button" onClick={() => void refreshShops()} className="min-h-10 rounded-lg px-3 font-semibold underline underline-offset-2">Retry</button>
      </div>
    </div>
  );
}
export function useMerchantShops() { return useContext(ShopContext); }
