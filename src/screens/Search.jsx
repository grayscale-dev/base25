"use client";

import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLocation, useNavigate } from "@/lib/router";
import { getWorkspaceSession } from "@/lib/workspace-session";
import { createPageUrl } from "@/utils";
import { workspaceItemUrl } from "@/components/utils/workspaceUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell } from "@/components/common/PageScaffold";
import PageLoadingState from "@/components/common/PageLoadingState";
import PageEmptyState from "@/components/common/PageEmptyState";
import { StatePanel } from "@/components/common/StateDisplay";
import WorkspaceItemCard from "@/components/workspace/WorkspaceItemCard";
import { isAdminRole } from "@/lib/roles";
import { WORKSPACE_LOADING_COPY } from "@/lib/workspace-loading";
import { fetchWorkspaceSearchCached } from "@/lib/workspace-queries";

function getSearchQueryFromUrl(search) {
  const params = new URLSearchParams(String(search || ""));
  return String(params.get("q") || "").trim();
}

function createMemberDirectoryMap(members) {
  const map = new Map();
  (members || []).forEach((member) => {
    if (!member?.user_id) return;
    const firstName = String(member.first_name || "").trim();
    const lastName = String(member.last_name || "").trim();
    const displayName = `${firstName} ${lastName}`.trim() || String(member.full_name || "").trim() || member.email;
    map.set(String(member.user_id), {
      ...member,
      display_name: displayName,
    });
  });
  return map;
}

export default function Search() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getWorkspaceSession();
  const [workspace, setWorkspace] = useState(session.workspace || null);
  const [role, setRole] = useState(session.role || "contributor");
  const [isPublicAccess, setIsPublicAccess] = useState(Boolean(session.isPublicAccess));
  const [queryInput, setQueryInput] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [watchPendingIds, setWatchPendingIds] = useState(() => new Set());
  const [assigneeDirectoryById, setAssigneeDirectoryById] = useState(() => new Map());

  const query = useMemo(() => getSearchQueryFromUrl(location.search), [location.search]);

  useEffect(() => {
    const sessionState = getWorkspaceSession();
    if (!sessionState.workspace?.id) {
      navigate(createPageUrl("Workspaces"), { replace: true });
      return;
    }
    setWorkspace((prev) => (prev?.id === sessionState.workspace.id ? prev : sessionState.workspace));
    setRole(sessionState.role || "contributor");
    setIsPublicAccess(Boolean(sessionState.isPublicAccess));
  }, []);

  useEffect(() => {
    setQueryInput(query);
  }, [query]);

  useEffect(() => {
    const loadMemberDirectory = async () => {
      if (!workspace?.id || !isAdminRole(role)) {
        setAssigneeDirectoryById(new Map());
        return;
      }
      try {
        const { data } = await base44.functions.invoke(
          "listWorkspaceMemberDirectory",
          { workspace_id: workspace.id },
          { authMode: "user" }
        );
        setAssigneeDirectoryById(createMemberDirectoryMap(data?.members || []));
      } catch (memberError) {
        console.error("Failed to load member directory for search:", memberError);
        setAssigneeDirectoryById(new Map());
      }
    };
    void loadMemberDirectory();
  }, [workspace?.id, role]);

  useEffect(() => {
    if (!workspace?.id) return;
    if (!query) {
      setResults([]);
      setError("");
      return;
    }

    let cancelled = false;
    const runSearch = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchWorkspaceSearchCached({
          workspaceId: workspace.id,
          query,
          limit: 100,
        });
        if (!cancelled) {
          setResults(Array.isArray(data) ? data : []);
        }
      } catch (searchError) {
        console.error("Workspace search failed:", searchError);
        if (!cancelled) {
          setResults([]);
          setError("Search failed. Try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void runSearch();
    return () => {
      cancelled = true;
    };
  }, [workspace?.id, query]);

  const submitSearch = (event) => {
    event.preventDefault();
    const nextQuery = String(queryInput || "").trim();
    if (!nextQuery) {
      navigate(createPageUrl("Search"));
      return;
    }
    navigate(`${createPageUrl("Search")}?q=${encodeURIComponent(nextQuery)}`);
  };

  const openItem = (itemId) => {
    if (!workspace?.slug || !itemId) return;
    navigate(workspaceItemUrl(workspace.slug, itemId));
  };

  const toggleItemWatch = async (item) => {
    if (!workspace?.id || !item?.id) return;
    if (watchPendingIds.has(item.id)) return;

    const previousResults = results;
    const nextWatched = !Boolean(item.watched);
    const nextWatcherCount = Math.max(
      0,
      Number(item.watcher_count || 0) + (nextWatched ? 1 : -1),
    );

    setWatchPendingIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    setResults((prev) =>
      prev.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              watched: nextWatched,
              watcher_count: nextWatcherCount,
            }
          : entry
      )
    );

    try {
      const { data } = await base44.functions.invoke(
        "toggleItemWatch",
        {
          workspace_id: workspace.id,
          item_id: item.id,
        },
        { authMode: "user" }
      );
      const resolvedWatched = Boolean(data?.watched);
      const resolvedWatcherCount = Number(data?.watcher_count || 0);
      setResults((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                watched: resolvedWatched,
                watcher_count: resolvedWatcherCount,
              }
            : entry
        )
      );
    } catch (watchError) {
      console.error("Failed to toggle watch from search:", watchError);
      setResults(previousResults);
    } finally {
      setWatchPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  if (!workspace?.id) {
    return <PageLoadingState text={WORKSPACE_LOADING_COPY} />;
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Search"
        description="Search item titles, descriptions, comments, and workspace activity."
        actions={
          <form onSubmit={submitSearch} className="flex w-full max-w-md items-center gap-2">
            <Input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search workspace..."
              aria-label="Search workspace"
            />
            <Button type="submit">Search</Button>
          </form>
        }
      />

      {!query ? (
        <PageEmptyState
          icon={SearchIcon}
          title="Search your workspace"
          description="Enter a query to search across item content."
        />
      ) : loading ? (
        <PageLoadingState text={`Searching for "${query}"...`} />
      ) : error ? (
        <StatePanel
          tone="danger"
          title="Search failed"
          description={error}
          action={() => {
            navigate(`${createPageUrl("Search")}?q=${encodeURIComponent(query)}`);
          }}
          actionLabel="Retry"
        />
      ) : results.length === 0 ? (
        <PageEmptyState
          icon={SearchIcon}
          title="No results found"
          description={`No items matched "${query}".`}
        />
      ) : (
        <div className="space-y-3">
          {results.map((result) => (
            <WorkspaceItemCard
              key={result.id}
              item={result}
              role={role}
              isPublicAccess={isPublicAccess}
              assigneeDirectoryById={assigneeDirectoryById}
              matchContext={result.matched_in}
              watchToggleDisabled={watchPendingIds.has(result.id)}
              onOpen={() => openItem(result.id)}
              onToggleWatch={toggleItemWatch}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
