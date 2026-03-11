import RoutePage from "@/components/RoutePage";
import Alerts from "@/screens/Alerts";
import { requireServerAuth } from "@/lib/auth/server-guard";

export default async function AlertsPage() {
  await requireServerAuth("/alerts");
  return (
    <RoutePage currentPageName="Alerts">
      <Alerts />
    </RoutePage>
  );
}
