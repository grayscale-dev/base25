"use client";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@/lib/router";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageLoadingState from "@/components/common/PageLoadingState";
import { StatePanel } from "@/components/common/StateDisplay";
import { setBoardSession } from "@/lib/board-session";
import { workspaceUrl } from "@/components/utils/boardUrl";
import {
  getDefaultWorkspaceSection,
  resolveWorkspaceSection,
} from "@/lib/workspace-sections";
import Items from "./Items";
import WorkspaceItemView from "./items/WorkspaceItemView";

function toSingleRouteParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default function Board({ section = "items", itemId = null }) {
  const navigate = useNavigate();
  const params = useParams();
  const routeSlug = toSingleRouteParam(params?.slug);
  const routeSection = String(section || "items").toLowerCase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessRequired, setAccessRequired] = useState(false);
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [slug, setSlug] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [role, setRole] = useState("viewer");
  const [isPublicAccess, setIsPublicAccess] = useState(false);
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    void initializeBoard(routeSlug, routeSection, itemId);
  }, [routeSlug, routeSection, itemId]);

  const initializeBoard = async (routeSlugParam, sectionParam, itemIdParam) => {
    try {
      setLoading(true);
      setError(null);
      setAccessRequired(false);
      setActiveSection(null);

      if (!routeSlugParam) {
        setError("Invalid workspace URL");
        setLoading(false);
        return;
      }

      const workspaceSlug = routeSlugParam;
      setSlug(workspaceSlug);

      let resolvedWorkspace = null;
      try {
        const { data } = await base44.functions.invoke("publicGetBoard", {
          slug: workspaceSlug,
        });
        resolvedWorkspace = data;
      } catch (publicError) {
        const status = publicError?.status || publicError?.response?.status;
        if (status === 401) {
          try {
            await base44.auth.logout();
          } catch {
            // Ignore logout failures.
          }
          const returnUrl = window.location.pathname;
          base44.auth.redirectToLogin(window.location.origin + returnUrl);
          return;
        }
        if (status === 403) {
          try {
            await base44.auth.me();
          } catch {
            const returnUrl = window.location.pathname;
            base44.auth.redirectToLogin(window.location.origin + returnUrl);
            return;
          }
          setAccessRequired(true);
          setLoading(false);
          return;
        }
        throw publicError;
      }

      if (!resolvedWorkspace) {
        setError("Workspace not found");
        setLoading(false);
        return;
      }

      let role = "viewer";
      let isPublicAccess = false;

      try {
        const user = await base44.auth.me();
        const roles = await base44.entities.BoardRole.filter({
          board_id: resolvedWorkspace.id,
          user_id: user.id,
        });

        if (roles.length > 0) {
          role = roles[0].role;
          isPublicAccess = false;
        } else if (resolvedWorkspace.visibility === "restricted") {
          setAccessRequired(true);
          setLoading(false);
          return;
        } else {
          role = "viewer";
          isPublicAccess = true;
        }
      } catch {
        if (resolvedWorkspace.visibility !== "public") {
          setError("This workspace is private. Please log in to access it.");
          setLoading(false);
          return;
        }
        isPublicAccess = true;
      }

      if (sectionParam === "item") {
        if (!itemIdParam) {
          setError("Invalid item URL.");
          setLoading(false);
          return;
        }

        setBoardSession({ workspace: resolvedWorkspace, role, isPublicAccess });
        setWorkspace(resolvedWorkspace);
        setRole(role);
        setIsPublicAccess(isPublicAccess);
        setActiveSection("item");
        setLoading(false);
        return;
      }

      const targetSection = resolveWorkspaceSection(sectionParam, role, isPublicAccess);
      if (!targetSection) {
        setError("Invalid workspace section.");
        setLoading(false);
        return;
      }

      setBoardSession({ workspace: resolvedWorkspace, role, isPublicAccess });
      setWorkspace(resolvedWorkspace);
      setRole(role);
      setIsPublicAccess(isPublicAccess);

      if (targetSection !== sectionParam) {
        navigate(workspaceUrl(workspaceSlug, targetSection), { replace: true });
        return;
      }

      setActiveSection(targetSection);
      setLoading(false);
    } catch (initializationError) {
      console.error("Workspace initialization error:", initializationError);
      setError("Unable to open workspace");
      setLoading(false);
    }
  };

  const handleAccessCodeSubmit = async () => {
    if (!accessCode.trim() || !slug) return;
    setAccessSubmitting(true);
    setError(null);
    try {
      const { data } = await base44.functions.invoke("joinBoardWithAccessCode", {
        slug,
        access_code: accessCode.trim(),
      });

      if (data?.board) {
        const nextRole = data.role || "contributor";
        const targetSection = getDefaultWorkspaceSection(nextRole, false);
        setBoardSession({
          workspace: data.board,
          role: nextRole,
          isPublicAccess: false,
        });
        navigate(workspaceUrl(data.board.slug, targetSection), { replace: true });
      }
    } catch (joinError) {
      console.error("Failed to join with access code:", joinError);
      setError("Invalid access code. Please try again.");
    } finally {
      setAccessSubmitting(false);
    }
  };

  if (loading) {
    return <PageLoadingState fullHeight text="Loading workspace..." className="bg-slate-50" />;
  }

  if (accessRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Enter access code</h2>
            <p className="mt-2 text-slate-600">
              This workspace is private. Enter the access code provided by an admin.
            </p>
          </div>
          <div className="space-y-3">
            <Input
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="Access code"
              className="text-center uppercase tracking-[0.3em]"
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAccessCodeSubmit();
              }}
            />
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </div>
          <Button
            onClick={handleAccessCodeSubmit}
            disabled={accessSubmitting || !accessCode.trim()}
            className="w-full bg-slate-900 hover:bg-slate-800"
          >
            {accessSubmitting ? "Checking..." : "Join Workspace"}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    const isPrivateBoardError = error.toLowerCase().includes("private");
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <StatePanel
          tone="danger"
          title="Unable to open workspace"
          description={error}
          action={isPrivateBoardError ? () => base44.auth.redirectToLogin(window.location.href) : () => navigate("/")}
          actionLabel={isPrivateBoardError ? "Login" : "Go Home"}
          secondaryAction={isPrivateBoardError ? () => navigate("/") : undefined}
          secondaryActionLabel={isPrivateBoardError ? "Go Home" : undefined}
        />
      </div>
    );
  }

  if (!workspace || !activeSection) {
    return <PageLoadingState fullHeight text="Loading workspace..." className="bg-slate-50" />;
  }

  if (activeSection === "item") {
    return (
      <WorkspaceItemView
        workspace={workspace}
        role={role}
        isPublicAccess={isPublicAccess}
        itemId={itemId}
      />
    );
  }

  return (
    <Items
      workspace={workspace}
      role={role}
      isPublicAccess={isPublicAccess}
      section={activeSection}
    />
  );
}
