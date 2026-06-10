"use client";

import { useState } from "react";
import { GstPermissionToggle } from "@/components/gst-permission-toggle";
import { RoleSelector } from "@/components/role-selector";

type MemberAccessControlsProps = {
  memberId: string;
  initialRole: "employee" | "manager";
  initialCanExportGst: boolean;
};

export function MemberAccessControls({
  memberId,
  initialRole,
  initialCanExportGst,
}: MemberAccessControlsProps) {
  const [role, setRole] = useState(initialRole);
  const isManager = role === "manager";

  return (
    <>
      <div className="mt-3 border-t border-slate-100 pt-3">
        <GstPermissionToggle
          memberId={memberId}
          initialValue={initialCanExportGst}
          forceEnabled={isManager}
        />
      </div>
      <RoleSelector
        memberId={memberId}
        initialRole={initialRole}
        onRoleChange={setRole}
      />
    </>
  );
}
