"use client";

import { useState, type FormEvent } from "react";
import { loginSchema, signupSchema } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type AuthMode = "signup" | "login";

type FieldState = {
  companyName: string;
  companySlug: string;
  countryCode: string;
  gstin: string;
  companyAddress: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  timezone: string;
};

const initialFieldState: FieldState = {
  companyName: "",
  companySlug: "",
  countryCode: "IN",
  gstin: "",
  companyAddress: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  timezone: "Asia/Kolkata",
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [form, setForm] = useState<FieldState>(initialFieldState);
  const [status, setStatus] = useState<{
    kind: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ kind: "idle", message: "" });
  const isSignup = mode === "signup";

  const updateField = <K extends keyof FieldState>(
    key: K,
    value: FieldState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.info("[AuthForm] Submit started", { mode });
    setStatus({
      kind: "loading",
      message: isSignup ? "Creating workspace..." : "Signing in...",
    });

    const payload = isSignup
      ? {
          companyName: form.companyName,
          companySlug: form.companySlug,
          countryCode: form.countryCode,
          gstin: form.gstin,
          companyAddress: form.companyAddress,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          confirmPassword: form.confirmPassword,
          timezone: form.timezone,
        }
      : {
          email: form.email,
          password: form.password,
        };

    const validation = isSignup
      ? signupSchema.safeParse(payload)
      : loginSchema.safeParse(payload);

    if (!validation.success) {
      console.warn("[AuthForm] Validation failed", {
        mode,
        issue: validation.error.issues[0]?.message,
      });
      setStatus({
        kind: "error",
        message:
          validation.error.issues[0]?.message ??
          "Check the highlighted fields.",
      });
      return;
    }

    const response = await fetch(
      isSignup ? "/api/auth/signup" : "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(validation.data),
      },
    );

    const result = (await response.json()) as {
      ok: boolean;
      message: string;
      workspaceUrl?: string;
      tokens?: { accessToken: string; refreshToken: string };
    };

    console.info("[AuthForm] Auth API response received", {
      mode,
      status: response.status,
      ok: result.ok,
      workspaceUrl: result.workspaceUrl,
    });

    if (!response.ok || !result.ok) {
      console.error("[AuthForm] Auth API failed", {
        mode,
        status: response.status,
        message: result.message,
      });
      setStatus({
        kind: "error",
        message: result.message ?? "Something went wrong.",
      });
      return;
    }

    setStatus({
      kind: "success",
      message: isSignup
        ? "Workspace created. First admin user and starter policies are ready."
        : "Signed in. Your tenant-scoped workspace is ready.",
    });

    const targetUrl = result.workspaceUrl ?? "/workspace";

    try {
      const absoluteTargetUrl = new URL(targetUrl, window.location.origin);
      const isCrossOrigin = absoluteTargetUrl.origin !== window.location.origin;

      if (result.tokens?.accessToken && result.tokens?.refreshToken) {
        console.info(
          "[AuthForm] Bootstrapping auth cookies on workspace host",
          {
            mode,
            targetOrigin: absoluteTargetUrl.origin,
            isCrossOrigin,
          },
        );

        const bootstrapResponse = await fetch(
          `${absoluteTargetUrl.origin}/api/auth/bootstrap`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              accessToken: result.tokens.accessToken,
              refreshToken: result.tokens.refreshToken,
            }),
          },
        );

        const bootstrapResult = (await bootstrapResponse.json()) as {
          ok: boolean;
          error?: { message?: string };
        };

        if (!bootstrapResponse.ok || !bootstrapResult.ok) {
          console.error("[AuthForm] Cookie bootstrap failed", {
            mode,
            status: bootstrapResponse.status,
            targetOrigin: absoluteTargetUrl.origin,
            message: bootstrapResult.error?.message,
            isCrossOrigin,
          });

          if (isCrossOrigin) {
            setStatus({
              kind: "error",
              message:
                bootstrapResult.error?.message ??
                "Signed in but failed to establish tenant session on workspace host.",
            });
            return;
          }

          // Same-origin login/signup already sets cookies. Continue redirect as fallback.
          console.warn(
            "[AuthForm] Continuing with same-origin redirect despite bootstrap failure",
            {
              mode,
              targetOrigin: absoluteTargetUrl.origin,
            },
          );
        }

        console.info("[AuthForm] Cookie bootstrap succeeded", {
          mode,
          targetOrigin: absoluteTargetUrl.origin,
        });
      }

      console.info("[AuthForm] Navigating to workspace", {
        mode,
        targetUrl: absoluteTargetUrl.toString(),
      });

      // Small delay to ensure browser processes Set-Cookie headers before redirect
      setTimeout(() => {
        window.location.assign(absoluteTargetUrl.toString());
      }, 100);
    } catch (error) {
      console.error("[AuthForm] Redirect failed", {
        mode,
        targetUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      window.location.assign("/workspace");
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl tracking-tight text-slate-950">
          {isSignup ? "Create workspace" : "Sign in"}
        </CardTitle>
        <CardDescription>
          {isSignup
            ? "Create the tenant, first admin, and starting policy pack."
            : "Access your workspace with tenant-scoped credentials."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {isSignup ? (
              <>
                <Field
                  label="Company name"
                  value={form.companyName}
                  onChange={(value) => updateField("companyName", value)}
                />
                <Field
                  label="Workspace slug"
                  value={form.companySlug}
                  onChange={(value) => updateField("companySlug", value)}
                  placeholder="bluepeak-studio"
                />
                <Field
                  label="Country code"
                  value={form.countryCode}
                  onChange={(value) => updateField("countryCode", value)}
                  placeholder="IN"
                />
                <Field
                  label="GSTIN"
                  value={form.gstin}
                  onChange={(value) => updateField("gstin", value)}
                  placeholder="27AAAAA0000A1Z5"
                />
                <Field
                  label="First name"
                  value={form.firstName}
                  onChange={(value) => updateField("firstName", value)}
                />
                <Field
                  label="Last name"
                  value={form.lastName}
                  onChange={(value) => updateField("lastName", value)}
                />
              </>
            ) : null}
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(value) => updateField("email", value)}
              className="sm:col-span-2"
            />
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={(value) => updateField("password", value)}
              className="sm:col-span-2"
            />
            {isSignup ? (
              <>
                <Field
                  label="Confirm password"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(value) => updateField("confirmPassword", value)}
                />
                <Field
                  label="Timezone"
                  value={form.timezone}
                  onChange={(value) => updateField("timezone", value)}
                  placeholder="Asia/Kolkata"
                />
              </>
            ) : null}
          </div>

          {isSignup ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <Label htmlFor="companyAddress">Company address</Label>
                <Textarea
                  id="companyAddress"
                  value={form.companyAddress}
                  onChange={(event) =>
                    updateField("companyAddress", event.target.value)
                  }
                  rows={4}
                  placeholder="Street, city, state, office floor"
                />
              </label>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:col-span-2">
                All accounts start with a 15-day free trial and full feature
                access.
              </div>
            </div>
          ) : null}

          {status.kind !== "idle" ? (
            <div
              className={cn(
                "rounded-md border px-4 py-3 text-sm",
                status.kind === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : status.kind === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-700",
              )}
            >
              {status.message}
            </div>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={status.kind === "loading"}
          >
            {status.kind === "loading"
              ? isSignup
                ? "Creating workspace..."
                : "Signing in..."
              : isSignup
                ? "Create workspace"
                : "Sign in"}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <div className="w-full text-xs text-slate-500">
          Secure defaults: tenant-scoped data, hashed passwords, refreshable
          sessions.
        </div>
      </CardFooter>
      <Separator />
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
      />
    </label>
  );
}
