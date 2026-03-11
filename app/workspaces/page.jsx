import Workspaces from '@/screens/Workspaces';
import { requireServerAuth } from '@/lib/auth/server-guard';

export default async function WorkspacesPage() {
  await requireServerAuth('/workspaces');
  return <Workspaces />;
}
