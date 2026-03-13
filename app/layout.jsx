import "../src/index.css";
import "primeicons/primeicons.css";
import AppProviders from "@/components/AppProviders";
import { getSiteBaseUrl } from "@/lib/site-url";
import { Analytics } from "@vercel/analytics/next";

const siteBaseUrl = getSiteBaseUrl();

export const metadata = {
  metadataBase: new URL(siteBaseUrl),
  title: "Base25",
  description: "The simplest feedback hub for software teams.",
  icons: {
    icon: "/base25-favicon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
