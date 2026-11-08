import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";
import { MerchantShopProvider } from "@/components/MerchantShopProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getDashboardContext();

  if (!user) redirect("/login");

  const content = (
    <div className="min-h-screen bg-[#f6f8f7]">
      <DashboardNav profile={profile} />
      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-8 md:pb-10">{children}</main>
    </div>
  );
  return profile?.role === "merchant" ? <MerchantShopProvider userId={user.id}>{content}</MerchantShopProvider> : content;
}
