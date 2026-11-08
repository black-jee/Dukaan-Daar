import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase/server";
import MerchantDashboard from "@/components/MerchantDashboard";
import CustomerDashboard from "@/components/CustomerDashboard";

export default async function DashboardPage() {
  const { user, profile } = await getDashboardContext();

  if (!user) redirect("/login");

  if (!profile) {
    return (
      <div className="card text-center">
        <p>Profile not found. Please log out and sign up again.</p>
      </div>
    );
  }

  if (profile.role === "merchant") {
    return <MerchantDashboard userId={user.id} />;
  }

  return <CustomerDashboard userId={user.id} />;
}
