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
import HashScroller from "@/components/hash-scroller";
import { Scale, Lock, Database, Clock, ShieldAlert, CreditCard } from "lucide-react";

export const metadata = buildPageMetadata({
  title: "Terms and Privacy",
  description:
    "Spendly's terms and privacy page covering product use, workspace data, and legal basics.",
});

const sections = [
  {
    icon: Scale,
    title: "What Spendly is",
    body: "Spendly is a workspace-based expense management platform for teams that need receipt capture, approvals, compliance reporting, and a clearer financial workflow. It is designed for internal business use, not consumer personal finance.",
  },
  {
    icon: ShieldAlert,
    title: "Terms of use",
    body: "You are responsible for the accuracy of the data you upload, the permissions you assign, and how your organisation uses the workspace. Workspace owners control invites, roles, and data access. Features may evolve as the product grows.",
  },
  {
    icon: Lock,
    title: "Privacy and data handling",
    body: "We collect only the data needed to create accounts, operate workspaces, process receipts, and keep audit records. Workspace data remains scoped to the tenant and the role that created it. We do not sell or share your data with third parties.",
  },
  {
    icon: Database,
    title: "Retention and access",
    body: "Operational logs and audit events may be retained for product integrity, security review, and compliance needs. Access is limited by tenant boundaries and role-based permissions.",
  },
  {
    icon: Clock,
    title: "Changes to this policy",
    body: "We may update these terms as the product evolves. Significant changes will be communicated through the product or via email. Continued use of Spendly after changes constitutes acceptance of the updated terms.",
  },
  {
    icon: ShieldAlert,
    title: "Refund policy",
    body: "We provide a 15-day free trial without requiring a credit card. After a subscription is activated we do not provide refunds, except when a payment error occurs due to an issue on our side. If a payment fails because of our system during checkout, please contact support and we will investigate and refund where appropriate.",
  },
  {
    icon: CreditCard,
    title: "Payments",
    body: "Payments collected through the payment gateway are used for software subscriptions and premium features offered by Spendly. No physical products are sold.",
  },
];

const highlights = [
  "Built for internal team workflows, not consumer personal finance.",
  "Workspace owners control invites, roles, and data access.",
  "Receipt, report, and audit data stays within your tenant boundary.",
  "Compliance exports support finance review and GST-ready reporting.",
  "We never sell or share your data with third parties.",
];

export default function LegalPage() {
  return (
    <main className="min-h-[calc(100vh-18.625rem)] bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,1),rgba(248,250,252,1))]">
      <AnimatedPageContent>
        <HashScroller />
        <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          {/* Hero — matches how-it-works layout */}
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.92fr] lg:items-start">
            <div className="space-y-6">
              <Badge className="w-fit border-slate-200 bg-white text-slate-700">
                Legal
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  Terms and privacy, in one place.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  Short, readable, and aligned with how the product actually
                  works. This page covers what the service is, how data is
                  handled, and the core usage terms.
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

            {/* What users should know */}
            <Card className="border-slate-200 bg-slate-900 text-white shadow-lg shadow-slate-300/40">
              <CardHeader>
                <CardTitle className="text-2xl text-slate-950">
                  What users should know
                </CardTitle>
                <CardDescription className="text-slate-600">
                  A quick read before starting a trial.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-slate-500">
                {highlights.map((point) => (
                  <p key={point}>{point}</p>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Policy sections + navigation */}
          <div className="mt-10 grid gap-4 lg:grid-cols-7">
            {/* Policy content */}
            <Card className="lg:col-span-4 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-slate-950">
                  Full policy
                </CardTitle>
                <CardDescription>
                  Last updated May 2026. The product is in active development
                  and terms may evolve.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {sections.map((section, index) => (
                  <section
                    key={section.title}
                    id={
                      section.title === "Refund policy"
                        ? "refund-policy"
                        : section.title === "Payments"
                        ? "payments"
                        : undefined
                    }
                    className="space-y-4"
                  >
                    {index > 0 && <Separator />}
                    <div className="flex items-start gap-4 pt-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                        <section.icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-sm font-semibold text-slate-950">
                          {section.title}
                        </h2>
                        <p className="text-sm leading-7 text-slate-600">
                          {section.body}
                        </p>
                      </div>
                    </div>
                  </section>
                ))}
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="lg:col-span-3 space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-950">
                    Questions about these terms?
                  </CardTitle>
                  <CardDescription>
                    Reach out and we&apos;ll respond within one business day.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-7 text-slate-600">
                  <p>
                    Email us at{" "}
                    <a
                      href="mailto:support@spendly.software"
                      className="font-medium text-slate-950 underline-offset-4 hover:underline"
                    >
                      support@spendly.software
                    </a>{" "}
                    with any questions about data handling, workspace access, or
                    compliance requirements.
                  </p>
                  <Link
                    href="/contact"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    Contact us
                  </Link>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-950">
                    Navigation
                  </CardTitle>
                  <CardDescription>
                    Jump to the product overview or start a trial.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Link
                    href="/"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                  >
                    Home
                  </Link>
                  <Link
                    href="/about"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                  >
                    About
                  </Link>
                  <Link
                    href="/sign-up"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    Start 15-day trial
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
