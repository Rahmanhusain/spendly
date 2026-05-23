import { buildPageMetadata } from "@/lib/seo";
import UploadReceiptClient from "./upload-receipt-client";

export const metadata = buildPageMetadata({
  title: "Upload receipt",
  description:
    "Upload a receipt with smart parsing and policy-ready context for accurate expense management.",
  noIndex: true,
});

export default function UploadReceiptPage() {
  return <UploadReceiptClient />;
}
