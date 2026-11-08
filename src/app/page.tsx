import Link from "next/link";
import { ArrowRight, CheckCircle2, QrCode, ShieldCheck, Smartphone, Store, UserRound } from "lucide-react";

const features = [
  { icon: QrCode, title: "Join with a QR code", body: "Customers can connect to a shop's khata in a few simple steps." },
  { icon: Smartphone, title: "Clear, live passbooks", body: "See credits, payments and the updated balance in one easy timeline." },
  { icon: ShieldCheck, title: "Separate by shop", body: "Every shop has its own ledger. One customer's accounts never get mixed." },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f8f7]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[34rem] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100 via-[#f6f8f7] to-[#f6f8f7]" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex min-h-11 items-center gap-2 font-extrabold tracking-tight text-slate-950">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-700 text-white"><Store className="h-5 w-5" /></span>
          <span className="text-xl">KhataLink</span>
        </Link>
        <Link href="/login" className="btn-outline min-h-10 px-4 py-2 text-sm">Log in</Link>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-[1.1fr_.9fr] lg:pb-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[.12em] text-emerald-800 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Digital khata, made clear
          </div>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-950 sm:text-6xl">
            Your shop. Your customers. <span className="text-primary-700">Clear accounts.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            KhataLink helps local shops record credit and payments while customers keep track of every shop's balance separately.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <Link href="/signup?role=merchant" className="btn-primary min-h-14 justify-between px-5 text-base">
              <span className="flex items-center gap-2"><Store className="h-5 w-5" /> I run a shop</span><ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/signup?role=customer" className="btn-outline min-h-14 justify-between px-5 text-base">
              <span className="flex items-center gap-2"><UserRound className="h-5 w-5" /> I'm a customer</span><ArrowRight className="h-5 w-5" />
            </Link>
          </div>
          <p className="mt-5 text-sm text-slate-500">Free to get started · Works on your phone · No app installation needed</p>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,.12)] sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Customer view</p><p className="mt-1 font-bold text-slate-900">My Khatas</p></div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">2 shops linked</span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100"><Store className="h-5 w-5 text-slate-700" /></span><div><p className="font-bold text-slate-900">Sharma General Store</p><p className="text-xs text-slate-500">Grocery · Separate passbook</p></div></div>
                <div className="mt-4 border-t border-slate-100 pt-3"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">You owe this shop</p><p className="amount mt-1 text-3xl text-rose-700">₹450.00</p></div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100"><Store className="h-5 w-5 text-slate-700" /></span><div><p className="font-bold text-slate-900">City Tea Corner</p><p className="text-xs text-slate-500">Tea & snacks · Separate passbook</p></div></div>
                <div className="mt-4 border-t border-slate-100 pt-3"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Shop balance</p><p className="amount mt-1 text-3xl text-emerald-700">₹0.00</p><p className="mt-1 text-xs font-semibold text-emerald-700">All settled</p></div>
              </div>
            </div>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-slate-500"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Each shop's balance stays independent</p>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-slate-200 bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="max-w-xl"><p className="eyebrow">Simple by design</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">A better way to keep khata.</h2><p className="mt-3 leading-7 text-slate-600">Built around the everyday needs of shop owners and the people who shop with them.</p></div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-3xl border border-slate-200 bg-[#fbfcfb] p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-800"><Icon className="h-6 w-6" /></span>
                <h3 className="mt-5 text-lg font-bold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <footer className="border-t border-slate-200 bg-[#f6f8f7] px-5 py-8 text-center text-sm text-slate-500">
        <p className="font-bold text-slate-800">KhataLink</p>
        <p className="mt-1">Clear dues. Better business.</p>
      </footer>
    </main>
  );
}
