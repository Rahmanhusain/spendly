import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AnimatedPageContent } from "@/components/animated-page-content";
import { CheckCircle2, Zap, CalendarDays, HelpCircle, MessageCircle } from "lucide-react";

export const metadata = buildPageMetadata({
  title: "Pricing",
  description:
    "Simple, transparent pricing for Spendly. Monthly at ₹999 or quarterly at ₹2,699. No hidden fees, no credit card required for the trial.",
});

const features = [
  "Unlimited receipt uploads",
  "Approval workflows for managers and admins",
  "GST-ready compliance exports",
  "Policy violation detection",
  "Team roles — admin, manager, employee",
  "Dashboard with spend analytics",
  "Audit trail and activity history",
  "15-day free trial included",
];

const plans = [
  {
    icon: Zap,
    name: "Monthly",
    price: "₹999/-",
    period: "per month",
    description: "Full access to all features, billed every month. Cancel anytime.",
    saving: null,
    href: "/sign-up",
    cta: "Start free trial",
    highlight: false,
  },
  {
    icon: CalendarDays,
    name: "Quarterly",
    price: "₹2,699/-",
    period: "per 3 months",
    description: "Pay once for three months and save ₹298 compared to the monthly plan.",
    saving: "Save ₹298",
    href: "/sign-up",
    cta: "Start free trial",
    highlight: true,
  },
];

const faqs = [
  {
    q: "Do I need a credit card to start the trial?",
    a: "No. The 15-day free trial starts immediately after sign-up without requiring any payment details.",
  },
  {
    q: "What happens after the trial ends?",
    a: "You choose a plan to continue. If you don't subscribe, the workspace moves to a read-only state — your data is not deleted.",
  },
  {
    q: "Can I switch from monthly to quarterly later?",
    a: "Yes. You can change your plan at any renewal date. Contact support and we'll sort it out.",
  },
  {
    q: "Are there refunds?",
    a: "We don't provide refunds after a subscription is activated, except when a payment error occurs on our side. See the refund policy for details.",
  },
  {
    q: "Is this per user or per workspace?",
    a: "Per workspace. All team members — admin, managers, and employees — are included under one subscription.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-[calc(100vh-18.625rem)] bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,1),rgba(248,250,252,1))]">
      <AnimatedPageContent>
        <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

          {/* Hero */}
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.92fr] lg:items-start">
            <div className="space-y-6">
              <Badge className="w-fit border-slate-200 bg-white text-slate-700">
                Pricing
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  Simple pricing, no surprises.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  One plan, two billing cycles. Everything included — receipt
                  uploads, approvals, GST exports, and your full team — for one
                  flat price per workspace.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/sign-up"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
                >
                  Start 15-day trial
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                >
                  How it works
                </Link>
              </div>
            </div>

            {/* What's included */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-slate-950">
                  Everything included
                </CardTitle>
                <CardDescription>
                  Both plans give you the full product. No feature tiers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {features.map((f) => (
                  <div key={f} className="flex items-center gap-3 text-sm text-slate-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    {f}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Plan cards */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.name}
                  className={`relative rounded-xl border p-6 shadow-sm border-slate-200 bg-white`}
                >
                  {plan.saving && (
                    <span className="absolute -top-3 left-5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {plan.saving}
                    </span>
                  )}
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50`}>
                    <Icon className={`h-4 w-4text-slate-700`} />
                  </div>
                  <p className={`mt-4 text-xl font-semibold text-slate-950` }>
                    {plan.name}
                  </p>
                  <div className="mt-1 flex items-end gap-1.5">
                    <span className={`text-4xl font-bold tracking-tight text-slate-950`}>
                      {plan.price}{" "}
                    </span>
                    <span className={`mb-1 text-sm text-slate-500`}>
                      {plan.period}
                    </span>
                  </div>
                  <p className={`mt-2 text-sm leading-6 text-slate-500`}>
                    {plan.description}
                  </p>
                  <Link
                    href={plan.href}
                    className={`mt-6 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-medium transition-colors bg-slate-950 text-white hover:scale-105 hover:transition-all`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* FAQ + sidebar */}
          <div className="mt-10 grid gap-4 lg:grid-cols-7">
            {/* FAQ */}
            <Card className="lg:col-span-4 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-slate-950">
                  Common questions
                </CardTitle>
                <CardDescription>
                  Straight answers before you commit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {faqs.map((faq, index) => (
                  <div key={faq.q} className="space-y-4">
                    {index > 0 && <Separator />}
                    <div className="space-y-3 pt-1">
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100">
                          <HelpCircle className="h-3.5 w-3.5 text-slate-600" />
                        </div>
                        <p className="text-sm font-semibold text-slate-950">{faq.q}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                          <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <p className="text-sm leading-7 text-slate-600">{faq.a}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="lg:col-span-3 space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-950">
                    Trial details
                  </CardTitle>
                  <CardDescription>
                    15 days, no credit card, full product access.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-7 text-slate-600">
                  <p>Sign up and your workspace is live immediately.</p>
                  <p>Invite your team, upload receipts, and run the full workflow before deciding on a plan.</p>
                  <p>No payment required until you choose to subscribe.</p>
                  <Link
                    href="/sign-up"
                    className="mt-1 inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    Start free trial
                  </Link>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-950">
                    Questions about pricing?
                  </CardTitle>
                  <CardDescription>
                    Reach out before you commit — we'll help you decide.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Link
                    href="/contact"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    Contact us
                  </Link>
                  <Link
                    href="/legal#refund-policy"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                  >
                    Refund policy
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>

        </section>
      </AnimatedPageContent>
    </main>
  );
}
