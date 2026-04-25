import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { getDefaultPolicyForTenant } from "@/lib/repositories/policyRepository";
import { PolicySettingsPanel } from "@/components/policy-settings-panel";

export default async function WorkspacePoliciesPage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const policy = await getDefaultPolicyForTenant(authContext.tenantId);

  const canEdit =
    authContext.role === "admin" || authContext.role === "manager";

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
          Policy controls
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Expense policies
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Define category limits and warning behavior for receipt validation.
          This page allows policy setup and updates for your workspace.
        </p>
      </section>

      <PolicySettingsPanel
        initialPolicy={
          policy
            ? {
                id: policy.id,
                name: policy.name,
                description: policy.description,
                rules: policy.rules,
                version: policy.version,
                updated_at: policy.updated_at,
              }
            : null
        }
        canEdit={canEdit}
      />
    </div>
  );
}
