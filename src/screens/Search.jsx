"use client";

import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
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
import RelativeDate from "@/components/common/RelativeDate";
import { WORKSPACE_LOADING_COPY } from "@/lib/workspace-loading";
import { fetchWorkspaceSearchCached } from "@/lib/workspace-queries";

function getSearchQueryFromUrl(search) {
  const params = new URLSearchParams(String(search || ""));
  return String(params.get("q") || "").trim();
}

function formatMatchedIn(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function Search() {
  const navigate = useNavigate();
  const location = useLocation();
  const [workspace, setWorkspace] = useState(() => getWorkspaceSession().workspace || null);
  const [queryInput, setQueryInput] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const query = useMemo(() => getSearchQueryFromUrl(location.search), [location.search]);

  useEffect(() => {
    const { workspace: storedWorkspace } = getWorkspaceSession();
    if (!storedWorkspace?.id) {
      navigate(createPageUrl("Workspaces"), { replace: true });
      return;
    }
    setWorkspace((prev) => (prev?.id === storedWorkspace.id ? prev : storedWorkspace));
  }, []);

  useEffect(() => {
    setQueryInput(query);
  }, [query]);

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
            <article
              key={result.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-base font-semibold text-slate-900">{result.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className="rounded-full px-2 py-0.5 text-white"
                      style={{ backgroundColor: result.group_color || "#0F172A" }}
                    >
                      {result.group_label || result.group_key}
                    </span>
                    {result.status_label ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                        {result.status_label}
                      </span>
                    ) : null}
                    {Array.isArray(result.matched_in)
                      ? result.matched_in.map((matchValue) => (
                          <span key={`${result.id}:${matchValue}`} className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                            {formatMatchedIn(matchValue)}
                          </span>
                        ))
                      : null}
                  </div>
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">
                    {result.match_preview || result.description || "No description provided."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-slate-500">
                    <RelativeDate value={result.updated_at || result.updated_date || result.created_at || result.created_date} />
                  </span>
                  <Button size="sm" variant="outline" onClick={() => openItem(result.id)}>
                    Open item
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
