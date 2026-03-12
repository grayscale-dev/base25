import Changelog from "@/screens/Changelog";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";

export const metadata = buildMarketingMetadata({
  title: "Product Changelog Software | Base25",
  description:
    "Publish release updates that customers can follow. Base25 helps software teams close the loop from feedback to shipped changes.",
  path: "/changelog",
});

export default function ChangelogPage() {
  return <Changelog />;
}

