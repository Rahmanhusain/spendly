import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { buildPageMetadata } from "@/lib/seo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = buildPageMetadata({
  title: "Contact Spendly",
  description:
    "Get in touch with Spendly for onboarding help, product questions, or partnership requests.",
});

const contactPoints = [
  ["Product support", "Questions about setup, onboarding, or navigation."],
  ["Trial onboarding", "Help starting and evaluating the 15-day trial."],
  ["Partnerships", "Integration or operational collaboration requests."],
];

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <SiteHeader ctaLabel="Start 15-day trial" ctaHref="/sign-up" />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="overflow-hidden rounded-3xl">
            <CardHeader className="space-y-4 border-b border-slate-200 bg-slate-50/80">
              <Badge className="w-fit border-slate-200 bg-white text-slate-700">
                Contact
              </Badge>
              <CardTitle className="text-4xl tracking-tight text-slate-950 sm:text-5xl">
                Reach the team behind Spendly.
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7">
                If you are evaluating the product or need help with setup, this
                is the best place to start.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6 text-sm leading-7 text-slate-600">
              <p>
                We respond to product and onboarding questions during business
                hours.
              </p>
              <p>
                For quick access, you can also create a workspace and explore
                the product directly.
              </p>
              <Link
                href="/sign-up"
                className="inline-flex text-sm font-medium text-slate-950 underline-offset-4 hover:underline"
              >
                Create workspace
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">
                What you can ask about
              </CardTitle>
              <CardDescription>
                Use the right channel for the right kind of request.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contactPoints.map(([title, description]) => (
                <div
                  key={title}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="text-sm font-medium text-slate-950">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {description}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
