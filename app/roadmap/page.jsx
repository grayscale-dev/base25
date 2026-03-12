import Roadmap from "@/screens/Roadmap";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";

export const metadata = buildMarketingMetadata({
  title: "Product Roadmap Software for Startups | Base25",
  description:
    "Share product direction with a clean roadmap workflow. Base25 keeps teams and customers aligned on what is planned, in progress, and shipped.",
  path: "/roadmap",
});

export default function RoadmapPage() {
  return <Roadmap />;
}

