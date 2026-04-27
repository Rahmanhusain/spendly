import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { ApprovalsWorkspace } from "./approvals-workspace";

export default async function ApprovalsPage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const canApprove =
    authContext.role === "admin" || authContext.role === "manager";

  return <ApprovalsWorkspace canApprove={canApprove} />;
}
