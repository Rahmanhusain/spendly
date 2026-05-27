import * as React from "react";
import { cn } from "../../lib/utils";

const buttonVariants = {
  default:
    "bg-slate-900 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-950/20",
  outline:
    "border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-950/10",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: "default" | "sm";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
        size === "default" ? "h-10 px-4 py-2" : "h-9 px-3",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
