import RoutePage from '@/components/RoutePage';
import ApiDocs from '@/screens/ApiDocs';
import { requireServerAuth } from '@/lib/auth/server-guard';

export default async function ApiDocsPage() {
  await requireServerAuth('/api-docs');
  return (
    <RoutePage currentPageName="ApiDocs">
      <ApiDocs />
    </RoutePage>
  );
}
