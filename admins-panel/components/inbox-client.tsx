"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
  Search,
  Mail,
  MailOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { InboundEmailRecord } from "../lib/repositories/adminRepository";
import { RefreshButton } from "./refresh-button";

interface Props {
  rows: InboundEmailRecord[];
  total: number;
  unreadCount: number;
  offset: number;
  limit: number;
  search: string;
  isReadFilter: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InboxClient({
  rows,
  total,
  unreadCount,
  offset,
  limit,
  search,
  isReadFilter,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<InboundEmailRecord | null>(null);
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams({
      ...(search && { search }),
      ...(isReadFilter && { isRead: isReadFilter }),
      offset: String(offset),
    });
    Object.entries(params).forEach(([k, v]) => {
      if (v === "") sp.delete(k);
      else sp.set(k, v);
    });
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  async function handleMarkRead(email: InboundEmailRecord) {
    if (email.is_read) {
      setSelected(email);
      return;
    }
    setMarkingRead(email.id);
    await fetch(`/api/inbox/${email.id}/read`, { method: "POST" });
    setMarkingRead(null);
    setSelected({ ...email, is_read: true });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Inbox
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Emails received at support@spendly.software via Resend webhook.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              {unreadCount} unread
            </span>
          )}
          <RefreshButton />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            defaultValue={search}
            placeholder="Search sender or subject…"
            className="h-9 rounded-lg border-slate-200 pl-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                navigate({
                  search: (e.target as HTMLInputElement).value,
                  offset: "0",
                });
              }
            }}
          />
        </div>
        <select
          value={isReadFilter}
          onChange={(e) => navigate({ isRead: e.target.value, offset: "0" })}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
        >
          <option value="">All emails</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        {/* Email list */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <MailOpen className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-500">No emails found.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rows.map((email) => (
                  <li key={email.id}>
                    <button
                      onClick={() => handleMarkRead(email)}
                      disabled={markingRead === email.id}
                      className={`w-full px-5 py-4 text-left transition-colors hover:bg-slate-50 ${
                        selected?.id === email.id ? "bg-slate-50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 shrink-0">
                            {email.is_read ? (
                              <MailOpen className="h-4 w-4 text-slate-400" />
                            ) : (
                              <Mail className="h-4 w-4 text-slate-950" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`truncate text-sm ${email.is_read ? "text-slate-600" : "font-semibold text-slate-950"}`}
                            >
                              {email.from_address}
                            </p>
                            <p
                              className={`mt-0.5 truncate text-sm ${email.is_read ? "text-slate-500" : "text-slate-700"}`}
                            >
                              {email.subject}
                            </p>
                            {email.text_body && (
                              <p className="mt-0.5 truncate text-xs text-slate-400">
                                {email.text_body.slice(0, 100)}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="shrink-0 text-xs text-slate-400">
                          {formatDate(email.created_at)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Pagination */}
            {total > limit && (
              <>
                <Separator />
                <div className="flex items-center justify-between px-5 py-3">
                  <p className="text-xs text-slate-500">
                    {offset + 1}–{Math.min(offset + limit, total)} of {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset === 0 || isPending}
                      onClick={() =>
                        navigate({
                          offset: String(Math.max(0, offset - limit)),
                        })
                      }
                      className="h-8 rounded-lg border-slate-200 px-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex h-8 items-center px-2 text-xs text-slate-600">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset + limit >= total || isPending}
                      onClick={() =>
                        navigate({ offset: String(offset + limit) })
                      }
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

        {/* Email detail */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            {!selected ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <Mail className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-500">
                  Select an email to read it.
                </p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-semibold text-slate-950 leading-snug">
                      {selected.subject}
                    </p>
                    {!selected.is_read && (
                      <Badge className="shrink-0 border-slate-200 bg-slate-50 text-slate-700 text-xs">
                        Unread
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">From:</span>{" "}
                    {selected.from_address}
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">To:</span>{" "}
                    {selected.to_address}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(selected.created_at)}
                  </p>
                </div>
                <Separator />
                <div className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                  {selected.text_body ?? selected.html_body ?? "(No body)"}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
