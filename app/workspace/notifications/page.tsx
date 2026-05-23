import { buildPageMetadata } from "@/lib/seo";
import NotificationsClient from "./notifications-client";

export const metadata = buildPageMetadata({
  title: "Notifications",
  description:
    "See receipts, report updates, and workspace alerts in one place.",
  noIndex: true,
});

export default function NotificationsPage() {
  return <NotificationsClient />;
}
