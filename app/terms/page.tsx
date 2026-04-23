import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <SiteHeader ctaLabel="Start 15-day trial" ctaHref="/sign-up" />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-slate-950">
              Terms of service
            </CardTitle>
            <CardDescription>
              Simple product terms for the public site.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-slate-600">
            <p>
              Spendly is provided as a software service for workspace expense
              management.
            </p>
            <p>
              Users are responsible for the accuracy of the information they
              submit.
            </p>
            <p>
              The service may change as features expand across the product
              roadmap.
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
      <SiteFooter />
    </main>
  );
}
