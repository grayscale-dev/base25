import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Filter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/common/Badge";
import { PageHeader, PageShell } from "@/components/common/PageScaffold";
import PageLoadingState from "@/components/common/PageLoadingState";
import PageEmptyState from "@/components/common/PageEmptyState";
import { StatePanel } from "@/components/common/StateDisplay";
import ItemEditorDialog from "./ItemEditorDialog";
import ItemDetailDrawer from "./ItemDetailDrawer";
import { ITEM_GROUP_KEYS, getGroupLabel } from "@/lib/item-groups";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function sortableValue(item, key) {
  if (key === "group") return item.group_key || "";
  if (key === "status") return item.status_key || "";
  if (key === "updated") {
    return item.updated_date || item.updated_at || item.created_date || item.created_at || "";
  }
  return item.title || "";
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function uniqueStatuses(statuses) {
  const map = new Map();
  statuses.forEach((status) => {
    if (!map.has(status.status_key)) {
      map.set(status.status_key, status);
    }
  });
  return [...map.values()];
}

export default function AllItemsPage({ workspace, controller }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("updated");
  const [sortDirection, setSortDirection] = useState("desc");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [draftGroupFilter, setDraftGroupFilter] = useState("all");
  const [draftStatusFilter, setDraftStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showItemDrawer, setShowItemDrawer] = useState(false);

  useEffect(() => {
    void controller.loadItems({ groupKey: null, statusKey: "all" });
  }, [workspace?.id]);

  useEffect(() => {
    if (!showFilters) return;
    setDraftGroupFilter(groupFilter);
    setDraftStatusFilter(statusFilter);
  }, [showFilters, groupFilter, statusFilter]);

  const statusOptions = useMemo(() => {
    if (groupFilter === "all") return uniqueStatuses(controller.statuses);
    return controller.statusesByGroup[groupFilter] || [];
  }, [groupFilter, controller.statuses, controller.statusesByGroup]);

  const draftStatusOptions = useMemo(() => {
    if (draftGroupFilter === "all") return uniqueStatuses(controller.statuses);
    return controller.statusesByGroup[draftGroupFilter] || [];
  }, [draftGroupFilter, controller.statuses, controller.statusesByGroup]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return controller.items
      .filter((item) => {
        if (groupFilter !== "all" && item.group_key !== groupFilter) return false;
        if (statusFilter !== "all" && item.status_key !== statusFilter) return false;
        if (!normalizedQuery) return true;

        const haystack =
          `${item.title || ""} ${item.description || ""} ${item.group_key || ""} ${item.status_key || ""}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const aValue = sortableValue(a, sortKey);
        const bValue = sortableValue(b, sortKey);
        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [controller.items, searchQuery, groupFilter, statusFilter, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pagedItems = filteredItems.slice(start, start + pageSize);

  const statusLabelByKey = useMemo(() => {
    const map = new Map();
    controller.statuses.forEach((status) => {
      if (!map.has(status.status_key)) {
        map.set(status.status_key, status.label);
      }
    });
    return map;
  }, [controller.statuses]);

  const activeFilters = useMemo(() => {
    const filters = [];
    if (groupFilter !== "all") {
      filters.push({ id: "group", label: "Group", value: getGroupLabel(groupFilter) });
    }
    if (statusFilter !== "all") {
      const label =
        statusOptions.find((status) => status.status_key === statusFilter)?.label ||
        statusLabelByKey.get(statusFilter) ||
        statusFilter;
      filters.push({ id: "status", label: "Status", value: label });
    }
    return filters;
  }, [groupFilter, statusFilter, statusOptions, statusLabelByKey]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, groupFilter, statusFilter, pageSize]);

  const toggleSort = (nextKey) => {
    if (nextKey === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "updated" ? "desc" : "asc");
  };

  const handleSaveCreate = async (payload) => {
    const result = await controller.saveItem({ payload, previousItem: null });
    if (!result.ok) {
      controller.setError(result.error);
      return;
    }
    setShowCreateModal(false);
    await controller.loadItems({ groupKey: null, statusKey: "all" });
  };

  const openItem = async (item) => {
    await controller.loadItemActivities(item);
    setShowItemDrawer(true);
  };

  const applyFilters = () => {
    const hasDraftStatus = draftStatusOptions.some(
      (status) => status.status_key === draftStatusFilter
    );
    setGroupFilter(draftGroupFilter);
    setStatusFilter(draftStatusFilter === "all" || hasDraftStatus ? draftStatusFilter : "all");
    setShowFilters(false);
  };

  const clearFilters = () => {
    setGroupFilter("all");
    setStatusFilter("all");
    setDraftGroupFilter("all");
    setDraftStatusFilter("all");
    setShowFilters(false);
  };

  const getStatusLabel = (item) =>
    controller.statusesByGroup[item.group_key]?.find(
      (status) => status.status_key === item.status_key
    )?.label || statusLabelByKey.get(item.status_key) || item.status_key;

  if (controller.loadingConfig) {
    return <PageLoadingState text="Loading workspace items..." />;
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="All Items"
        description={`Advanced item management for ${workspace?.name}.`}
        actions={
          <Button onClick={() => setShowCreateModal(true)} className="bg-slate-900 hover:bg-slate-800">
            <Plus className="mr-2 h-4 w-4" />
            Create Item
          </Button>
        }
      />

      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-md">
            <Label htmlFor="item-search">Search</Label>
            <Input
              id="item-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search title, initial post, group, status..."
              className="mt-1.5 bg-white"
            />
          </div>

          <Button variant="outline" onClick={() => setShowFilters(true)}>
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>

        {activeFilters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">
              {activeFilters.length} filter{activeFilters.length === 1 ? "" : "s"} active
            </span>
            {activeFilters.map((activeFilter) => (
              <Badge key={activeFilter.id} variant="outline">
                {activeFilter.label}: {activeFilter.value}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {controller.error ? (
        <StatePanel
          tone="danger"
          title="Unable to load all items"
          description={controller.error}
          action={() => controller.loadItems({ groupKey: null, statusKey: "all" })}
          actionLabel="Retry"
        />
      ) : null}

      {controller.loadingItems ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="p-6">
            <PageLoadingState text="Loading all items..." />
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <PageEmptyState
          title="No items found"
          description="Adjust your search and filters, or create a new item."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-3 sm:px-4">
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("title")}
                      >
                        Title
                        {sortKey === "title" ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("group")}
                      >
                        Group
                        {sortKey === "group" ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("status")}
                      >
                        Status
                        {sortKey === "status" ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("updated")}
                      >
                        Updated
                        {sortKey === "updated" ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                      onClick={() => {
                        void openItem(item);
                      }}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900">{item.title}</p>
                          <p className="line-clamp-1 text-xs text-slate-500">
                            {item.description || "No initial post."}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {getGroupLabel(item.group_key)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">{getStatusLabel(item)}</TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {formatDate(
                          item.updated_date || item.updated_at || item.created_date || item.created_at
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Showing {start + 1}-{Math.min(start + pageSize, filteredItems.length)} of{" "}
              {filteredItems.length}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Rows</span>
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                  <SelectTrigger className="h-8 w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} rows
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-xs text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription>
              Apply filters to narrow the all-items table.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Group</Label>
              <Select
                value={draftGroupFilter}
                onValueChange={(value) => {
                  setDraftGroupFilter(value);
                  setDraftStatusFilter("all");
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {ITEM_GROUP_KEYS.map((groupKey) => (
                    <SelectItem key={groupKey} value={groupKey}>
                      {getGroupLabel(groupKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={draftStatusFilter} onValueChange={setDraftStatusFilter}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {draftStatusOptions.map((status) => (
                    <SelectItem key={status.id || status.status_key} value={status.status_key}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={clearFilters}>
              Clear
            </Button>
            <Button onClick={applyFilters} className="bg-slate-900 hover:bg-slate-800">
              Apply filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ItemDetailDrawer
        open={showItemDrawer}
        onOpenChange={setShowItemDrawer}
        workspaceSlug={workspace?.slug}
        controller={controller}
        item={controller.selectedItem}
        isAdmin={controller.isAdmin}
        onDeleted={async () => {
          await controller.loadItems({ groupKey: null, statusKey: "all" });
        }}
      />

      <ItemEditorDialog
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSave={handleSaveCreate}
        saving={controller.savingItem}
        item={null}
        availableGroupKeys={ITEM_GROUP_KEYS}
        availableStatusesByGroup={controller.statusesByGroup}
        canManageGroupTransition
        defaultGroup="feedback"
      />
    </PageShell>
  );
}
