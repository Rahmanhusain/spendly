"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

type AnimatedPageContentProps = {
  children: ReactNode;
};

/**
 * Wraps page content with smooth fade-up animation
 * Uses key to trigger CSS keyframe animation on every route change
 */
export function AnimatedPageContent({ children }: AnimatedPageContentProps) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-slide-up">
      {children}
    </div>
  );
}
