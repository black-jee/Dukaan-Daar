import Link from "next/link";
import { Store, User, QrCode, Smartphone, Shield, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Hero */}
      <header className="mx-auto max-w-5xl px-4 pt-10 pb-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary-100 px-4 py-1.5 text-sm font-medium text-primary-800">
          <Zap className="h-4 w-4" />
          Digital Khata for local shops
        </div>
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          KhataLink
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-lg text-slate-600">
          Track micro-credit (₹10–₹500) in seconds. Merchants log entries, customers see live balances. No more paper notebooks or forgotten dues.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup?role=merchant"
            className="btn-primary w-full max-w-xs gap-2 text-lg sm:w-auto"
          >
            <Store className="h-5 w-5" />
            I run a shop
          </Link>
          <Link
            href="/signup?role=customer"
            className="btn-outline w-full max-w-xs gap-2 text-lg sm:w-auto"
          >
            <User className="h-5 w-5" />
            I am a customer
          </Link>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary-600 hover:underline">
            Log in
          </Link>
        </p>
      </header>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="card text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <QrCode className="h-6 w-6" />
            </div>
            <h3 className="mb-2 font-semibold text-slate-900">QR Join</h3>
            <p className="text-sm text-slate-600">
              Customers scan shop QR or search nearby to join the ledger instantly.
            </p>
          </div>
          <div className="card text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <Smartphone className="h-6 w-6" />
            </div>
            <h3 className="mb-2 font-semibold text-slate-900">Live Sync</h3>
            <p className="text-sm text-slate-600">
              Every entry appears on the customer&apos;s phone in real time. No more arguments.
            </p>
          </div>
          <div className="card text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <Shield className="h-6 w-6" />
            </div>
            <h3 className="mb-2 font-semibold text-slate-900">Credit Limits</h3>
            <p className="text-sm text-slate-600">
              Set per-customer limits. Get warnings before over-extending credit.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
