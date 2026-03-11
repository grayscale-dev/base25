import RoutePage from "@/components/RoutePage";
import Workspace from "@/screens/Workspace";
import { requireServerAuth } from "@/lib/auth/server-guard";

export default async function WorkspaceItemPage({ params }) {
  await requireServerAuth(
    `/workspace/${params?.slug || ""}/item/${params?.itemId || ""}`
  );
  return (
    <RoutePage currentPageName="Item">
      <Workspace section="item" itemId={params?.itemId} />
    </RoutePage>
  );
}
