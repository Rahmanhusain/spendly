import Link from "next/link";
import { XCircle } from "lucide-react";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Payment failed",
  description: "Something went wrong with your payment.",
  noIndex: true,
});

export default function CheckoutFailedPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-rose-200 bg-rose-50">
        <XCircle className="h-8 w-8 text-rose-600" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">
        Payment unsuccessful
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Something went wrong during checkout. Your account has not been charged.
        Please try again or contact support if the issue persists.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/workspace/checkout"
          className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          Try again
        </Link>
        <Link
          href="/contact"
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}
