import { AuthForm } from "@/components/auth-form";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { getServerAuthContext } from "@/lib/middleware/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LoginPage() {
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
                  Sign in with your email and password to access your workspace
                  and review pending expenses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-7 text-slate-600">
                <p>✓ Secure, workspace-scoped access</p>
                <p>✓ Your role determines what you can see and approve</p>
                <p>✓ Sessions refresh automatically</p>
              </CardContent>
            </Card>

            <Card className="animate-in fade-in slide-in-from-right-4 duration-500 delay-100">
              <CardHeader>
                <CardTitle className="text-2xl text-slate-950">
                  Sign in
                </CardTitle>
                <CardDescription>
                  Enter your credentials to access your workspace.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AuthForm mode="login" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
