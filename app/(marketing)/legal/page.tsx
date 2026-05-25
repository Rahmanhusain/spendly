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

export const metadata = buildPageMetadata({
  title: "Terms and Privacy",
  description:
    "Spendly's merged terms and privacy page covering product use, workspace data, and legal basics.",
});

const sections = [
  {
    title: "What Spendly is",
    body: "Spendly is a workspace-based expense management platform for teams that need receipt capture, approvals, compliance reporting, and a clearer financial workflow.",
  },
  {
    title: "Terms of use",
    body: "You are responsible for the accuracy of the data you upload, the permissions you assign, and how your organization uses the workspace. Features may evolve as the product grows.",
  },
  {
    title: "Privacy and data handling",
    body: "We collect only the data needed to create accounts, operate workspaces, process receipts, and keep audit records. Workspace data remains scoped to the tenant and the role that created it.",
  },
  {
    title: "Retention and access",
    body: "Operational logs and audit events may be retained for product integrity, security review, and compliance needs. Access is limited by tenant boundaries and role-based permissions.",
  },
];

export default function LegalPage() {
  return (
    <main className="min-h-[calc(100vh-18.625rem)] bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,1),rgba(248,250,252,1))]">
      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="space-y-4">
              <Badge className="w-fit border-slate-200 bg-white text-slate-700">
                Legal
              </Badge>
              <CardTitle className="text-4xl tracking-tight text-slate-950 sm:text-5xl">
                Terms and privacy, in one place.
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7 text-slate-600">
                Spendly keeps the legal text short, readable, and aligned with
                how the product actually works. This page covers what the
                service is, how data is handled, and the core usage terms.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-sm leading-7 text-slate-600">
              {sections.map((section, index) => (
                <div key={section.title} className="space-y-4">
                  {index > 0 ? <Separator /> : null}
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      {section.title}
                    </h2>
                    <p className="mt-2">{section.body}</p>
                  </div>
                </div>
              ))}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
                <p className="font-medium text-slate-950">
                  Need the product flow too?
                </p>
                <p className="mt-2">
                  If you are new to Spendly, start with the end-to-end product
                  walkthrough to understand signup, uploading receipts,
                  approvals, and exports.
                </p>
                <Link
                  href="/how-it-works"
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  How it works
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200 bg-slate-900 text-white shadow-lg shadow-slate-300/40">
              <CardHeader>
                <CardTitle className="text-2xl text-white">
                  What users should know
                </CardTitle>
                <CardDescription className="text-slate-300">
                  A quick read for new teams before they start a trial.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-7 text-slate-300">
                <p>
                  Spendly is built for internal team workflows, not consumer
                  personal finance.
                </p>
                <p>Workspace owners control invites, roles, and data access.</p>
                <p>
                  Receipt, report, and audit data is kept within the tenant
                  boundary.
                </p>
                <p>
                  Compliance exports are meant to support finance review and
                  GST-ready reporting.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-slate-950">
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
                  href="/how-it-works"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                >
                  How it works
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
    </main>
  );
}
