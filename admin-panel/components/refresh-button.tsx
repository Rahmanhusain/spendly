"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  label?: string;
  className?: string;
}

export function RefreshButton({ label = "Refresh", className }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className={`h-9 gap-2 rounded-lg border-slate-200 px-3 text-sm text-slate-600 hover:text-slate-950 ${className ?? ""}`}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Refreshing…" : label}
    </Button>
  );
}
