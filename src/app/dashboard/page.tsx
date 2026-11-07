import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MerchantDashboard from "@/components/MerchantDashboard";
import CustomerDashboard from "@/components/CustomerDashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

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
