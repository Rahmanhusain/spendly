import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { buildPageMetadata } from "@/lib/seo";
import RefreshOnceClient from "./refresh-once-client";

export const metadata = buildPageMetadata({
  title: "Subscription activated",
  description: "Your Spendly subscription is now active.",
  noIndex: true,
});

export default function CheckoutSuccessPage() {
  return (
    <>
      <RefreshOnceClient />
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">
        Subscription activated
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Your workspace now has full access. Uploads, reports, approvals, and
        exports are all available.
      </p>
      <Link
        href="/workspace"
        className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-medium text-white transition-colors hover:bg-slate-800"
      >
        Back to workspace
      </Link>
    </div>
    </>
  );
}
