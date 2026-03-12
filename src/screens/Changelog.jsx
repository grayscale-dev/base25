import PublicCapabilityPage from "@/components/common/PublicCapabilityPage";

export default function Changelog() {
  return (
    <PublicCapabilityPage
      pageKey="changelog"
      eyebrow="Changelog"
      title="Show shipped progress and keep customers engaged."
      subtitle="Publishing updates should be fast and consistent. Base25 helps teams communicate what changed and why it matters."
      imageSrc="/changelog.png"
      imageAlt="Changelog in Base25"
      whyPoints={[
        "Shipped work loses impact when updates are inconsistent.",
        "Customers need a simple way to follow product momentum.",
        "Support teams need a reference for what just launched.",
        "A clear changelog closes the feedback loop and drives trust.",
      ]}
      workflowSteps={[
        "When work ships, publish a changelog update from the same workspace.",
        "Connect updates back to the roadmap and feedback context.",
        "Keep release communication consistent without extra tools.",
      ]}
      valueStats={[
        { value: "Higher visibility", label: "for product improvements" },
        { value: "Stronger retention", label: "through clear update communication" },
        { value: "Better loop closure", label: "from request to shipped outcome" },
      ]}
    />
  );
}

