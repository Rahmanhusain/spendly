"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload, Wand2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type UploadState = {
  kind: "idle" | "loading" | "success" | "error";
  message: string;
};

type UploadResult = {
  id: string;
  status: string;
  vendor_name: string | null;
  amount: string;
  category: string | null;
  confidence_score: string | null;
};

type ExtractedResult = {
  vendorName: string;
  amount: number;
  currency: string;
  receiptDate: string;
  category: string;
  gstRate: number | null;
  cgstRate: number | null;
  igstRate: number | null;
  sgstRate: number | null;
  cgstAmount: number | null;
  igstAmount: number | null;
  sgstAmount: number | null;
  taxAmount: number | null;
  vendorGstin: string | null;
  gstAmount: number | null;
};

type DuplicateReceipt = {
  id: string;
  vendor_name: string | null;
  amount: string;
  currency: string;
  receipt_date: string;
  category: string | null;
  mime_type: string | null;
  file_name: string | null;
  file_url: string | null;
};

type PendingPolicyWarning = {
  reasons: string[];
};

export default function UploadReceiptPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<UploadState>({
    kind: "idle",
    message: "",
  });
  const [result, setResult] = useState<UploadResult | null>(null);
  const [extracted, setExtracted] = useState<ExtractedResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingDuplicate, setPendingDuplicate] =
    useState<DuplicateReceipt | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowDuplicateModal(Boolean(pendingDuplicate));
  }, [pendingDuplicate]);
  const [pendingPolicyWarning, setPendingPolicyWarning] =
    useState<PendingPolicyWarning | null>(null);
  const [duplicateOverrideConfirmed, setDuplicateOverrideConfirmed] =
    useState(false);

  useEffect(() => {
    const objectUrl = selectedFile ? URL.createObjectURL(selectedFile) : null;
    const frame = window.requestAnimationFrame(() => {
      setPreviewUrl(objectUrl);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedFile]);

  const isSubmitDisabled =
    !selectedFile || note.trim().length < 8 || state.kind === "loading";

  const helperText = useMemo(() => {
    if (note.trim().length === 0) {
      return "Explain the business context (required). Example: Dinner bill includes 3 teammates, per-person share clarified in this note.";
    }

    if (note.trim().length < 8) {
      return "Add more detail so policy checks have enough context (minimum 8 characters).";
    }

    return "Good note. This context will be attached to parsing and policy checks.";
  }, [note]);

  const onFileSelect = (file: File | null) => {
    if (!file) {
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setState({
        kind: "error",
        message: "Only JPG, PNG, and PDF files are allowed.",
      });
      return;
    }

    setSelectedFile(file);
    setPendingDuplicate(null);
    setPendingPolicyWarning(null);
    setDuplicateOverrideConfirmed(false);
    setState({ kind: "idle", message: "" });
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    onFileSelect(event.dataTransfer.files[0] ?? null);
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
  };

  const onSubmit = async (options?: {
    allowDuplicate?: boolean;
    allowPolicyOverride?: boolean;
  }) => {
    if (!selectedFile || note.trim().length < 8) {
      setState({
        kind: "error",
        message: "Select a file and add a contextual note before parsing.",
      });
      return;
    }

    setState({ kind: "loading", message: "Uploading and starting parse..." });

    const payload = new FormData();
    payload.set("receipt", selectedFile);
    payload.set("note", note.trim());
    const allowDuplicate =
      options?.allowDuplicate ?? duplicateOverrideConfirmed;
    const allowPolicyOverride = options?.allowPolicyOverride ?? false;

    if (allowDuplicate) {
      payload.set("allowDuplicate", "true");
    }
    if (allowPolicyOverride) {
      payload.set("allowPolicyOverride", "true");
    }

    const response = await fetch("/api/receipts/upload", {
      method: "POST",
      credentials: "include",
      body: payload,
    });

    const data = (await response.json()) as {
      ok: boolean;
      message?: string;
      data?: {
        receipt?: UploadResult;
        extracted?: ExtractedResult;
        duplicateOf?: DuplicateReceipt;
        policy?: { violated: boolean; reasons: string[] };
      };
      error?: { code?: string; message?: string };
    };

    // Handle legacy single-error responses and combined validation failures
    if (response.status === 409) {
      const code = data.error?.code;

      // Legacy duplicate-only response
      if (code === "DUPLICATE_RECEIPT" && data.data?.duplicateOf) {
        setPendingDuplicate(data.data.duplicateOf);
        setShowDuplicateModal(true);
        setPendingPolicyWarning(null);
        setState({
          kind: "error",
          message:
            data.error?.message ??
            "Potential duplicate found. Review and confirm if you still want to upload.",
        });
        return;
      }

      // Legacy policy-only response
      if (code === "POLICY_OVERRIDE_REQUIRED") {
        setPendingPolicyWarning({ reasons: data.data?.policy?.reasons ?? [] });
        setPendingDuplicate(null);
        setState({
          kind: "error",
          message:
            data.error?.message ??
            "Policy warnings found. Review and confirm if you still want to upload.",
        });
        return;
      }

      // Combined validation response
      if (code === "VALIDATION_FAILED") {
        type ValidationDetails = {
          duplicate?: unknown;
          policy?: { reasons: string[] };
        };

        const details = (data.error as unknown as { details?: ValidationDetails })
          ?.details;

        if (!details) {
          // fallback: treat as generic failure
          setState({
            kind: "error",
            message: data.error?.message ?? "Upload failed due to validation.",
          });
          return;
        }

        const isDuplicateReceipt = (
          value: unknown,
        ): value is DuplicateReceipt => {
          if (!value || typeof value !== "object") return false;
          const v = value as Record<string, unknown>;

          const vendorNameOk =
            v.vendor_name === null || typeof v.vendor_name === "string";
          const categoryOk =
            v.category === null || typeof v.category === "string";

          return (
            typeof v.id === "string" &&
            typeof v.amount === "string" &&
            typeof v.currency === "string" &&
            typeof v.receipt_date === "string" &&
            vendorNameOk &&
            categoryOk
          );
        };

        if (details.duplicate) {
          let duplicateToUse: unknown = details.duplicate;

          if (
            duplicateToUse &&
            typeof duplicateToUse === "object" &&
            "duplicateOf" in (duplicateToUse as Record<string, unknown>)
          ) {
            const candidate = (duplicateToUse as Record<string, unknown>)
              .duplicateOf;
            if (candidate) {
              duplicateToUse = candidate;
            }
          }

          setPendingDuplicate(isDuplicateReceipt(duplicateToUse) ? duplicateToUse : null);
          setShowDuplicateModal(true);
        } else {
          setPendingDuplicate(null);
          setShowDuplicateModal(false);
        }

        if (details.policy) {
          setPendingPolicyWarning({ reasons: details.policy.reasons ?? [] });
        } else {
          setPendingPolicyWarning(null);
        }

        setState({
          kind: "error",
          message:
            data.error?.message ??
            "Receipt has validation warnings. Review and confirm if you still want to upload.",
        });
        return;
      }
    }

    if (!response.ok || !data.ok || !data.data?.receipt) {
      setState({
        kind: "error",
        message: data.error?.message ?? "Upload failed. Please try again.",
      });
      return;
    }

    setResult(data.data.receipt);
    setExtracted(data.data.extracted ?? null);
    setPendingDuplicate(null);
    setPendingPolicyWarning(null);
    setDuplicateOverrideConfirmed(false);
    setState({
      kind: "success",
      message: data.message ?? "Receipt uploaded and parsing started.",
    });
  };

  const openPreviewInNewTab = (url: string | null) => {
    if (!url) {
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Receipt capture
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Upload receipts with policy-ready context.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Drag a receipt or choose a file, then add a required note so
              parsing and per-person policy checks stay accurate.
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
          <Card
            className="border-dashed border-slate-300 bg-slate-50/60 shadow-none"
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            <CardContent className="flex min-h-80  flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
                <Upload className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-slate-950">
                Drag and drop a receipt
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                PNG, JPG, and PDF are supported. Camera capture is intentionally
                disabled for this workflow.
              </p>
              {selectedFile ? (
                <p className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  Selected: {selectedFile.name}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Choose file
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(event) =>
                  onFileSelect(event.target.files?.[0] ?? null)
                }
              />
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
                <p>Required notes improve per-person policy interpretation.</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-950">
                  Parsing note (required)
                </CardTitle>
                <CardDescription>
                  Explain context such as attendee count or client purpose.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="uploadNote">Context note</Label>
                  <Textarea
                    id="uploadNote"
                    rows={4}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Example: Team dinner bill includes 3 people. Per-person meal spend is split accordingly."
                  />
                  <p className="text-xs text-slate-500">{helperText}</p>
                </div>

                <Button onClick={() => onSubmit()} disabled={isSubmitDisabled}>
                  {state.kind === "loading" ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-1.5" />
                  )}
                  Parse and upload receipt
                </Button>

                {state.kind !== "idle" ? (
                  <p
                    className={[
                      "rounded-lg border px-3 py-2 text-sm",
                      state.kind === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : state.kind === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-700",
                    ].join(" ")}
                  >
                    {state.message}
                  </p>
                ) : null}

                {result ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p>
                      <span className="font-medium text-slate-900">
                        Status:
                      </span>{" "}
                      {result.status}
                    </p>
                    <p>
                      <span className="font-medium text-slate-900">
                        Vendor:
                      </span>{" "}
                      {result.vendor_name ?? "Unknown vendor"}
                    </p>
                    <p>
                      <span className="font-medium text-slate-900">
                        Amount:
                      </span>{" "}
                      ₹{result.amount}
                    </p>
                    <p>
                      <span className="font-medium text-slate-900">
                        Category:
                      </span>{" "}
                      {result.category ?? "uncategorized"}
                    </p>
                    <p>
                      <span className="font-medium text-slate-900">
                        Confidence:
                      </span>{" "}
                      {result.confidence_score ?? "N/A"}
                    </p>
                    {extracted ? (
                      <>
                        <p>
                          <span className="font-medium text-slate-900">
                            Receipt date:
                          </span>{" "}
                          {extracted.receiptDate}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">
                            GST rate:
                          </span>{" "}
                          {extracted.gstRate ?? "N/A"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">
                            GST amount:
                          </span>{" "}
                          {extracted.gstAmount ?? "N/A"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">
                            CGST rate:
                          </span>{" "}
                          {extracted.cgstRate ?? "N/A"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">
                            IGST rate:
                          </span>{" "}
                          {extracted.igstRate ?? "N/A"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">
                            SGST rate:
                          </span>{" "}
                          {extracted.sgstRate ?? "N/A"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">
                            CGST amount:
                          </span>{" "}
                          {extracted.cgstAmount ?? "N/A"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">
                            IGST amount:
                          </span>{" "}
                          {extracted.igstAmount ?? "N/A"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">
                            SGST amount:
                          </span>{" "}
                          {extracted.sgstAmount ?? "N/A"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">
                            Tax amount:
                          </span>{" "}
                          {extracted.taxAmount ?? "N/A"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">
                            Vendor GSTIN:
                          </span>{" "}
                          {extracted.vendorGstin ?? "N/A"}
                        </p>
                      </>
                    ) : null}
                  </div>
                ) : null}
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
                  href="/workspace/reports"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-900"
                >
                  <Wand2 className="h-4 w-4" />
                  Create report
                </Link>
                <Link
                  href="/workspace/receipts"
                  className="ml-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                >
                  View receipts
                </Link>
              </CardContent>
            </Card>
          </div>

          {selectedFile && previewUrl ? (
            <Card className="border-slate-200 shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg text-slate-950">
                  Receipt preview
                </CardTitle>
                <CardDescription>
                  Previewing {selectedFile.name}. This stays on the same screen
                  after upload.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedFile.type === "application/pdf" ? (
                  <iframe
                    src={previewUrl}
                    title="Uploaded PDF preview"
                    className="h-130 w-full rounded-xl border border-slate-200"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Uploaded receipt preview"
                    className="max-h-130 w-full rounded-xl border border-slate-200 object-contain"
                  />
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>

      {pendingDuplicate && showDuplicateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-950">
              Possible duplicate receipt detected
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Vendor, amount, date, and content signals match an existing
              receipt. Review both previews before deciding.
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-slate-950">
                    Existing receipt
                  </CardTitle>
                  <CardDescription>
                    {pendingDuplicate.vendor_name ?? "Unknown vendor"} | ₹
                    {pendingDuplicate.amount} | {pendingDuplicate.receipt_date}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingDuplicate.file_url ? (
                    <div className="space-y-3">
                      {pendingDuplicate.mime_type === "application/pdf" ? (
                        <iframe
                          src={pendingDuplicate.file_url}
                          title="Duplicate receipt preview"
                          className="h-72 w-full rounded-xl border border-slate-200"
                        />
                      ) : (
                        <img
                          src={pendingDuplicate.file_url}
                          alt="Duplicate receipt"
                          className="h-72 w-full rounded-xl border border-slate-200 object-contain"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          openPreviewInNewTab(pendingDuplicate.file_url)
                        }
                        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        Open existing preview in new tab
                      </button>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      Preview not available for this historical receipt.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base text-slate-950">
                    New upload
                  </CardTitle>
                  <CardDescription>
                    {selectedFile?.name ?? "Selected receipt"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {previewUrl ? (
                    <div className="space-y-3">
                      {selectedFile?.type === "application/pdf" ? (
                        <iframe
                          src={previewUrl}
                          title="Current upload preview"
                          className="h-72 w-full rounded-xl border border-slate-200"
                        />
                      ) : (
                        <img
                          src={previewUrl}
                          alt="Current upload"
                          className="h-72 w-full rounded-xl border border-slate-200 object-contain"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => openPreviewInNewTab(previewUrl)}
                        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        Open new upload preview in new tab
                      </button>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      No preview available.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setPendingDuplicate(null)}
                disabled={state.kind === "loading"}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setDuplicateOverrideConfirmed(true);
                  setPendingDuplicate(null);
                  void onSubmit({ allowDuplicate: true });
                }}
                disabled={state.kind === "loading"}
              >
                {state.kind === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Upload anyway
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingPolicyWarning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-950">
              Policy warning detected
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This receipt breaks one or more policy rules. You can cancel or
              continue upload for manager/admin review.
            </p>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">Warnings</p>
              {pendingPolicyWarning.reasons.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                  {pendingPolicyWarning.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-amber-800">
                  Policy validation warning was raised.
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setPendingPolicyWarning(null)}
                disabled={state.kind === "loading"}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setPendingPolicyWarning(null);
                  void onSubmit({
                    allowDuplicate: duplicateOverrideConfirmed,
                    allowPolicyOverride: true,
                  });
                }}
                disabled={state.kind === "loading"}
              >
                {state.kind === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Upload
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
