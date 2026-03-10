import RoutePage from "@/components/RoutePage";
import Board from "@/screens/Board";

export default function WorkspaceItemPage({ params }) {
  return (
    <RoutePage currentPageName="Item">
      <Board section="item" itemId={params?.itemId} />
    </RoutePage>
  );
}
