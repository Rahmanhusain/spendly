import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata = buildPageMetadata({
  title: "How Spendly works",
  description:
    "A clear end-to-end walkthrough of how Spendly helps teams capture receipts, approve spend, and export reports.",
});

const steps = [
  {
    step: "01",
    title: "Create a workspace",
    description:
      "A founder or admin signs up, creates the company workspace, and receives the first admin role.",
  },
  {
    step: "02",
    title: "Invite the team",
    description:
      "Managers and employees join through invites. Roles control who can upload, approve, and export.",
  },
  {
    step: "03",
    title: "Upload receipts",
    description:
      "Employees upload from mobile or desktop. Spendly extracts amount, date, vendor, category, and GST details.",
  },
  {
    step: "04",
    title: "Check policies",
    description:
      "Policy warnings appear immediately so the user knows whether the receipt is within limits or needs review.",
  },
  {
    step: "05",
    title: "Build and submit reports",
    description:
      "Receipts are grouped into reports for a trip, month, or project and sent to the approval queue.",
  },
  {
    step: "06",
    title: "Approve and track reimbursement",
    description:
      "Managers approve, reject, or request more information. Finance can mark reimbursement as paid later.",
  },
  {
    step: "07",
    title: "Export for compliance",
    description:
      "GST-ready summaries and dashboard insights are available for finance, audits, and planning.",
  },
];

const outcomeCards = [
  {
    title: "For employees",
    copy: "Fast receipt capture, fewer manual fields, and a visible status trail for every submission.",
  },
  {
    title: "For managers",
    copy: "A clean approval queue with comments, audit history, and a focused decision workflow.",
  },
  {
    title: "For finance",
    copy: "Consistency across reports, GST details, and export-friendly records for monthly close.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-[calc(100vh-18.625rem)] bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,1),rgba(248,250,252,1))]">
      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
          <div className="space-y-6">
            <Badge className="w-fit border-slate-200 bg-white text-slate-700">
              Product walkthrough
            </Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                How Spendly works from first signup to final export.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                This page gives new users the end-to-end view: workspace setup,
                receipt capture, approval flow, reimbursement tracking, and the
                compliance outputs finance teams care about.
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
                href="/legal"
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
              >
                Read terms and privacy
              </Link>
            </div>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">
                Why teams use Spendly
              </CardTitle>
              <CardDescription>
                The product is designed to replace scattered receipts, chat
                approvals, and spreadsheet-based reporting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-slate-600">
              <p>One place for uploads, approvals, reports, and exports.</p>
              <p>Role-based access keeps employees, managers, and admins in the right workflow.</p>
              <p>Compliance data is preserved for GST-ready reporting and audit history.</p>
            </CardContent>
          </Card>
        </div>

        <section className="mt-10 grid gap-4 lg:grid-cols-7">
          <Card className="lg:col-span-4 border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">
                End-to-end workflow
              </CardTitle>
              <CardDescription>
                The experience is intentionally linear so new users can learn it quickly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {steps.map((item, index) => (
                <div key={item.step} className="space-y-4">
                  {index > 0 ? <Separator /> : null}
                  <div className="flex items-start gap-4 pt-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
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

          <div className="lg:col-span-3 space-y-4">
            {outcomeCards.map((card) => (
              <Card key={card.title} className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-950">
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-7 text-slate-600">
                  {card.copy}
                </CardContent>
              </Card>
            ))}

            <Card className="border-slate-200 bg-slate-900 text-white shadow-lg shadow-slate-300/40">
              <CardHeader>
                <CardTitle className="text-2xl text-white">
                  New user quick start
                </CardTitle>
                <CardDescription className="text-slate-300">
                  If you are evaluating Spendly for the first time, begin here.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-slate-300">
                <p>1. Start a workspace and invite the first admin.</p>
                <p>2. Upload one receipt to see the extraction and policy flow.</p>
                <p>3. Create a report and submit it for approval.</p>
                <p>4. Review the audit trail and export-ready history.</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </section>
    </main>
  );
}