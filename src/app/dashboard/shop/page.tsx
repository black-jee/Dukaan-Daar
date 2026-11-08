"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMerchantShops } from "@/components/MerchantShopProvider";

const CATEGORIES = [
  "Tea / Coffee",
  "Paan / Cigarette",
  "Kirana / Grocery",
  "Snacks / Fast Food",
  "Juice / Cold Drink",
  "General Store",
  "Other",
];

export default function ShopSetupPage() {
  const router = useRouter();
  const { selectedShop: shop, refreshShops, loading: shopsLoading } = useMerchantShops();
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [address, setAddress] = useState("");
  const [upiId, setUpiId] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!shopsLoading) void loadShop();
  }, [shop?.id, shopsLoading]);

  async function loadShop() {
    if (shopsLoading) return;
    if (shop) {
      setName(shop.name); setCategory(shop.category); setAddress(shop.address || "");
      setUpiId(shop.upi_id || ""); setDescription(shop.description || "");
    } else {
      setName(""); setCategory(CATEGORIES[0]); setAddress(""); setUpiId(""); setDescription("");
    }
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Please sign in again to save your shop.");
      setSaving(false);
      return;
    }

    const editablePayload = {
      name: name.trim(),
      category,
      address: address.trim() || null,
      upi_id: upiId.trim() || null,
      description: description.trim() || null,
    };

    let result;
    if (shop) {
      result = await supabase
        .from("shops")
        .update(editablePayload)
        .eq("id", shop.id)
        .eq("owner_id", user.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("shops")
        .insert({ ...editablePayload, owner_id: user.id })
        .select()
        .single();
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      await refreshShops();
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 1000);
    }
    setSaving(false);
  }

  if (shopsLoading || loading) {
    return <div className="py-20 text-center text-slate-500">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">
        {shop ? "Edit Shop" : "Create Your Shop"}
      </h1>

      <form onSubmit={handleSave} className="card space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            Saved successfully!
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Shop Name *</label>
          <input
            required
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ramesh Tea Stall"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Category *</label>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Address</label>
          <input
            className="input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Near bus stand, Main Road"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">UPI ID (for payments)</label>
          <input
            className="input"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="ramesh@upi"
          />
          <p className="mt-1 text-xs text-slate-500">
            Customers will use this to pay dues via GPay / PhonePe / Paytm
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Short description</label>
          <textarea
            className="input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Best cutting chai in the area"
          />
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? "Saving…" : shop ? "Update Shop" : "Create Shop"}
        </button>
      </form>
    </div>
  );
}
