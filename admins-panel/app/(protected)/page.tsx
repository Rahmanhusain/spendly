import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Separator } from "../../components/ui/separator";
import {
  Inbox,
  MessageSquare,
  Users,
  Building2,
  ArrowRight,
  Circle,
} from "lucide-react";
import { RefreshButton } from "../../components/refresh-button";
import { getDashboardStats } from "../../lib/repositories/adminRepository";

const STATUS_PILL: Record<string, string> = {
  new: "bg-slate-950 text-white",
  in_review: "bg-slate-200 text-slate-800",
  reviewed: "bg-slate-100 text-slate-600",
  closed: "bg-slate-50 text-slate-400 border border-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  in_review: "In Review",
  reviewed: "Reviewed",
  closed: "Closed",
};

const REASON_LABELS: Record<string, string> = {
  complaint: "Complaint",
  suggestion: "Suggestion",
  feedback: "Feedback",
  query: "General Query",
  support: "Product Support",
  partnership: "Partnership",
};

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  const statCards = [
    {
      title: "Unread emails",
      icon: Inbox,
      value: stats.emails.unread,
      sub: `${stats.emails.total} total in inbox`,
      alert: stats.emails.unread > 0,
      href: "/inbox",
    },
    {
      title: "New inquiries",
      icon: MessageSquare,
      value: stats.inquiries.new,
      sub: `${stats.inquiries.total} total submissions`,
      alert: stats.inquiries.new > 0,
      href: "/inquiries",
    },
    {
      title: "Active workspaces",
      icon: Building2,
      value: stats.tenants.active,
      sub: `${stats.tenants.total} total tenants`,
      alert: false,
      href: "/accounts",
    },
    {
      title: "Active users",
      icon: Users,
      value: stats.users.active,
      sub: `${stats.users.total} total users`,
      alert: false,
      href: "/accounts",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Platform overview — Spendly admin panel.
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ title, icon: Icon, value, sub, alert, href }) => (
          <Link key={title} href={href} className="group block">
            <Card className="border-slate-200 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5 px-5">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {title}
                </CardTitle>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${alert ? "bg-slate-950" : "bg-slate-100"}`}
                >
                  <Icon
                    className={`h-4 w-4 ${alert ? "text-white" : "text-slate-500"}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <p className="text-3xl font-bold tracking-tight text-slate-950">
                  {value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{sub}</p>
                <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                  View details
                  <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Bottom grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Recent inquiries */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <CardTitle className="text-base text-slate-950">
                Recent inquiries
              </CardTitle>
              <CardDescription className="mt-0.5">
                Latest contact form submissions.
              </CardDescription>
            </div>
            <Link
              href="/inquiries"
              className="text-xs text-slate-500 underline-offset-4 hover:text-slate-950 hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recentInquiries.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <MessageSquare className="h-7 w-7 text-slate-300" />
                <p className="text-sm text-slate-500">No inquiries yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {stats.recentInquiries.map((inq) => (
                  <li key={inq.id}>
                    <Link
                      href={`/inquiries`}
                      className="flex items-start justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <Circle
                          className={`mt-1.5 h-2 w-2 shrink-0 ${inq.status === "new" ? "fill-slate-950 text-slate-950" : "fill-slate-300 text-slate-300"}`}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-950">
                            {inq.subject}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {inq.sender_name} ·{" "}
                            {REASON_LABELS[inq.reason] ?? inq.reason}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[inq.status] ?? "bg-slate-100 text-slate-600"}`}
                        >
                          {STATUS_LABELS[inq.status] ?? inq.status}
                        </span>
                        <span className="text-xs text-slate-400 tabular-nums">
                          {formatRelative(inq.created_at)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-base text-slate-950">
              Quick links
            </CardTitle>
            <CardDescription className="mt-0.5">
              Jump to common tasks.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {[
              {
                href: "/inbox",
                label: "View inbox",
                sub: `${stats.emails.unread} unread`,
                icon: Inbox,
              },
              {
                href: "/inquiries?status=new",
                label: "New inquiries",
                sub: `${stats.inquiries.new} pending`,
                icon: MessageSquare,
              },
              {
                href: "/accounts",
                label: "All workspaces",
                sub: `${stats.tenants.total} tenants`,
                icon: Building2,
              },
              {
                href: "/accounts",
                label: "User accounts",
                sub: `${stats.users.active} active`,
                icon: Users,
              },
            ].map(({ href, label, sub, icon: Icon }, i, arr) => (
              <div key={href + label}>
                <Link
                  href={href}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                      <Icon className="h-3.5 w-3.5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-950">
                        {label}
                      </p>
                      <p className="text-xs text-slate-500">{sub}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
                {i < arr.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
