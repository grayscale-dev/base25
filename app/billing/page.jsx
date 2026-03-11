import RoutePage from '@/components/RoutePage';
import Billing from '@/screens/Billing';
import { requireServerAuth } from '@/lib/auth/server-guard';

export default async function BillingPage() {
  await requireServerAuth('/billing');
  return (
    <RoutePage currentPageName="Billing">
      <Billing />
    </RoutePage>
  );
}
