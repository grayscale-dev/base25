import { useEffect } from "react";
import { useNavigate } from "@/lib/router";
import { createPageUrl } from "@/utils";
import PageLoadingState from "@/components/common/PageLoadingState";
import { getWorkspaceSession } from "@/lib/workspace-session";
import { workspaceDefaultUrl } from "@/components/utils/workspaceUrl";

export default function ApiDocs() {
  const navigate = useNavigate();

  useEffect(() => {
    const { workspace: storedWorkspace, role: storedRole } = getWorkspaceSession();

    if (!storedWorkspace) {
      navigate(createPageUrl("Workspaces"), { replace: true });
      return;
    }

    if (storedRole !== "admin") {
      navigate(workspaceDefaultUrl(storedWorkspace.slug, storedRole || "viewer", false), {
        replace: true,
      });
      return;
    }

    navigate(`${createPageUrl("WorkspaceSettings")}?tab=api`, { replace: true });
  }, [navigate]);

  return <PageLoadingState text="Redirecting to API settings..." />;
}
