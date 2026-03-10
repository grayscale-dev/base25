import { notFound } from "next/navigation";
import RoutePage from "@/components/RoutePage";
import Workspace from "@/screens/Workspace";
import { getWorkspacePageName, isWorkspaceSection } from "@/lib/workspace-sections";

export default function WorkspaceSectionPage({ params }) {
  const { section } = params;
  const normalizedSection = String(section || "").toLowerCase();

  if (!isWorkspaceSection(normalizedSection)) {
    notFound();
  }

  const pageName = getWorkspacePageName(normalizedSection);
  if (!pageName) {
    notFound();
  }

  return (
    <RoutePage currentPageName={pageName}>
      <Workspace section={normalizedSection} />
    </RoutePage>
  );
}
