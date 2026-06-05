"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function RefreshOnceClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("refresh") === "1") {
      window.location.replace(pathname);
    }
  }, [pathname, searchParams]);

  return null;
}
