"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Store, Home, Users, QrCode, LogOut } from "lucide-react";
import type { Profile } from "@/types/database";
import { cn } from "@/lib/utils";
import { useMerchantShops } from "@/components/MerchantShopProvider";

export default function DashboardNav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const { shops, selectedShopId, setSelectedShopId } = useMerchantShops();

  async function handleLogout() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      window.alert("We couldn't log you out. Please try again.");
      return;
    }
    // A full navigation clears stale App Router state and prefetched dashboard
    // links before another account can sign in on this device.
    window.location.replace("/");
  }

  const isMerchant = profile?.role === "merchant";
  const navItems = isMerchant
    ? [
        { href: "/dashboard", label: "Overview", icon: Home },
        { href: "/dashboard/customers", label: "Customers", icon: Users },
        { href: "/dashboard/shop", label: "My shop", icon: Store },
        { href: "/dashboard/qr", label: "QR code", icon: QrCode },
      ]
    : [
        { href: "/dashboard", label: "My Khatas", icon: Home },
        { href: "/dashboard/discover", label: "Find shops", icon: Store },
      ];

  const nav = (mobile = false) => (
    <nav aria-label={mobile ? "Mobile navigation" : "Main navigation"} className={mobile ? `grid ${navItems.length === 2 ? "grid-cols-2" : "grid-cols-4"} gap-1` : "flex items-center gap-1"}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              mobile
                ? "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-semibold"
                : "flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
              active ? "bg-primary-50 text-primary-800" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Icon className={mobile ? "h-5 w-5" : "h-4 w-4"} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex min-h-11 items-center gap-2 rounded-xl font-extrabold tracking-tight text-primary-800">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-700 text-white"><Store className="h-5 w-5" /></span>
            <span>KhataLink</span>
          </Link>
          {isMerchant && shops.length > 1 && (
            <label className="mx-2 min-w-0 flex-1 md:flex-none">
              <span className="sr-only">Active shop</span>
              <select aria-label="Select active shop" className="input min-h-10 max-w-44 truncate py-2 text-sm" value={selectedShopId} onChange={(event) => setSelectedShopId(event.target.value)}>
                {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
              </select>
            </label>
          )}
          <div className="hidden items-center gap-4 md:flex">
            {nav()}
            <span className="max-w-36 truncate text-sm text-slate-500">{profile?.full_name}</span>
            <button onClick={handleLogout} aria-label="Log out" title="Log out" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          <button onClick={handleLogout} aria-label="Log out" title="Log out" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 md:hidden">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-auto hidden max-w-6xl px-6 pb-2 md:block">
          <span className="text-xs text-slate-500">{profile?.role === "merchant" ? "Shop owner" : "Customer"}{profile?.full_name ? ` · ${profile.full_name}` : ""}</span>
        </div>
      </header>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl md:hidden">
        {nav(true)}
      </div>
    </>
  );
}
