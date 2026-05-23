import type { Metadata } from "next";

type PageMetadataInput = {
  title: string;
  description: string;
  noIndex?: boolean;
};

export function buildPageMetadata({
  title,
  description,
  noIndex = false,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      siteName: "Spendly",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
