"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
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
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [status, setStatus] = useState<{
    kind: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ kind: "idle", message: "" });
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const sendOtp = async () => {
    setIsSendingOtp(true);
    setStatus({ kind: "loading", message: "Sending OTP..." });

    try {
      const response = await fetch("/api/auth/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        message?: string;
        error?: { code?: string; message?: string; retryAfter?: number };
      };

      if (!response.ok || !result.ok) {
        const retry = result.error?.retryAfter ?? 0;
        if (response.status === 429 && retry > 0) {
          setResendCooldown(retry);
        }

        setOtpSent(false);

        setStatus({
          kind: "error",
          message:
            result.error?.message ?? result.message ?? "Failed to send OTP.",
        });
        return;
      }

      setResendCooldown(60);
      setOtpSent(true);
      setStatus({
        kind: "success",
        message: "OTP has been sent to your email. You can now set a new password.",
      });
    } catch {
      setStatus({ kind: "error", message: "Failed to send OTP." });
    } finally {
      setIsSendingOtp(false);
    }
  };

  useEffect(() => {
    let t: number | undefined;
    if (resendCooldown > 0) {
      t = window.setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) {
            if (t) window.clearInterval(t);
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

  const resetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({ kind: "loading", message: "Resetting password..." });

    try {
      const response = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          otp,
          newPassword,
          confirmPassword,
        }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        message?: string;
        error?: { message?: string };
      };

      if (!response.ok || !result.ok) {
        setStatus({
          kind: "error",
          message:
            result.error?.message ?? result.message ?? "Password reset failed.",
        });
        return;
      }

      setStatus({
        kind: "success",
        message: "Password reset complete. You can now sign in.",
      });
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setStatus({ kind: "error", message: "Password reset failed." });
    }
  };

  const resetResetFields = () => {
    setOtpSent(false);
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <SiteHeader ctaLabel="Login" ctaHref="/login" />
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_34%)]" />
        <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
          <Card className="mx-auto w-full max-w-lg">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">
                Forgot Password
              </CardTitle>
              <CardDescription>
                Request an OTP on your email and use it to set a new password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={resetPassword} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        resetResetFields();
                      }}
                      placeholder="name@company.com"
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={sendOtp}
                      disabled={
                        isSendingOtp ||
                        status.kind === "loading" ||
                        resendCooldown > 0
                      }
                      className="shrink-0"
                    >
                      {isSendingOtp
                        ? "Sending..."
                        : resendCooldown > 0
                          ? `Send OTP (${resendCooldown}s)`
                          : "Send OTP"}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="otp">OTP</Label>
                  <Input
                    id="otp"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    placeholder="6-digit code"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    disabled={!otpSent}
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    disabled={!otpSent}
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat new password"
                    required
                    disabled={!otpSent}
                  />
                </div>

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
                  disabled={status.kind === "loading" || !otpSent}
                >
                  {status.kind === "loading"
                    ? "Resetting..."
                    : "Reset Password"}
                </Button>
              </form>

              <p className="mt-4 text-sm text-slate-600">
                Remembered your password?{" "}
                <Link
                  href="/login"
                  className="text-blue-600 hover:text-blue-700"
                >
                  Back to sign in
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
