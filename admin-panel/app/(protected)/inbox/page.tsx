import { listInboundEmails } from "../../../lib/repositories/adminRepository";
import { InboxClient } from "../../../components/inbox-client";

export const metadata = { title: "Inbox" };

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const offset = parseInt(sp.offset ?? "0");
  const limit = 20;
  const isReadParam = sp.isRead;

  const result = await listInboundEmails({
    isRead: isReadParam === undefined ? undefined : isReadParam === "true",
    search: sp.search ?? undefined,
    limit,
    offset,
  });

  return (
    <InboxClient
      rows={result.rows}
      total={result.total}
      unreadCount={result.unreadCount}
      offset={offset}
      limit={limit}
      search={sp.search ?? ""}
      isReadFilter={sp.isRead ?? ""}
    />
  );
}
