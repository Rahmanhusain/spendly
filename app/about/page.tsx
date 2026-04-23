import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const pillars = [
  [
    "Mobile-first",
    "Employees can capture receipts quickly from phone or desktop.",
  ],
  ["Policy-aware", "Managers see approvals and policy warnings in context."],
  [
    "India-first",
    "GST-ready exports and compliance-oriented workflows are part of the core model.",
  ],
];

const audience = [
  ["Founders", "Track spend, enforce rules, and keep visibility on approvals."],
  ["Managers", "Review team reports with a clear queue and comments."],
  ["Accountants", "Use structured exports and clean reporting data."],
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <SiteHeader ctaLabel="Start 15-day trial" ctaHref="/sign-up" />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden rounded-3xl">
            <CardHeader className="space-y-4 border-b border-slate-200 bg-slate-50/80">
              <Badge className="w-fit border-slate-200 bg-white text-slate-700">
                About Spendly
              </Badge>
              <CardTitle className="text-4xl tracking-tight text-slate-950 sm:text-5xl">
                Built for teams that want a cleaner expense workflow.
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7">
                Spendly is designed to replace scattered expense handling with a
                single, professional product experience.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6 text-sm leading-7 text-slate-600">
              <p>
                The product focuses on fast receipt capture, clear approvals,
                and reliable exports for finance teams.
              </p>
              <p>
                It is intentionally restrained so the workflow feels obvious and
                easy to trust.
              </p>
              <Link
                href="/sign-up"
                className="inline-flex text-sm font-medium text-slate-950 underline-offset-4 hover:underline"
              >
                Start with a workspace
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">
                Why it exists
              </CardTitle>
              <CardDescription>
                Spendly was built around the daily problems teams face.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pillars.map(([title, description]) => (
                <div
                  key={title}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="text-sm font-medium text-slate-950">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {description}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {audience.map(([title, description]) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle className="text-lg text-slate-950">
                  {title}
                </CardTitle>
                <CardDescription className="text-sm leading-6">
                  {description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
