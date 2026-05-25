import Image from "next/image";
import Link from "next/link";

const navItems = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Legal", href: "/legal" },
];

type SiteHeaderProps = {
  ctaLabel?: string;
  ctaHref?: string;
};

export function SiteHeader({
  ctaLabel = "Start 15-day trial",
  ctaHref = "/sign-up",
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo/logo.png"
            alt="Spendly logo"
            width={180}
            height={44}
            className="h-10 w-auto"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-sm text-slate-600 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 shadow-sm transition-all duration-200 hover:bg-slate-50"
          >
            Login
          </Link>
          <Link
            href={ctaHref}
            className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
