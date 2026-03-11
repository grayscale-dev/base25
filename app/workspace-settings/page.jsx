import RoutePage from '@/components/RoutePage';
import WorkspaceSettings from '@/screens/WorkspaceSettings';
import { requireServerAuth } from '@/lib/auth/server-guard';

export default async function WorkspaceSettingsPage() {
  await requireServerAuth('/workspace-settings');
  return (
    <RoutePage currentPageName="WorkspaceSettings">
      <WorkspaceSettings />
    </RoutePage>
  );
}
