import Link from "next/link";
import { Camera, Upload, Wand2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function UploadReceiptPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Receipt capture
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Upload receipts fast, from any device.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Drop a file here and keep the expense ready for reports and
              approvals.
            </p>
          </div>
          <Link
            href="/workspace"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-dashed border-slate-300 bg-slate-50/60 shadow-none">
            <CardContent className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
                <Upload className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-slate-950">
                Drag and drop a receipt
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                PNG, JPG, and PDF are supported. This screen can be wired to
                your OCR flow later.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button>
                  <Camera className="h-4 w-4" />
                  Take photo
                </Button>
                <Button variant="outline">
                  <Upload className="h-4 w-4" />
                  Choose file
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-950">
                  Smart extraction
                </CardTitle>
                <CardDescription>
                  Capture the essentials before you submit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <p>Vendor, date, tax, and amount are auto-detected.</p>
                <p>Route the receipt into a report with one click.</p>
                <p>Keep policy checks visible before approvals.</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-950">
                  Suggested next step
                </CardTitle>
                <CardDescription>
                  Finish the flow by turning this into a report.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/workspace/create-report"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-900"
                >
                  <Wand2 className="h-4 w-4" />
                  Create report
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
