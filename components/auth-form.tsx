"use client";

import Link from "next/link";
import {
  useState,
  useEffect,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import { Loader2, LogIn, ArrowRight } from "lucide-react";
import {
  loginSchema,
  requestOtpSchema,
  signupWithOtpSchema,
} from "@/lib/validators/auth";
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

const WORKSPACE_SLUG_MAX_LENGTH = 80;

function normalizeWorkspaceSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, WORKSPACE_SLUG_MAX_LENGTH);
}

type FieldState = {
  companyName: string;
  companySlug: string;
  countryCode: string;
  gstin: string;
  companyAddress: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  otp: string;
  timezone: string;
};

type WorkspaceOption = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_plan: "trial" | "subscribed" | "expired";
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
  phoneNumber: "",
  password: "",
  confirmPassword: "",
  otp: "",
  timezone: "Asia/Kolkata",
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [form, setForm] = useState<FieldState>(initialFieldState);
  const [status, setStatus] = useState<{
    kind: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ kind: "idle", message: "" });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FieldState, string>>
  >({});
  const [otpSent, setOtpSent] = useState(false);
  const [otpSentForEmail, setOtpSentForEmail] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceOption[]>(
    [],
  );
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [workspaceLookupError, setWorkspaceLookupError] = useState<
    string | null
  >(null);
  const isSignup = mode === "signup";

  const canSendOtp = isSignup
    ? Boolean(
        form.companyName.trim() &&
        form.companySlug.trim() &&
        form.email.trim() &&
        form.phoneNumber.trim() &&
        form.password.trim() &&
        form.confirmPassword.trim(),
      )
    : true;

  const updateField = <K extends keyof FieldState>(
    key: K,
    value: FieldState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));

    if (key === "email") {
      setOtpSent(false);
      setOtpSentForEmail("");
      setFieldErrors((current) => ({ ...current, otp: undefined }));
      if (!isSignup) {
        setWorkspaceOptions([]);
        setWorkspaceLookupError(null);
        setForm((current) => ({ ...current, companySlug: "" }));
      }
    }
  };

  useEffect(() => {
    if (isSignup) {
      return;
    }

    const email = form.email.trim();
    if (!email) {
      setWorkspaceOptions([]);
      setWorkspaceLookupError(null);
      setForm((current) => ({ ...current, companySlug: "" }));
      return;
    }

    const validation = requestOtpSchema.safeParse({ email });
    if (!validation.success) {
      setWorkspaceOptions([]);
      setWorkspaceLookupError(null);
      setForm((current) => ({ ...current, companySlug: "" }));
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoadingWorkspaces(true);
      setWorkspaceLookupError(null);

      try {
        const response = await fetch(
          `/api/auth/workspaces?email=${encodeURIComponent(validation.data.email)}`,
          { signal: controller.signal },
        );

        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          data?: { workspaces?: WorkspaceOption[] };
          error?: { message?: string };
        };

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.error?.message ?? "Failed to load workspaces.",
          );
        }

        const nextOptions = payload.data?.workspaces ?? [];
        setWorkspaceOptions(nextOptions);

        setForm((current) => {
          const currentSlug = current.companySlug.trim();
          const stillValid = nextOptions.some(
            (workspace) => workspace.tenant_slug === currentSlug,
          );
          const nextSlug = stillValid
            ? currentSlug
            : (nextOptions[0]?.tenant_slug ?? "");

          return nextSlug === current.companySlug
            ? current
            : { ...current, companySlug: nextSlug };
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setWorkspaceOptions([]);
          setWorkspaceLookupError(
            error instanceof Error
              ? error.message
              : "Failed to load workspaces.",
          );
          setForm((current) => ({ ...current, companySlug: "" }));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingWorkspaces(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [form.email, isSignup]);

  const mapValidationErrors = (
    issues: Array<{ path: Array<string | number>; message: string }>,
  ) => {
    const nextErrors: Partial<Record<keyof FieldState, string>> = {};

    for (const issue of issues) {
      const firstPath = issue.path[0];
      if (typeof firstPath === "string" && firstPath in form) {
        nextErrors[firstPath as keyof FieldState] = issue.message;
      }
    }

    return nextErrors;
  };

  const sendSignupOtp = async () => {
    const validation = requestOtpSchema.safeParse({ email: form.email });
    if (!validation.success) {
      setFieldErrors((current) => ({
        ...current,
        email:
          validation.error.issues[0]?.message ?? "Enter a valid email first.",
      }));
      setStatus({ kind: "idle", message: "" });
      return;
    }

    setIsSendingOtp(true);
    setFieldErrors((current) => ({
      ...current,
      email: undefined,
      otp: undefined,
    }));
    setStatus({ kind: "loading", message: "Sending OTP..." });

    try {
      const response = await fetch("/api/auth/signup/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: validation.data.email }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        message?: string;
        error?: { message?: string; retryAfter?: number };
      };

      if (!response.ok || !result.ok) {
        const retry = result.error?.retryAfter ?? 0;
        if (response.status === 429 && retry > 0) {
          setResendCooldown(retry);
        }

        setStatus({
          kind: "error",
          message:
            result.error?.message ?? result.message ?? "Failed to send OTP.",
        });
        return;
      }

      // success - start local cooldown
      setResendCooldown(60);
      setOtpSent(true);
      setOtpSentForEmail(validation.data.email.toLowerCase());
      setStatus({
        kind: "success",
        message: "OTP sent. Check your email and enter the 6-digit code.",
      });
    } catch {
      setStatus({ kind: "error", message: "Failed to send OTP." });
    } finally {
      setIsSendingOtp(false);
    }
  };

  // countdown effect for resend cooldown
  useEffect(() => {
    let t: number | undefined;
    if (resendCooldown > 0) {
      t = window.setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) {
            window.clearInterval(t);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }

    return () => {
      if (t) window.clearInterval(t);
    };
  }, [resendCooldown]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.info("[AuthForm] Submit started", { mode });
    setFieldErrors({});
    setStatus({
      kind: "loading",
      message: isSignup ? "Creating account..." : "Logging in...",
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
          phoneNumber: form.phoneNumber,
          password: form.password,
          confirmPassword: form.confirmPassword,
          otp: form.otp,
          timezone: form.timezone,
        }
      : {
          email: form.email,
          companySlug: form.companySlug,
          password: form.password,
        };

    const validation = isSignup
      ? signupWithOtpSchema.safeParse(payload)
      : loginSchema.safeParse(payload);

    if (!validation.success) {
      const nextFieldErrors = mapValidationErrors(validation.error.issues);
      console.warn("[AuthForm] Validation failed", {
        mode,
        issues: validation.error.issues,
      });
      setFieldErrors(nextFieldErrors);
      setStatus({ kind: "idle", message: "" });
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
      message?: string;
      error?: { code?: string; message?: string };
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
        message: result.error?.message ?? result.message,
      });

      if (isSignup && result.error?.code === "INVALID_OTP") {
        setFieldErrors((current) => ({
          ...current,
          otp: result.error?.message ?? "Invalid or expired OTP.",
        }));
        setStatus({ kind: "idle", message: "" });
        return;
      }

      setStatus({
        kind: "error",
        message:
          result.error?.message ?? result.message ?? "Something went wrong.",
      });
      return;
    }

    setStatus({
      kind: "success",
      message: isSignup
        ? "Account created. First admin user and starter policies are ready."
        : "Signed in. Taking you to your workspace...",
    });

    const targetUrl = result.workspaceUrl ?? "/workspace";

    try {
      const absoluteTargetUrl = new URL(targetUrl, window.location.origin);
      const isCrossOrigin = absoluteTargetUrl.origin !== window.location.origin;

      if (result.tokens?.accessToken && result.tokens?.refreshToken) {
        // With path-based routing, bootstrap is always same-origin.
        // With subdomain routing, bootstrap goes to the tenant subdomain.
        // Either way, call bootstrap then navigate.
        const bootstrapOrigin = isCrossOrigin
          ? absoluteTargetUrl.origin
          : window.location.origin;

        const bootstrapResponse = await fetch(
          `${bootstrapOrigin}/api/auth/bootstrap`,
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
            message: bootstrapResult.error?.message,
          });
          setStatus({
            kind: "error",
            message:
              bootstrapResult.error?.message ??
              "Signed in but failed to establish session. Please try again.",
          });
          return;
        }
      }

      setIsRedirecting(true);
      setTimeout(() => {
        window.location.assign(absoluteTargetUrl.toString());
      }, 120);
    } catch (error) {
      console.error("[AuthForm] Redirect failed", {
        mode,
        targetUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      setIsRedirecting(true);
      setTimeout(() => {
        window.location.assign("/workspace");
      }, 120);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      {/* ── Full-screen redirect overlay ── */}
      {isRedirecting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-white/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative flex h-16 w-16 items-center justify-center">
            {/* Outer ring */}
            <span className="absolute inset-0 rounded-full border-2 border-slate-200" />
            {/* Spinning arc */}
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-slate-900" />
            {/* Inner dot */}
            <span className="h-3 w-3 rounded-full bg-slate-900" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-slate-900">
              Opening your workspace
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Hang tight, this takes a moment…
            </p>
          </div>
        </div>
      )}
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl tracking-tight text-slate-950">
          {isSignup ? "Create workspace" : "Login"}
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
                  error={fieldErrors.companyName}
                />
                <Field
                  label="Workspace slug"
                  value={form.companySlug}
                  onChange={(value) =>
                    updateField("companySlug", normalizeWorkspaceSlug(value))
                  }
                  placeholder="bluepeak-studio"
                  maxLength={WORKSPACE_SLUG_MAX_LENGTH}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  error={fieldErrors.companySlug}
                />
                <Field
                  label="Country code"
                  value={form.countryCode}
                  onChange={(value) => updateField("countryCode", value)}
                  placeholder="IN"
                  error={fieldErrors.countryCode}
                />
                <Field
                  label="GSTIN"
                  value={form.gstin}
                  onChange={(value) => updateField("gstin", value)}
                  placeholder="27AAAAA0000A1Z5"
                  error={fieldErrors.gstin}
                />
                <Field
                  label="First name"
                  value={form.firstName}
                  onChange={(value) => updateField("firstName", value)}
                  error={fieldErrors.firstName}
                />
                <Field
                  label="Last name"
                  value={form.lastName}
                  onChange={(value) => updateField("lastName", value)}
                  error={fieldErrors.lastName}
                />
                <Field
                  label="Mobile number"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(value) =>
                    updateField("phoneNumber", value.replace(/\D/g, ""))
                  } 
                  placeholder="9999999999"
                  inputMode="numeric"
                  autoComplete="tel"
                  className="sm:col-span-2"
                  error={fieldErrors.phoneNumber}
                />
              </>
            ) : null}

            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(value) => updateField("email", value)}
              className="sm:col-span-2"
              error={fieldErrors.email}
            />

            {!isSignup ? (
              <label className="space-y-2 sm:col-span-2">
                <Label htmlFor="workspaceSlug">Workspace</Label>
                <select
                  id="workspaceSlug"
                  value={form.companySlug}
                  onChange={(event) =>
                    updateField("companySlug", event.target.value)
                  }
                  disabled={
                    isLoadingWorkspaces || workspaceOptions.length === 0
                  }
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {isLoadingWorkspaces
                      ? "Loading workspaces..."
                      : "Select your workspace"}
                  </option>
                  {workspaceOptions.map((workspace) => (
                    <option
                      key={workspace.tenant_id}
                      value={workspace.tenant_slug}
                    >
                      {workspace.tenant_name} ({workspace.tenant_slug})
                    </option>
                  ))}
                </select>
                {workspaceLookupError ? (
                  <p className="text-sm text-rose-600">
                    {workspaceLookupError}
                  </p>
                ) : workspaceOptions.length === 0 && form.email.trim() ? (
                  <p className="text-sm text-slate-500">
                    No workspaces found for this email.
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">
                    Choose the workspace you want to access with this email.
                  </p>
                )}
              </label>
            ) : null}

            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={(value) => updateField("password", value)}
              className="sm:col-span-2"
              error={fieldErrors.password}
            />

            {isSignup ? (
              <>
                <Field
                  label="Confirm password"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(value) => updateField("confirmPassword", value)}
                  error={fieldErrors.confirmPassword}
                />
                <Field
                  label="Timezone"
                  value={form.timezone}
                  onChange={(value) => updateField("timezone", value)}
                  placeholder="Asia/Kolkata"
                  error={fieldErrors.timezone}
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
                {fieldErrors.companyAddress ? (
                  <p className="text-sm text-rose-600">
                    {fieldErrors.companyAddress}
                  </p>
                ) : null}
              </label>

              <div className="sm:col-span-2">
                <Label htmlFor="signupOtp">Email OTP</Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    id="signupOtp"
                    value={form.otp}
                    onChange={(event) => updateField("otp", event.target.value)}
                    placeholder="6-digit code"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendSignupOtp}
                    disabled={
                      isSendingOtp ||
                      status.kind === "loading" ||
                      resendCooldown > 0 ||
                      !canSendOtp
                    }
                    className="shrink-0"
                  >
                    {isSendingOtp
                      ? "Sending..."
                      : resendCooldown > 0
                        ? `Resend OTP (${resendCooldown}s)`
                        : otpSent
                          ? "Resend OTP"
                          : "Send OTP"}
                  </Button>
                </div>
                {fieldErrors.otp ? (
                  <p className="mt-1 text-sm text-rose-600">
                    {fieldErrors.otp}
                  </p>
                ) : otpSent ? (
                  <p className="mt-1 text-sm text-emerald-600">
                    OTP sent to {otpSentForEmail || form.email}. Enter the
                    6-digit code to continue.
                  </p>
                ) : !canSendOtp ? (
                  <p className="mt-1 text-sm text-slate-500">
                    Fill required fields (company name, workspace slug, email,
                    mobile number, password) before sending OTP.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    Send an OTP to unlock account creation.
                  </p>
                )}
              </div>

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
            className="w-full gap-2 transition-all"
            disabled={
              status.kind === "loading" ||
              isRedirecting ||
              (isSignup &&
                (!otpSent ||
                  otpSentForEmail !== form.email.trim().toLowerCase() ||
                  form.otp.trim().length !== 6))
            }
          >
            {isRedirecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening workspace…
              </>
            ) : status.kind === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isSignup ? "Creating account…" : "Signing in…"}
              </>
            ) : (
              <>
                {isSignup ? "Create account" : "Sign in"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          {isSignup ? (
            <p className="text-center text-xs text-slate-500">
              Send the OTP first, then enter the 6-digit code to enable account
              creation.
            </p>
          ) : null}

          {!isSignup ? (
            <div className="text-right text-sm">
              <Link
                href="/forgot-password"
                className="text-blue-600 hover:text-blue-700"
              >
                Forgot password?
              </Link>
            </div>
          ) : null}
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
  maxLength,
  autoCapitalize,
  autoComplete,
  inputMode,
  spellCheck,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  autoCapitalize?: string;
  autoComplete?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  spellCheck?: boolean;
  error?: string;
}) {
  return (
    <label className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={spellCheck}
        aria-invalid={Boolean(error)}
        className={
          error ? "border-rose-500 focus-visible:ring-rose-500" : undefined
        }
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </label>
  );
}
