import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { getReceiptsForTenant } from "@/lib/repositories/receiptRepository";
import { ReceiptsWorkspace } from "./receipts-workspace";

export default async function AllReceiptsPage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const receipts = await getReceiptsForTenant(authContext.tenantId);

  return <ReceiptsWorkspace receipts={receipts} />;
}
