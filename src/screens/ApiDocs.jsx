"use client";

import { useEffect } from "react";
import { useNavigate } from "@/lib/router";
import { createPageUrl } from "@/utils";
import PageLoadingState from "@/components/common/PageLoadingState";
import { getWorkspaceSession, setWorkspaceSettingsTabIntent } from "@/lib/workspace-session";
import { workspaceDefaultUrl } from "@/components/utils/workspaceUrl";
import { isAdminRole } from "@/lib/roles";

export default function ApiDocs() {
  const navigate = useNavigate();

  useEffect(() => {
    const { workspace: storedWorkspace, role: storedRole } = getWorkspaceSession();

    if (!storedWorkspace) {
      navigate(createPageUrl("Workspaces"), { replace: true });
      return;
    }

    if (!isAdminRole(storedRole)) {
      navigate(workspaceDefaultUrl(storedWorkspace.slug, storedRole || "contributor", false), {
        replace: true,
      });
      return;
    }

    setWorkspaceSettingsTabIntent("api");
    navigate(createPageUrl("WorkspaceSettings"), { replace: true });
  }, [navigate]);

  return <PageLoadingState text="Redirecting to API settings..." />;
}
