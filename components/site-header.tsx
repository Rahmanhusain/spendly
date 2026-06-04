"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navItems = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/pricing" },
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="relative mx-auto flex w-full max-w-7xl flex-nowrap items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo/logo.png"
            alt="Spendly logo"
            width={180}
            height={44}
            className="h-8 w-auto sm:h-10"
            priority
          />
        </Link>

        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
          aria-controls="site-navigation"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="group inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition-all duration-200 hover:scale-105 hover:bg-slate-50 active:scale-95 active:bg-slate-100 lg:hidden"
        >
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 transition-colors duration-200 group-hover:bg-slate-200">
            <Menu
              className={`absolute h-4 w-4 transition-all duration-200 ${isMenuOpen ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
            />
            <X
              className={`absolute h-4 w-4 transition-all duration-200 ${isMenuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"}`}
            />
          </span>
          <span className="text-sm font-medium leading-none">Menu</span>
        </button>

        <nav
          id="site-navigation"
          className={`${isMenuOpen ? "flex" : "hidden"} absolute left-4 right-4 top-17 z-50 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 text-sm text-slate-600 shadow-lg shadow-slate-200/70 lg:static lg:z-auto lg:flex lg:w-auto lg:flex-row lg:items-center lg:gap-1 lg:rounded-full lg:border-slate-200 lg:bg-slate-50 lg:p-1`}
        >
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setIsMenuOpen(false)}
              className="rounded-xl px-4 py-2 transition-colors hover:bg-slate-50 hover:text-slate-950 lg:rounded-full lg:hover:bg-white"
            >
              {item.label}
            </Link>
          ))}

          <div className="mt-1 flex flex-col gap-2 border-t border-slate-200 pt-2 lg:hidden">
            <Link
              href="/login"
              onClick={() => setIsMenuOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium whitespace-nowrap text-slate-900 transition-colors hover:bg-slate-50"
            >
              Login
            </Link>
            <Link
              href={ctaHref}
              onClick={() => setIsMenuOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-slate-800"
            >
              {ctaLabel}
            </Link>
          </div>
        </nav>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <Link
            href="/login"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-sm font-medium whitespace-nowrap text-slate-900 shadow-sm transition-all duration-200 hover:bg-slate-50 sm:h-11 sm:px-5"
          >
            Login
          </Link>
          <Link
            href={ctaHref}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-slate-950 px-3 text-sm font-medium whitespace-nowrap text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md sm:h-11 sm:px-5"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
