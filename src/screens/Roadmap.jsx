import PublicCapabilityPage from "@/components/common/PublicCapabilityPage";

export default function Roadmap() {
  return (
    <PublicCapabilityPage
      pageKey="roadmap"
      eyebrow="Roadmap"
      title="Share priorities clearly so customers know what is next."
      subtitle="Base25 gives software teams a focused roadmap view that keeps internal planning and external communication aligned."
      imageSrc="/roadmap.png"
      imageAlt="Roadmap board in Base25"
      whyPoints={[
        "Customers lose trust when priorities are unclear.",
        "Internal teams need one reference point for what is in progress.",
        "Roadmap visibility reduces repetitive status questions.",
        "Planning gets faster when feedback and roadmap context live together.",
      ]}
      workflowSteps={[
        "Promote high-signal feedback into roadmap items.",
        "Move work through statuses that reflect real progress.",
        "Publish outcomes in changelog once roadmap work ships.",
      ]}
      valueStats={[
        { value: "Fewer surprises", label: "for internal and external stakeholders" },
        { value: "Better alignment", label: "across product, support, and leadership" },
        { value: "Stronger trust", label: "through transparent product direction" },
      ]}
    />
  );
}

