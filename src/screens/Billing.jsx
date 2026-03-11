"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router";
import { createPageUrl } from "@/utils";
import PageLoadingState from "@/components/common/PageLoadingState";
import { StatePanel } from "@/components/common/StateDisplay";
import { getWorkspaceSession } from "@/lib/workspace-session";
import { workspaceDefaultUrl } from "@/components/utils/workspaceUrl";
import { isOwnerRole } from "@/lib/roles";
import { openStripeBilling } from "@/lib/openStripeBilling";

export default function Billing() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

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

    const redirectToStripe = async () => {
      try {
        const result = await openStripeBilling({
          workspaceId: storedWorkspace.id,
          returnUrl: `${window.location.origin}${createPageUrl("WorkspaceSettings")}`,
        });
        if (!result.ok && !cancelled) {
          setError(result.error || "Unable to open Stripe billing.");
        }
      } catch (billingError) {
        console.error("Failed to open Stripe billing:", billingError);
        if (!cancelled) {
          setError("Unable to open Stripe billing right now.");
        }
      }
    };

    void redirectToStripe();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <StatePanel
        tone="danger"
        title="Billing unavailable"
        description={error}
        action={() => window.location.reload()}
        actionLabel="Retry"
      />
    );
  }

  return <PageLoadingState text="Redirecting to Stripe billing..." />;
}
