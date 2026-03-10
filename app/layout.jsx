import "../src/index.css";
import "primeicons/primeicons.css";
import AppProviders from "@/components/AppProviders";
import { getSiteBaseUrl } from "@/lib/site-url";

const siteBaseUrl = getSiteBaseUrl();

export const metadata = {
  metadataBase: new URL(siteBaseUrl),
  title: "base25",
  description: "Customer feedback hub for product teams.",
  icons: {
    icon: "/base25-favicon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
