import { useEffect } from "react";
import { useNavigate } from "@/lib/router";
import { createPageUrl } from "@/utils";
import PageLoadingState from "@/components/common/PageLoadingState";
import { getBoardSession } from "@/lib/board-session";
import { workspaceDefaultUrl } from "@/components/utils/boardUrl";

export default function ApiDocs() {
  const navigate = useNavigate();

  useEffect(() => {
    const { workspace: storedWorkspace, role: storedRole } = getBoardSession();

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
