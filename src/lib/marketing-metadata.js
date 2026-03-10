import { getSiteBaseUrl } from "@/lib/site-url";

const siteBaseUrl = getSiteBaseUrl();

export function buildMarketingMetadata({ title, description, path }) {
  const url = `${siteBaseUrl}${path}`;
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "base25",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
