import Image from "next/image";
import Link from "next/link";
import { Mail, Clock } from "lucide-react";

const footerLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Contact", href: "/contact" },
  { label: "Legal", href: "/legal" },
  { label: "Refund policy", href: "/legal?scroll=refund#refund-policy" },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Spendly",
  url: "https://spendly.software",
  logo: "https://spendly.software/logo/logo.png",
  description:
    "India-first expense management platform for approvals, and GST-ready reporting.",
  contactPoint: {
    "@type": "ContactPoint",
    email: "support@spendly.software",
    contactType: "customer support",
    availableLanguage: ["English", "Hindi"],
    hoursAvailable: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "10:00",
      closes: "18:00",
    },
  },
};

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.4fr_0.8fr_1fr] lg:px-8">
        {/* Brand */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-18 w-34 items-center justify-center overflow-hidden">
              <Image
                src="/logo/logo.png"
                alt="Spendly — India-first expense management"
                fill
                sizes="110px"
                className="object-contain"
              />
            </span>
          </div>
          <p className="max-w-sm text-sm leading-6 text-slate-600">
            Structured expense management, approvals, and GST-ready compliance
            reporting for teams that want a professional workflow.
          </p>
          <p className="text-xs text-slate-400">
            Designed for Indian businesses — founders, managers, and finance
            teams.
          </p>
        </div>

        {/* Navigation */}
        <nav aria-label="Footer navigation">
          <p className="text-sm font-semibold text-slate-950">Navigation</p>
          <ul className="mt-4 flex flex-col gap-2">
            {footerLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-sm text-slate-600 transition-colors hover:text-slate-950"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact — SEO-friendly address block */}
        <div>
          <p className="text-sm font-semibold text-slate-950">Contact</p>
          <address className="mt-4 space-y-3 not-italic">
            <a
              href="mailto:support@spendly.software"
              className="flex items-center gap-2.5 text-sm text-slate-600 transition-colors hover:text-slate-950"
              aria-label="Email Spendly support"
            >
              <Mail className="h-4 w-4 shrink-0 text-slate-400" />
              support@spendly.software
            </a>
            <div className="flex items-start gap-2.5 text-sm text-slate-600">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                Mon – Fri, 10 AM – 6 PM IST
                <br />
                <span className="text-xs text-slate-400">
                  We respond within one business day.
                </span>
              </span>
            </div>
          </address>
          <div className="mt-5">
            <Link
              href="/contact"
              className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Send us a message
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">
          <p>© 2026 Spendly. All rights reserved.</p>
          <p>
            India-first expense management — Receipt uploads, approvals &amp;
            GST reporting.
          </p>
        </div>
      </div>
    </footer>
  );
}
