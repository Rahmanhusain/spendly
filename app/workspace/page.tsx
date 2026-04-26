import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { getTenantById, getUserById } from "@/lib/repositories/authRepository";
import { ArrowRight, BadgePlus, FileUp, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const metricCards = [
  {
    label: "Total spend this month",
    value: "₹78,500",
    note: "+12% vs last month",
  },
  {
    label: "Budget remaining",
    value: "₹21,500",
    note: "21% left in current cycle",
  },
  {
    label: "Pending approvals",
    value: "12",
    note: "3 require manager review",
  },
  {
    label: "Policy violations",
    value: "2",
    note: "Meal and travel limits flagged",
  },
];

const trendData = [
  { day: "Mon", value: 12 },
  { day: "Tue", value: 18 },
  { day: "Wed", value: 15 },
  { day: "Thu", value: 24 },
  { day: "Fri", value: 20 },
  { day: "Sat", value: 10 },
  { day: "Sun", value: 15 },
];

const categoryData = [
  { label: "Travel", value: "₹42,000", percent: 54 },
  { label: "Meals", value: "₹18,500", percent: 24 },
  { label: "Software", value: "₹10,000", percent: 13 },
  { label: "Office", value: "₹8,000", percent: 9 },
];

const activityItems = [
  {
    title: "Receipt uploaded",
    detail: "Sarah uploaded a hotel bill for client travel.",
    time: "5 min ago",
  },
  {
    title: "Report submitted",
    detail: "March site-visit expenses are ready for approval.",
    time: "18 min ago",
  },
  {
    title: "Manager comment",
    detail: "Please clarify the lunch receipt on the second day.",
    time: "42 min ago",
  },
  {
    title: "Invite accepted",
    detail: "A new manager joined the workspace today.",
    time: "1 hour ago",
  },
];

export default async function WorkspacePage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const [user, tenant] = await Promise.all([
    getUserById(authContext.userId),
    getTenantById(authContext.tenantId),
  ]);

  const displayName = user
    ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
    : "Workspace user";

  const roleLabel =
    authContext.role.charAt(0).toUpperCase() + authContext.role.slice(1);
  const canSendInvites =
    authContext.role === "admin" || authContext.role === "manager";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.8fr] lg:p-8">
          <div>
            <Badge className="w-fit border-amber-200 bg-amber-50 text-amber-700">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              15-day trial workspace
            </Badge>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950">
              Welcome back, {displayName || "there"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              {tenant?.name ?? "Your workspace"} · {roleLabel} access · Tenant
              ID {authContext.tenantId}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/workspace/upload-receipt"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-medium text-white shadow-lg shadow-slate-950/15 transition-transform hover:-translate-y-0.5 hover:bg-slate-900"
              >
                <FileUp className="h-4 w-4" />
                Upload receipt
              </Link>
              {canSendInvites ? (
                <Link
                  href="/team-setup"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                >
                  <BadgePlus className="h-4 w-4" />
                  Invite teammates
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Quick path
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                Start with receipt capture
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Send uploads to your report flow and keep approvals moving.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ["Upload receipt", "/workspace/upload-receipt"],
                ["Create report", "/workspace/create-report"],
                ["View all receipts", "/workspace/receipts"],
              ].map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                >
                  <span>{label}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => (
          <Card key={metric.label} className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl tracking-tight text-slate-950">
                {metric.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              {metric.note}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">
              Spending trend
            </CardTitle>
            <CardDescription>Last 7 days of workspace spend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 items-end gap-3">
              {trendData.map((point) => (
                <div
                  key={point.day}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="flex h-48 w-full items-end rounded-xl bg-slate-50 px-2 py-2">
                    <div
                      className="w-full rounded-xl bg-slate-900/90"
                      style={{ height: `${point.value * 8}px` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {point.day}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">
              Spend by category
            </CardTitle>
            <CardDescription>
              Top categories for the current month
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {categoryData.map((category) => (
              <div key={category.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-900">
                    {category.label}
                  </span>
                  <span className="text-slate-600">{category.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-slate-900"
                    style={{ width: `${category.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">
              Recent activity
            </CardTitle>
            <CardDescription>
              Latest receipts, reports, and team updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activityItems.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-slate-200 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-950">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {item.detail}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">{item.time}</span>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">
              Quick actions
            </CardTitle>
            <CardDescription>
              Shortcuts for the most common tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              ["Upload receipt", "/workspace/upload-receipt"],
              ["Create report", "/workspace/create-report"],
              ["View approvals", "/workspace/approvals"],
              ...(canSendInvites
                ? ([["Open invites", "/workspace/invites"]] as Array<
                    [string, string]
                  >)
                : []),
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
              >
                <span>{label}</span>
                <span className="text-slate-400">→</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">
              Approval queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>12 reports waiting for manager review</p>
            <p>3 items need policy clarifications</p>
            <p>2 reimbursements awaiting payment</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">
              Compliance summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>2 policy violations flagged this week</p>
            <p>1 duplicate receipt detected</p>
            <p>GST export ready for month close</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">
              Workspace status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>JWT session active and ready</p>
            <p>Tenant-scoped access enabled</p>
            <p>Dashboard refreshes automatically on login</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
