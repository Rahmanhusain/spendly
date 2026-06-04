import { AuthForm } from "@/components/auth-form";
import { buildPageMetadata } from "@/lib/seo";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { redirectToWorkspace } from "@/lib/auth/redirect";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnimatedPageContent } from "@/components/animated-page-content";

export const metadata = buildPageMetadata({
  title: "Sign in",
  description:
    "Sign in to your Spendly workspace to review expenses, approvals, and team activity.",
  noIndex: true,
});

export default async function LoginPage() {
  const authContext = await getServerAuthContext();

  if (authContext) {
    redirectToWorkspace();
  }

  return (
    <main className="min-h-[calc(100vh-18.625rem)] bg-slate-50 flex flex-col">
      <AnimatedPageContent>
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_34%)]" />
          <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
            <div className="grid w-full gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <Card className="animate-in fade-in slide-in-from-left-4 duration-500">
                <CardHeader>
                  <Badge className="w-fit border-slate-200 bg-white text-slate-700">
                    Access workspace
                  </Badge>
                  <CardTitle className="text-3xl tracking-tight text-slate-950">
                    Welcome back
                  </CardTitle>
                  <CardDescription className="text-base leading-7">
                    Enter your email first, pick the workspace that appears,
                    then sign in with your password.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-7 text-slate-600">
                  <p>✓ Secure, workspace-scoped access</p>
                  <p>✓ Your role determines what you can see and approve</p>
                  <p>✓ Sessions refresh automatically</p>
                </CardContent>
              </Card>

              <Card className="animate-in fade-in slide-in-from-right-4 duration-500 delay-100">
                <CardHeader></CardHeader>
                <CardContent>
                  <AuthForm mode="login" />
                  <p className="mt-4 text-sm text-slate-600">
                    New to Spendly?{" "}
                    <Link
                      href="/sign-up"
                      className="font-medium text-blue-600 hover:text-blue-700"
                    >
                      Create account
                    </Link>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AnimatedPageContent>
    </main>
  );
}
