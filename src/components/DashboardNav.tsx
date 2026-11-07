"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Store, Home, Users, QrCode, LogOut, Settings } from "lucide-react";
import type { Profile } from "@/types/database";
import { cn } from "@/lib/utils";

export default function DashboardNav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const isMerchant = profile?.role === "merchant";

  const navItems = isMerchant
    ? [
        { href: "/dashboard", label: "Home", icon: Home },
        { href: "/dashboard/customers", label: "Customers", icon: Users },
        { href: "/dashboard/shop", label: "My Shop", icon: Store },
        { href: "/dashboard/qr", label: "QR Code", icon: QrCode },
      ]
    : [
        { href: "/dashboard", label: "My Khatas", icon: Home },
        { href: "/dashboard/discover", label: "Find Shops", icon: Store },
      ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-primary-700">
          <Store className="h-6 w-6" />
          <span className="hidden sm:inline">KhataLink</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-slate-500 sm:inline">
            {profile?.full_name}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            title="Log out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
