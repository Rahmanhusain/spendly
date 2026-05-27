"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTransition, useRef, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
  Search,
  Building2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import type { TenantWithStats } from "../lib/repositories/adminRepository";
import { RefreshButton } from "./refresh-button";

const STATUS_PILL: Record<string, string> = {
  active: "bg-slate-950 text-white",
  inactive: "bg-slate-200 text-slate-600",
  suspended: "bg-slate-100 text-slate-500",
};

const PLAN_PILL = "border border-slate-200 bg-white text-slate-600";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface Props {
  rows: TenantWithStats[];
  total: number;
  offset: number;
  limit: number;
  search: string;
  statusFilter: string;
}

export function AccountsClient({
  rows,
  total,
  offset,
  limit,
  search,
  statusFilter,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Debounced search
  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ search: value, offset: "0" });
    }, 400);
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams({
      ...(searchInput && { search: searchInput }),
      ...(statusFilter && { status: statusFilter }),
      offset: String(offset),
      ...params,
    });
    [...sp.keys()].forEach((k) => {
      if (!sp.get(k)) sp.delete(k);
    });
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Accounts
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            All tenant workspaces — {total} total.
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search workspace name or slug…"
            className="h-9 rounded-lg border-slate-200 pl-9 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => navigate({ status: e.target.value, offset: "0" })}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {isPending ? (
            <div className="space-y-0 divide-y divide-slate-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-40 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-64 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Building2 className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">No workspaces found.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((tenant) => (
                <li key={tenant.id}>
                  <Link
                    href={`/accounts/${tenant.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5 sm:py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                        <Building2 className="h-4 w-4 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-950">
                            {tenant.name}
                          </p>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_PILL[tenant.status] ?? "bg-slate-100 text-slate-600"}`}
                          >
                            {tenant.status}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PLAN_PILL}`}
                          >
                            {tenant.plan}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {tenant.slug} · {tenant.active_user_count}/
                          {tenant.user_count} users ·{" "}
                          {formatDate(tenant.created_at)}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {total > limit && (
            <>
              <Separator />
              <div className="flex items-center justify-between px-5 py-3">
                <p className="text-xs text-slate-500">
                  {offset + 1}–{Math.min(offset + limit, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0 || isPending}
                    onClick={() =>
                      navigate({ offset: String(Math.max(0, offset - limit)) })
                    }
                    className="h-8 rounded-lg border-slate-200 px-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-slate-600">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset + limit >= total || isPending}
                    onClick={() => navigate({ offset: String(offset + limit) })}
                    className="h-8 rounded-lg border-slate-200 px-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
