import HomePageClient from "@/components/home-page-client";
import { AnimatedPageContent } from "@/components/animated-page-content";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Spendly | AI expense management for teams",
  description:
    "Capture receipts, approve spend, and export GST-ready reports with Spendly.",
});

export default function HomePage() {
  return (
    <AnimatedPageContent>
      <HomePageClient />
    </AnimatedPageContent>
  );
}
