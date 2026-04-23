import Image from "next/image";
import Link from "next/link";

const footerLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="relative flex h-18 w-34 items-center justify-center overflow-hidden">
              <Image
                src="/logo/logo.png"
                alt="Spendly logo"
                fill
                sizes="80px"
                className="object-contain"
              />
            </span>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-600">
            Clean receipt capture, approvals, and compliance reporting for teams
            that want a professional workflow.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-950">Navigation</p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="transition-colors hover:text-slate-950"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-950">Contact</p>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p>
              For product questions, reach the team through the contact section.
            </p>
            <p>Built for founders, managers, employees, and accountants.</p>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">
          <p>© 2026 Spendly. All rights reserved.</p>
          <p>Professional expense management for India-first teams.</p>
        </div>
      </div>
    </footer>
  );
}
