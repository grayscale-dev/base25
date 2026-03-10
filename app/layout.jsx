import "../src/index.css";
import "primeicons/primeicons.css";
import AppProviders from "@/components/AppProviders";

const siteBaseUrl =
  process.env.NEXT_PUBLIC_BASE44_APP_BASE_URL?.replace(/\/$/, "") ||
  "https://base25.app";

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
