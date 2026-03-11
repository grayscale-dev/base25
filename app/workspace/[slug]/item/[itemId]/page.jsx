import RoutePage from "@/components/RoutePage";
import Workspace from "@/screens/Workspace";
import { requireServerAuth } from "@/lib/auth/server-guard";

export default async function WorkspaceItemPage({ params }) {
  const resolvedParams = await params;
  await requireServerAuth(
    `/workspace/${resolvedParams?.slug || ""}/item/${resolvedParams?.itemId || ""}`
  );
  return (
    <RoutePage currentPageName="Item">
      <Workspace section="item" itemId={resolvedParams?.itemId} />
    </RoutePage>
  );
}
