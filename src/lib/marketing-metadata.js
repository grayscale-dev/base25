const siteBaseUrl =
  process.env.NEXT_PUBLIC_BASE44_APP_BASE_URL?.replace(/\/$/, "") ||
  "https://base25.app";

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
