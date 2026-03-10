"use client";

import RoutePage from '@/components/RoutePage';
import WorkspaceSettings from '@/screens/WorkspaceSettings';

export default function WorkspaceSettingsPage() {
  return (
    <RoutePage currentPageName="WorkspaceSettings">
      <WorkspaceSettings />
    </RoutePage>
  );
}
