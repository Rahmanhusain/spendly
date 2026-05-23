"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

type AnimatedPageContentProps = {
  children: ReactNode;
};

/**
 * Wraps page content with the same fade-up motion used across public routes.
 */
export function AnimatedPageContent({ children }: AnimatedPageContentProps) {
  const pathname = usePathname();

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
