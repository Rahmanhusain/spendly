"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const metrics = [
  { label: "Receipts processed", value: "12k+" },
  { label: "Average approval time", value: "< 2 hrs" },
  { label: "Workspaces", value: "250+" },
];

const featureColumns = [
  {
    title: "Capture",
    description: "Turn a receipt into a tracked expense in a few quick steps.",
  },
  {
    title: "Approve",
    description:
      "Keep managers in the loop with a clear review queue and audit history.",
  },
  {
    title: "Report",
    description:
      "Export clean summaries when finance or compliance needs them.",
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Create a workspace",
    description:
      "Set up the company, invite the first admin, and define the team structure.",
  },
  {
    step: "02",
    title: "Collect expenses",
    description:
      "Upload receipts from desktop or mobile and keep every item organized.",
  },
  {
    step: "03",
    title: "Review and export",
    description:
      "Managers approve spend, then finance gets a clean export trail.",
  },
];

const pricingPlans = [
  {
    name: "15-day Free Trial",
    price: "₹0",
    detail: "Every workspace starts with full feature access for 15 days.",
    features: [
      "Unlimited teammates",
      "Unlimited receipts",
      "Approval workflows",
      "Export-ready reports",
      "GST and compliance tools",
    ],
  },
];

export default function HomePageClient() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <SiteHeader ctaLabel="Start 15-day trial" ctaHref="/sign-up" />
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_34%),linear-gradient(to_bottom,rgba(255,255,255,1),rgba(248,250,252,1))]" />

        <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="space-y-7"
          >
            <div className="space-y-4">
              <Badge className="w-fit border-slate-200 bg-white text-slate-700">
                India-first expense management
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  Run expense approvals with a clear product experience.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  Spendly helps teams capture receipts, approve spend, and
                  export reports without clutter. It is built to feel polished,
                  predictable, and easy to trust.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md"
              >
                Start 15-day trial
              </Link>
              <Link
                href="/#about"
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
              >
                See how it works
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {metrics.map((metric, index) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.15 + index * 0.08 }}
                >
                  <Card className="transition-transform duration-200 hover:-translate-y-1">
                    <CardHeader className="pb-3">
                      <CardDescription>{metric.label}</CardDescription>
                      <CardTitle className="text-3xl text-slate-950">
                        {metric.value}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          >
            <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-xl shadow-slate-200/60">
              <CardHeader className="border-b border-slate-200 bg-slate-50/80">
                <CardTitle className="text-xl text-slate-950">
                  Workspace overview
                </CardTitle>
                <CardDescription>
                  What a team sees after sign in.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Pending approval
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      24
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Expenses waiting for manager review.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      This month
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      ₹4.8L
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Tracked spend across all active workspaces.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-950">
                        Recent activity
                      </p>
                      <p className="text-sm text-slate-500">
                        Latest uploads and approvals
                      </p>
                    </div>
                    <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                      Live
                    </Badge>
                  </div>
                  <Separator />
                  {[
                    [
                      "Aman added a receipt",
                      "Office supplies • Pending review",
                    ],
                    ["Neha approved travel spend", "Client visit • Approved"],
                    ["Finance exported report", "Monthly summary • Complete"],
                  ].map(([title, description]) => (
                    <div
                      key={title}
                      className="flex items-start justify-between gap-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-950">
                          {title}
                        </p>
                        <p className="text-sm text-slate-500">{description}</p>
                      </div>
                      <span className="text-xs text-slate-400">Today</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section>

        <section
          id="about"
          className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-4 sm:px-6 md:grid-cols-3 lg:px-8"
        >
          {featureColumns.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
            >
              <Card className="h-full transition-transform duration-200 hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-950">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-6">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">
                Simple workflow
              </CardTitle>
              <CardDescription>
                Designed to feel obvious from the first session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {workflowSteps.map((item, index) => (
                <div key={item.step} className="space-y-4">
                  {index > 0 ? <Separator /> : null}
                  <div className="flex items-start gap-4 pt-1">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                      {item.step}
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold text-slate-950">
                        {item.title}
                      </h2>
                      <p className="text-sm leading-6 text-slate-600">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">
                What teams get
              </CardTitle>
              <CardDescription>
                A focused product surface without extra noise.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[
                "Workspace-level permissions",
                "Receipt uploads with context",
                "Approval trail and comments",
                "GST-ready reporting fields",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="text-sm font-medium text-slate-950">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-8 sm:px-6 lg:grid-cols-2 lg:px-8">
          {pricingPlans.map((plan) => (
            <Card key={plan.name}>
              <CardHeader>
                <CardTitle className="text-2xl text-slate-950">
                  {plan.name}
                </CardTitle>
                <CardDescription>{plan.detail}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-semibold text-slate-950">
                  {plan.price}
                </div>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </section>

        <section
          id="contact"
          className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8"
        >
          <Card className="rounded-3xl border-slate-200 bg-slate-900 text-white shadow-lg shadow-slate-300/50">
            <CardHeader className="space-y-3 border-b border-white/10 bg-transparent">
              <Badge className="w-fit border-white/10 bg-white/10 text-white">
                Contact
              </Badge>
              <CardTitle className="text-3xl text-slate-900 sm:text-4xl">
                Need a clearer expense workflow for your team?
              </CardTitle>
              <CardDescription className="max-w-2xl text-slate-300">
                Start a workspace, review the product flow, or reach out about
                setup for your organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 pt-6">
              <Link
                href="/sign-up"
                className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-slate-950 transition-all duration-200 hover:bg-slate-100 hover:shadow-lg border"
              >
                Start 15-day trial
              </Link>
              <Link
                href="/privacy"
                className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 bg-transparent px-5 text-sm font-medium text-white transition-all duration-200 hover:bg-white/10"
              >
                Privacy
              </Link>
            </CardContent>
          </Card>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
