import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <div className="min-h-screen bg-[#f6f8f7]">
      <DashboardNav profile={profile} />
      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-8 md:pb-10">
        {children}
      </main>
    </div>
  );
}
