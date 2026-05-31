"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      // Go to marketing home — login only shows when accessing protected routes
      window.location.assign("/");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={cn("gap-2 text-sm font-medium", className)}
    >
      <LogOut className="h-4 w-4" />
      {isLoggingOut ? "Signing out..." : "Logout"}
    </Button>
  );
}
