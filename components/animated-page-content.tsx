"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect } from "react";

type AnimatedPageContentProps = {
  children: ReactNode;
};

/**
 * Wraps page content with the same fade-up motion used across public routes.
 */
export function AnimatedPageContent({ children }: AnimatedPageContentProps) {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <motion.div
      key={pathname}
      className="flex-1"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
