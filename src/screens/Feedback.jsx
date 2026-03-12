import PublicCapabilityPage from "@/components/common/PublicCapabilityPage";

export default function Feedback() {
  return (
    <PublicCapabilityPage
      pageKey="feedback"
      eyebrow="Feedback"
      title="Centralize customer feedback before it gets lost."
      subtitle="Capture feature requests in one place, group similar demand, and keep product decisions grounded in real user input."
      imageSrc="/feedback-page.png"
      imageAlt="Feedback management workspace in Base25"
      whyPoints={[
        "Requests are often fragmented across support, email, and chat.",
        "Without structure, urgent asks can overshadow strategic demand.",
        "Teams need one reliable intake point to prioritize effectively.",
        "Customers want to know their input is seen and considered.",
      ]}
      workflowSteps={[
        "Collect feedback from your workspace and keep it visible.",
        "Organize requests by status and type so demand is easy to triage.",
        "Move validated demand into roadmap priorities and later into changelog updates.",
      ]}
      valueStats={[
        { value: "Less noise", label: "in product planning conversations" },
        { value: "Higher confidence", label: "in prioritization decisions" },
        { value: "Clearer visibility", label: "for customer-submitted ideas" },
      ]}
    />
  );
}

