import RoutePage from "@/components/RoutePage";
import Workspace from "@/screens/Workspace";

export default function WorkspaceItemPage({ params }) {
  return (
    <RoutePage currentPageName="Item">
      <Workspace section="item" itemId={params?.itemId} />
    </RoutePage>
  );
}
