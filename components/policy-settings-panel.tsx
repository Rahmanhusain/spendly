"use client";

import { useMemo, useState } from "react";
import { Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PolicyRecord = {
  id: string;
  name: string;
  description: string | null;
  rules: Record<string, unknown>;
  version: number;
  updated_at: string;
};

function readNumberRule(
  rules: Record<string, unknown> | undefined,
  key: string,
): string {
  if (!rules) {
    return "";
  }

  const value = rules[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

type CustomCategoryLimit = {
  id: string;
  category: string;
  amount: string;
};

function readCustomCategoryLimits(
  rules: Record<string, unknown> | undefined,
): CustomCategoryLimit[] {
  const raw = rules?.categoryMonthlyLimits;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }

  return Object.entries(raw as Record<string, unknown>)
    .map(([category, value], index) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return null;
      }

      return {
        id: `custom_${index}_${category}`,
        category,
        amount: String(numeric),
      };
    })
    .filter((item): item is CustomCategoryLimit => Boolean(item));
}

export function PolicySettingsPanel({
  initialPolicy,
  canEdit,
}: {
  initialPolicy: PolicyRecord | null;
  canEdit: boolean;
}) {
  const [name, setName] = useState(initialPolicy?.name ?? "Default policy");
  const [description, setDescription] = useState(
    initialPolicy?.description ??
      "Primary policy for receipt limits and escalation warnings.",
  );
  const [mealLimit, setMealLimit] = useState(
    readNumberRule(initialPolicy?.rules, "mealPerPersonDailyInr"),
  );
  const [travelLimit, setTravelLimit] = useState(
    readNumberRule(initialPolicy?.rules, "travelMonthlyInr"),
  );
  const [miscLimit, setMiscLimit] = useState(
    readNumberRule(initialPolicy?.rules, "miscMonthlyInr"),
  );
  const [customCategoryLimits, setCustomCategoryLimits] = useState<
    CustomCategoryLimit[]
  >(readCustomCategoryLimits(initialPolicy?.rules));
  const [status, setStatus] = useState<{
    kind: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ kind: "idle", message: "" });

  const summary = useMemo(() => {
    const limits = [mealLimit, travelLimit, miscLimit].filter(
      (value) => value.trim().length > 0,
    );
    const customCount = customCategoryLimits.filter(
      (item) => item.category.trim() && item.amount.trim(),
    ).length;

    if (limits.length === 0) {
      return customCount > 0
        ? `${customCount} custom limit${customCount > 1 ? "s" : ""} configured.`
        : "No numeric limits configured yet.";
    }

    return `${limits.length + customCount} limit${limits.length + customCount > 1 ? "s" : ""} configured.`;
  }, [mealLimit, travelLimit, miscLimit, customCategoryLimits]);

  const onSave = async () => {
    if (!canEdit) {
      setStatus({
        kind: "error",
        message: "You do not have permission to edit policies.",
      });
      return;
    }

    const parsedMeal = mealLimit.trim() ? Number(mealLimit) : null;
    const parsedTravel = travelLimit.trim() ? Number(travelLimit) : null;
    const parsedMisc = miscLimit.trim() ? Number(miscLimit) : null;

    if (
      (parsedMeal !== null &&
        (!Number.isFinite(parsedMeal) || parsedMeal <= 0)) ||
      (parsedTravel !== null &&
        (!Number.isFinite(parsedTravel) || parsedTravel <= 0)) ||
      (parsedMisc !== null && (!Number.isFinite(parsedMisc) || parsedMisc <= 0))
    ) {
      setStatus({
        kind: "error",
        message: "Limits must be valid positive numbers.",
      });
      return;
    }

    const parsedCustomLimits: Record<string, number> = {};
    for (const item of customCategoryLimits) {
      const category = item.category.trim().toLowerCase();
      const amountText = item.amount.trim();

      if (!category && !amountText) {
        continue;
      }

      const amount = Number(amountText);
      if (!category || !Number.isFinite(amount) || amount <= 0) {
        setStatus({
          kind: "error",
          message:
            "Each custom category limit needs a category name and positive amount.",
        });
        return;
      }

      parsedCustomLimits[category] = amount;
    }

    const rules: Record<string, unknown> = {
      requiresExceptionReason: true,
      defaultSeverity: "warning",
    };

    if (parsedMeal !== null) {
      rules.mealPerPersonDailyInr = parsedMeal;
    }

    if (parsedTravel !== null) {
      rules.travelMonthlyInr = parsedTravel;
    }

    if (parsedMisc !== null) {
      rules.miscMonthlyInr = parsedMisc;
    }

    if (Object.keys(parsedCustomLimits).length > 0) {
      rules.categoryMonthlyLimits = parsedCustomLimits;
    }

    if (
      parsedMeal === null &&
      parsedTravel === null &&
      parsedMisc === null &&
      Object.keys(parsedCustomLimits).length === 0
    ) {
      setStatus({
        kind: "error",
        message: "Set at least one policy limit before saving.",
      });
      return;
    }

    setStatus({ kind: "loading", message: "Saving policy..." });

    const response = await fetch("/api/policies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        name,
        description,
        rules,
      }),
    });

    const result = (await response.json()) as {
      ok: boolean;
      error?: { message?: string };
    };

    if (!response.ok || !result.ok) {
      setStatus({
        kind: "error",
        message: result.error?.message ?? "Failed to save policy.",
      });
      return;
    }

    setStatus({
      kind: "success",
      message: "Policy saved. New receipts will use this policy.",
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-950">
            Expense policy setup
          </CardTitle>
          <CardDescription>
            Configure limits for expense categories. Exceeding limits triggers
            warnings and manager review flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="policyName">Policy name</Label>
            <Input
              id="policyName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Default policy"
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="policyDescription">Description</Label>
            <Textarea
              id="policyDescription"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Policy notes for approvers and finance"
              disabled={!canEdit}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mealLimit">Meal limit / person / day (INR)</Label>
              <Input
                id="mealLimit"
                type="number"
                min={1}
                value={mealLimit}
                onChange={(event) => setMealLimit(event.target.value)}
                placeholder="800"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="travelLimit">Travel limit / month (INR)</Label>
              <Input
                id="travelLimit"
                type="number"
                min={1}
                value={travelLimit}
                onChange={(event) => setTravelLimit(event.target.value)}
                placeholder="15000"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="miscLimit">
                Miscellaneous limit / month (INR)
              </Label>
              <Input
                id="miscLimit"
                type="number"
                min={1}
                value={miscLimit}
                onChange={(event) => setMiscLimit(event.target.value)}
                placeholder="5000"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Custom category limits / month (INR)</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setCustomCategoryLimits((current) => [
                      ...current,
                      {
                        id: `custom_${Date.now().toString()}`,
                        category: "",
                        amount: "",
                      },
                    ])
                  }
                  disabled={!canEdit}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add category
                </Button>
              </div>

              <div className="space-y-3">
                {customCategoryLimits.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No custom category limits yet. Example: software = 12000.
                  </p>
                ) : (
                  customCategoryLimits.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-2 sm:grid-cols-[1fr_220px_auto]"
                    >
                      <Input
                        value={item.category}
                        onChange={(event) =>
                          setCustomCategoryLimits((current) =>
                            current.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, category: event.target.value }
                                : entry,
                            ),
                          )
                        }
                        placeholder="Category (example: software)"
                        disabled={!canEdit}
                      />
                      <Input
                        type="number"
                        min={1}
                        value={item.amount}
                        onChange={(event) =>
                          setCustomCategoryLimits((current) =>
                            current.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, amount: event.target.value }
                                : entry,
                            ),
                          )
                        }
                        placeholder="Monthly limit"
                        disabled={!canEdit}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setCustomCategoryLimits((current) =>
                            current.filter((entry) => entry.id !== item.id),
                          )
                        }
                        disabled={!canEdit}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {status.kind !== "idle" ? (
            <div
              className={[
                "rounded-lg border px-4 py-3 text-sm",
                status.kind === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : status.kind === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-700",
              ].join(" ")}
            >
              {status.message}
            </div>
          ) : null}

          <Button
            onClick={onSave}
            disabled={status.kind === "loading" || !canEdit}
          >
            <Save className="mr-2 h-4 w-4" />
            {status.kind === "loading" ? "Saving..." : "Save policy"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Policy status
          </CardTitle>
          <CardDescription>
            This section is informational and does not block uploads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>{summary}</p>
          <p>
            Existing policy: {initialPolicy ? "Available" : "Not configured"}
          </p>
          <p>
            Current version:{" "}
            {initialPolicy ? initialPolicy.version : "No version"}
          </p>
          <p>
            Last updated:{" "}
            {initialPolicy
              ? new Date(initialPolicy.updated_at).toLocaleString()
              : "N/A"}
          </p>
          <p>
            Violations are warnings by default and can be escalated to manager
            review.
          </p>
          {!canEdit ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              You can view policy settings, but only admins and managers can
              update them.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
