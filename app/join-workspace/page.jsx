import JoinWorkspace from '@/screens/JoinWorkspace';
import { requireServerAuth } from '@/lib/auth/server-guard';

export default async function JoinWorkspacePage() {
  await requireServerAuth('/join-workspace');
  return <JoinWorkspace />;
}
