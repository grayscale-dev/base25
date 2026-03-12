import { PageShell } from "@/components/common/PageScaffold";
import { StatePanel } from "@/components/common/StateDisplay";
import { useItemsController } from "@/screens/items/useItemsController";
import AllItemsPage from "@/screens/items/AllItemsPage";
import GroupItemsPage from "@/screens/items/GroupItemsPage";
import {
  WORKSPACE_ALL_SECTION,
  WORKSPACE_GROUP_SECTIONS,
} from "@/lib/workspace-sections";
import { isAdminRole } from "@/lib/roles";

export default function Items({ section, workspace, role, isPublicAccess, bootstrapData = null }) {
  const controller = useItemsController({ workspace, role, isPublicAccess, bootstrapData });
  const isAdmin = isAdminRole(role) && !isPublicAccess;

  if (!workspace?.id) {
    return (
      <PageShell>
        <StatePanel
          tone="danger"
          title="Workspace unavailable"
          description="Workspace context is missing. Re-open this workspace from the Workspaces page."
        />
      </PageShell>
    );
  }

  if (section === WORKSPACE_ALL_SECTION) {
    if (!isAdmin) {
      return (
        <PageShell>
          <StatePanel
            tone="danger"
            title="Access denied"
            description="Only workspace admins can access the All view."
          />
        </PageShell>
      );
    }

    return (
      <AllItemsPage
        workspace={workspace}
        role={role}
        isPublicAccess={isPublicAccess}
        controller={controller}
      />
    );
  }

  if (!WORKSPACE_GROUP_SECTIONS.includes(section)) {
    return (
      <PageShell>
        <StatePanel
          tone="danger"
          title="Invalid section"
          description="This workspace section does not exist."
        />
      </PageShell>
    );
  }

  return (
    <GroupItemsPage
      groupKey={section}
      workspace={workspace}
      role={role}
      isPublicAccess={isPublicAccess}
      controller={controller}
    />
  );
}
