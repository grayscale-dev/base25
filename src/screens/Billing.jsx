"use client";

import { useEffect } from "react";
import { useNavigate } from "@/lib/router";
import { createPageUrl } from "@/utils";
import PageLoadingState from "@/components/common/PageLoadingState";
import { getWorkspaceSession } from "@/lib/workspace-session";
import { workspaceDefaultUrl } from "@/components/utils/workspaceUrl";
import { isOwnerRole } from "@/lib/roles";

export default function Billing() {
  const navigate = useNavigate();

  useEffect(() => {
    const { workspace: storedWorkspace, role: storedRole } = getWorkspaceSession();

    if (!storedWorkspace) {
      navigate(createPageUrl("Workspaces"), { replace: true });
      return;
    }

    if (!isOwnerRole(storedRole)) {
      navigate(workspaceDefaultUrl(storedWorkspace.slug, storedRole || "contributor", false), {
        replace: true,
      });
      return;
    }

    navigate(`${createPageUrl("WorkspaceSettings")}?tab=billing`, { replace: true });
  }, [navigate]);

  return <PageLoadingState text="Redirecting to billing settings..." />;
}
