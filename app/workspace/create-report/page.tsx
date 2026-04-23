import Link from "next/link";
import { ClipboardList, FileText, Send } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CreateReportPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Reports
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Group expenses into a polished report.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Assemble receipts, add notes, and prepare a clean submission for
            approval.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">
                Report builder
              </CardTitle>
              <CardDescription>
                Use receipt batches and keep the narrative clear.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "Trip expenses",
                "Client lunch receipts",
                "Software subscriptions",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                >
                  <span>{item}</span>
                  <FileText className="h-4 w-4 text-slate-400" />
                </div>
              ))}
              <Button className="w-full gap-2">
                <ClipboardList className="h-4 w-4" />
                Generate report draft
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">
                Submission flow
              </CardTitle>
              <CardDescription>
                Prepare for approvals without losing context.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <p>Group receipts by project, trip, or month.</p>
              <p>Add a short note for approvers to review faster.</p>
              <p>Send the final bundle to the approval queue.</p>
              <Link
                href="/workspace/approvals"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-900 transition-colors hover:bg-slate-50"
              >
                <Send className="h-4 w-4" />
                View approvals
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
