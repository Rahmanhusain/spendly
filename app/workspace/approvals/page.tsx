import Link from "next/link";
import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const approvalItems = [
  {
    title: "March client dinner",
    detail: "Pending manager review · ₹6,450",
    state: "Policy clean",
  },
  {
    title: "Airport transfer",
    detail: "Needs clarification · ₹1,200",
    state: "Missing note",
  },
  {
    title: "Subscription renewal",
    detail: "Waiting for finance sign-off · ₹14,999",
    state: "High value",
  },
];

export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Approvals
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Review what needs attention.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Keep policy checks visible and approve faster.
            </p>
          </div>
          <Badge className="w-fit border-slate-200 bg-slate-50 text-slate-700">
            12 items pending
          </Badge>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">Queue</CardTitle>
              <CardDescription>
                Most recent reports waiting for a decision.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {approvalItems.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-950">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.detail}
                      </p>
                    </div>
                    <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                      {item.state}
                    </Badge>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-950">
                  Decision helpers
                </CardTitle>
                <CardDescription>
                  Use policy signals to move quickly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <p className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Receipt
                  policy checks pass automatically.
                </p>
                <p className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-amber-600" /> Older reports
                  surface first.
                </p>
                <p className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-slate-900" /> Mark
                  approved and move on.
                </p>
              </CardContent>
            </Card>

            <Link
              href="/workspace/upload-receipt"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-900"
            >
              Upload more receipts
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
