import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buildPageMetadata } from "@/lib/seo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AnimatedPageContent } from "@/components/animated-page-content";
import { ClipboardList, ShieldCheck, FileSpreadsheet, Users, BarChart3, Zap } from "lucide-react";

export const metadata = buildPageMetadata({
  title: "About",
  description:
    "Spendly is a personal finance and expense management platform for individuals and teams — independently developed software for tracking expenses, managing budgets, and gaining financial insights.",
});

const pillars = [
  {
    icon: ClipboardList,
    title: "Structured expense reporting",
    description:
      "Employees submit expenses through a clear, guided workflow. Every report is organised, categorised, and ready for review — no scattered emails or spreadsheets.",
  },
  {
    icon: ShieldCheck,
    title: "Policy-aware approvals",
    description:
      "Policy warnings surface in context so managers can approve with confidence and employees know where they stand before submitting.",
  },
  {
    icon: FileSpreadsheet,
    title: "India-first compliance",
    description:
      "GST-ready exports and compliance-oriented workflows are built into the core — not bolted on as an afterthought.",
  },
];

const audience = [
  {
    icon: Zap,
    title: "Founders & Admins",
    description:
      "Full visibility into team spend, policy enforcement, and workspace configuration from a single dashboard.",
  },
  {
    icon: Users,
    title: "Managers",
    description:
      "A focused approval queue with comments, audit history, and clear decision context for every report.",
  },
  {
    icon: BarChart3,
    title: "Finance & Accountants",
    description:
      "Structured exports, clean reporting data, and GST-ready summaries that make monthly close straightforward.",
  },
];

const milestones = [
  { label: "Expenses processed", value: "10,000+" },
  { label: "Teams onboarded", value: "200+" },
  { label: "GST reports exported", value: "1,500+" },
  { label: "Avg. approval time", value: "< 4 hrs" },
];

export default function AboutPage() {
  return (
    <main className="min-h-[calc(100vh-18.625rem)] bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,1),rgba(248,250,252,1))]">
      <AnimatedPageContent>
        <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

          {/* Hero */}
          <div className="mb-10 space-y-4">
            <Badge className="w-fit border-slate-200 bg-white text-slate-700">
              About Spendly
            </Badge>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Personal finance and expense management, built for teams.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Spendly is a personal finance and expense management platform that
              helps individuals and teams track expenses, manage budgets, and
              gain clear financial insights — with structured approvals and
              GST-ready reporting built in for Indian businesses.
            </p>
            <p className="max-w-2xl text-sm leading-7 text-slate-500">
              Spendly is an independently developed software project, designed
              and built to solve real expense workflow problems for Indian teams.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
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
                See how it works
              </Link>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {milestones.map(({ label, value }) => (
              <Card key={label} className="border-slate-200 shadow-sm text-center">
                <CardContent className="pt-6 pb-5">
                  <p className="text-3xl font-bold tracking-tight text-slate-950">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main grid */}
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">

            {/* What we built */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="space-y-3 border-b border-slate-100 pb-5">
                <CardTitle className="text-2xl text-slate-950">
                  What Spendly is
                </CardTitle>
                <CardDescription className="text-sm leading-7">
                  A personal finance and expense management platform for
                  individuals and teams — track expenses, manage budgets, gain
                  financial insights, and run structured approvals with
                  GST-ready compliance exports.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {pillars.map(({ icon: Icon, title, description }, index) => (
                  <div key={title} className="space-y-4">
                    {index > 0 && <Separator />}
                    <div className="flex items-start gap-4 pt-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                        <Icon className="h-4 w-4 text-slate-700" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-950">
                          {title}
                        </p>
                        <p className="text-sm leading-6 text-slate-600">
                          {description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="space-y-4">
              <Card className="border-slate-200 bg-slate-900 text-white shadow-lg shadow-slate-300/40">
                <CardHeader>
                  <CardTitle className="text-2xl text-slate-950">
                    Why we built it
                  </CardTitle>
                  <CardDescription className="">
                    The problem was real and the existing tools weren&apos;t
                    designed for Indian teams.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-7 text-slate-500">
                  <p>
                    Most expense tools are built for Western markets and bolt on
                    GST support as an afterthought.
                  </p>
                  <p>
                    Spendly is an independently developed software project,
                    designed from the ground up for Indian compliance
                    requirements, team structures, and approval workflows.
                  </p>
                  <p>
                    The goal is a product that feels obvious to use and easy to
                    trust — for every role in the team.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-950">
                    Get in touch
                  </CardTitle>
                  <CardDescription>
                    Questions, partnerships, or feedback — we&apos;re reachable.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Link
                    href="/contact"
                    className="inline-flex h-10 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    Contact us
                  </Link>
                  <a
                    href="mailto:support@spendly.software"
                    className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                  >
                    support@spendly.software
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Who it's for */}
          <div className="mt-10 space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Who uses Spendly
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                The product is built around the daily problems each role faces.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {audience.map(({ icon: Icon, title, description }) => (
                <Card key={title} className="border-slate-200 shadow-sm">
                  <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                      <Icon className="h-4 w-4 text-slate-700" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-slate-950">
                        {title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm leading-6 text-slate-600">
                    {description}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

        </section>
      </AnimatedPageContent>
    </main>
  );
}
