"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AnimatedPageContent } from "@/components/animated-page-content";
import { Mail, MessageSquare, Clock, CheckCircle2 } from "lucide-react";

const contactReasons = [
  { value: "complaint", label: "Complaint" },
  { value: "suggestion", label: "Suggestion" },
  { value: "feedback", label: "Feedback" },
  { value: "query", label: "General Query" },
  { value: "support", label: "Product Support" },
  { value: "partnership", label: "Partnership" },
];

const infoItems = [
  {
    icon: Mail,
    title: "Email us directly",
    description: "For detailed questions or formal requests.",
    detail: "support@spendly.software",
    href: "mailto:support@spendly.software",
  },
  {
    icon: Clock,
    title: "Response time",
    description: "We aim to respond within one business day.",
    detail: "Mon – Fri, 10 AM – 6 PM IST",
    href: null,
  },
  {
    icon: MessageSquare,
    title: "What to include",
    description: "Your workspace name, role, and a clear description of the issue.",
    detail: null,
    href: null,
  },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1200);
  }

  return (
    <main className="min-h-[calc(100vh-18.625rem)] bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,1),rgba(248,250,252,1))]">
      <AnimatedPageContent>
        <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

          {/* Hero — matches how-it-works layout */}
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.92fr] lg:items-start">
            <div className="space-y-6">
              <Badge className="w-fit border-slate-200 bg-white text-slate-700">
                Contact
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  We&apos;re here whenever you need us.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  Complaint, suggestion, feedback, or just a question — send us
                  a message and we&apos;ll get back to you within one business day.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href="mailto:support@spendly.software"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
                >
                  support@spendly.software
                </a>
                <Link
                  href="/how-it-works"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                >
                  How it works
                </Link>
              </div>
            </div>

            {/* Info card */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-slate-950">
                  Get in touch
                </CardTitle>
                <CardDescription>
                  Use the right channel for the right kind of request.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {infoItems.map(({ icon: Icon, title, description, detail, href }, index) => (
                  <div key={title} className="space-y-4">
                    {index > 0 && <Separator />}
                    <div className="flex items-start gap-4 pt-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-950">{title}</p>
                        <p className="text-sm leading-6 text-slate-600">{description}</p>
                        {detail && href && (
                          <a
                            href={href}
                            className="text-sm font-medium text-slate-950 underline-offset-4 hover:underline"
                          >
                            {detail}
                          </a>
                        )}
                        {detail && !href && (
                          <p className="text-sm text-slate-500">{detail}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Form + sidebar */}
          <div className="mt-10 grid gap-4 lg:grid-cols-7">

            {/* Contact form */}
            <Card className="lg:col-span-4 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-slate-950">
                  Send us a message
                </CardTitle>
                <CardDescription>
                  Fill in the form and we&apos;ll respond to your email.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submitted ? (
                  <div className="flex flex-col items-center gap-4 py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                      <CheckCircle2 className="h-7 w-7 text-slate-950" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-slate-950">
                        Message received
                      </p>
                      <p className="text-sm leading-6 text-slate-600">
                        We&apos;ll get back to you within one business day.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="mt-2 rounded-full border-slate-200"
                      onClick={() => setSubmitted(false)}
                    >
                      Send another message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                          Full name
                        </Label>
                        <Input
                          id="name"
                          placeholder="Rahul Sharma"
                          required
                          className="h-10 rounded-lg border-slate-200 text-sm placeholder:text-slate-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                          Email address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="rahul@company.com"
                          required
                          className="h-10 rounded-lg border-slate-200 text-sm placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reason" className="text-sm font-medium text-slate-700">
                        Reason for contact
                      </Label>
                      <select
                        id="reason"
                        required
                        defaultValue=""
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-1"
                      >
                        <option value="" disabled>Select a reason</option>
                        {contactReasons.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-sm font-medium text-slate-700">
                        Subject
                      </Label>
                      <Input
                        id="subject"
                        placeholder="Brief summary of your message"
                        required
                        className="h-10 rounded-lg border-slate-200 text-sm placeholder:text-slate-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-sm font-medium text-slate-700">
                        Message
                      </Label>
                      <Textarea
                        id="message"
                        placeholder="Describe your issue, suggestion, or question in detail…"
                        rows={5}
                        required
                        className="resize-none rounded-lg border-slate-200 text-sm placeholder:text-slate-400"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="h-11 w-full rounded-full bg-slate-950 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Sending…
                        </span>
                      ) : (
                        "Send message"
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="lg:col-span-3 space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-950">
                    What you can ask about
                  </CardTitle>
                  <CardDescription>
                    We handle all kinds of requests — pick the one that fits.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-7 text-slate-600">
                  <p>Complaints about the product or experience.</p>
                  <p>Suggestions for features or workflow improvements.</p>
                  <p>Feedback on anything — good or bad.</p>
                  <p>General queries about pricing, setup, or onboarding.</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-slate-900 text-white shadow-lg shadow-slate-300/40">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">
                    New to Spendly?
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Start a free 15-day trial and explore the product yourself.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Link
                    href="/sign-up"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-medium text-slate-950 transition-colors hover:bg-slate-150"
                  >
                    Start free trial
                  </Link>
                  <Link
                    href="/how-it-works"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-medium text-slate-950 transition-colors hover:bg-slate-150"
                  >
                    How it works
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>

        </section>
      </AnimatedPageContent>
    </main>
  );
}
