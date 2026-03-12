import Feedback from "@/screens/Feedback";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";

export const metadata = buildMarketingMetadata({
  title: "Feedback Management for Startup Teams | Base25",
  description:
    "Collect and organize customer feedback in one place. Base25 helps software teams prioritize clearly and move requests into roadmap decisions.",
  path: "/feedback",
});

export default function FeedbackPage() {
  return <Feedback />;
}

