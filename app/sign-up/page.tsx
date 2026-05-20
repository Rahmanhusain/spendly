import { AuthForm } from "@/components/auth-form";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getServerAuthContext } from "@/lib/middleware/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SignUpPage() {
  const authContext = await getServerAuthContext();

  if (authContext) {
    redirect("/workspace");
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <SiteHeader ctaLabel="Home" ctaHref="/" />
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_34%)]" />
        <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid w-full gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <Card className="animate-in fade-in slide-in-from-left-4 duration-500">
              <CardHeader>
                <Badge className="w-fit border-slate-200 bg-white text-slate-700">
                  Create account
                </Badge>
                <CardTitle className="text-3xl tracking-tight text-slate-950">
                  Get your team organized
                </CardTitle>
                <CardDescription className="text-base leading-7">
                  Set up a workspace, invite your first admin, and start
                  capturing expenses in minutes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-7 text-slate-600">
                <p>✓ Create the workspace for your company</p>
                <p>✓ Set up the admin user and initial settings</p>
                <p>✓ Start collecting and reviewing expenses</p>
              </CardContent>
            </Card>

            <Card className="animate-in fade-in slide-in-from-right-4 duration-500 delay-100">
              <CardHeader>
                <CardTitle className="text-2xl text-slate-950">
                  Create account
                </CardTitle>
                <CardDescription>
                  Fill in your workspace and admin details to get started.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AuthForm mode="signup" />
                <p className="mt-4 text-sm text-slate-600">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-blue-600 hover:text-blue-700"
                  >
                    Login
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
