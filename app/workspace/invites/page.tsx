import Link from "next/link";
import { MailPlus, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const inviteItems = [
  { email: "alex@spendly.test", role: "Manager", status: "Sent" },
  { email: "sara@spendly.test", role: "Employee", status: "Pending" },
  { email: "finance@spendly.test", role: "Admin", status: "Accepted" },
];

export default function InvitesPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Invites
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Keep workspace access moving.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Review sent invites and continue onboarding the team.
            </p>
          </div>
          <Link
            href="/team-setup"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-900"
          >
            Invite teammates
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">
                Invite list
              </CardTitle>
              <CardDescription>
                Current teammates and their access status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {inviteItems.map((item) => (
                <article
                  key={item.email}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-950">{item.email}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.role}</p>
                    </div>
                    <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                      {item.status}
                    </Badge>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">
                Team growth
              </CardTitle>
              <CardDescription>
                Invite more people to handle approvals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <p className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-900" /> Shared access keeps
                the workflow clear.
              </p>
              <p className="inline-flex items-center gap-2">
                <MailPlus className="h-4 w-4 text-emerald-600" /> New invites
                are tracked here as well.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
