import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnimatedPageContent } from "@/components/animated-page-content";

export const metadata = buildPageMetadata({
  title: "Privacy Policy",
  description: "Read how Spendly handles workspace, account, and audit data.",
});

export default function PrivacyPage() {
  return (
    <main className="min-h-[calc(100vh-18.625rem)] bg-slate-50 flex flex-col">
      <AnimatedPageContent>
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl text-slate-950">
                Privacy policy
              </CardTitle>
              <CardDescription>
                How we treat workspace and account data on the public site.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-slate-600">
              <p>
                We only collect the data needed to create workspaces,
                authenticate users, and support the product experience.
              </p>
              <p>
                Expense data remains scoped to the workspace and access role
                that created it.
              </p>
              <p>
                Operational logs and audit events are retained for product
                integrity and compliance needs.
              </p>
              <Link
                href="/"
                className="inline-flex text-sm font-medium text-slate-950 underline-offset-4 hover:underline"
              >
                Return home
              </Link>
            </CardContent>
          </Card>
        </div>
      </AnimatedPageContent>
    </main>
  );
}
