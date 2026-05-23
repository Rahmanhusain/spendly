import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader ctaLabel="Start 15-day trial" ctaHref="/sign-up" />
      {children}
      <SiteFooter />
    </>
  );
}
