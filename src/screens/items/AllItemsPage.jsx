import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Filter, Loader2, Plus } from "lucide-react";
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
import PageEmptyState from "@/components/common/PageEmptyState";
import { StatePanel } from "@/components/common/StateDisplay";
import RelativeDate from "@/components/common/RelativeDate";
import ItemEditorDialog from "./ItemEditorDialog";
import ItemDetailDrawer from "./ItemDetailDrawer";
import AssigneeDisplay from "./AssigneeDisplay";
import { ITEM_GROUP_KEYS, getGroupLabel } from "@/lib/item-groups";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function sortableValue(item, key) {
  if (key === "group") return item.group_key || "";
  if (key === "status") return item.status_label || item.status_key || "";
  if (key === "updated") {
    return item.updated_date || item.updated_at || item.created_date || item.created_at || "";
  }
  return item.title || "";
}

function uniqueStatuses(statuses) {
  const map = new Map();
  statuses.forEach((status) => {
    if (!map.has(status.id)) {
      map.set(status.id, status);
    }
  });
  return [...map.values()];
}

export default function AllItemsPage({ workspace, controller }) {
  const canFilterByAssignee = Boolean(controller.isAdmin);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [sortKey, setSortKey] = useState("updated");
  const [sortDirection, setSortDirection] = useState("desc");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [draftGroupFilter, setDraftGroupFilter] = useState("all");
  const [draftStatusFilter, setDraftStatusFilter] = useState("all");
  const [draftAssigneeFilter, setDraftAssigneeFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showItemDrawer, setShowItemDrawer] = useState(false);
  const [openingItemId, setOpeningItemId] = useState(null);
  const showTableSkeleton = (controller.loadingConfig || controller.loadingItems) && controller.items.length === 0;

  useEffect(() => {
    void controller.loadItems({ groupKey: null, statusId: "all", background: true });
  }, [workspace?.id]);

  useEffect(() => {
    if (!showFilters) return;
    setDraftGroupFilter(groupFilter);
    setDraftStatusFilter(statusFilter);
    setDraftAssigneeFilter(assigneeFilter);
  }, [showFilters, groupFilter, statusFilter, assigneeFilter]);

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
        if (statusFilter !== "all" && item.status_id !== statusFilter) return false;
        if (canFilterByAssignee) {
          if (assigneeFilter === "unassigned" && item.group_key === "feedback" && item.assigned_to) return false;
          if (
            assigneeFilter !== "all" &&
            assigneeFilter !== "unassigned" &&
            item.assigned_to !== assigneeFilter
          ) {
            return false;
          }
        }
        if (!normalizedQuery) return true;

        const haystack =
          `${item.title || ""} ${item.description || ""} ${item.group_key || ""} ${item.status_label || ""}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const aValue = sortableValue(a, sortKey);
        const bValue = sortableValue(b, sortKey);
        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [controller.items, searchQuery, groupFilter, statusFilter, assigneeFilter, sortKey, sortDirection, canFilterByAssignee]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pagedItems = filteredItems.slice(start, start + pageSize);

  const statusLabelById = useMemo(() => {
    const map = new Map();
    controller.statuses.forEach((status) => {
      if (!map.has(status.id)) {
        map.set(status.id, status.label);
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
        statusOptions.find((status) => status.id === statusFilter)?.label ||
        statusLabelById.get(statusFilter) ||
        statusFilter;
      filters.push({ id: "status", label: "Status", value: label });
    }
    if (canFilterByAssignee && assigneeFilter !== "all") {
      const assigneeLabel = assigneeFilter === "unassigned"
        ? "Unassigned"
        : controller.memberDirectory.find((member) => member.user_id === assigneeFilter)?.display_name
          || controller.memberDirectory.find((member) => member.user_id === assigneeFilter)?.email
          || assigneeFilter;
      filters.push({ id: "assignee", label: "Assignee", value: assigneeLabel });
    }
    return filters;
  }, [groupFilter, statusFilter, assigneeFilter, statusOptions, statusLabelById, controller.memberDirectory, canFilterByAssignee]);

  useEffect(() => {
    if (canFilterByAssignee) return;
    setAssigneeFilter("all");
    setDraftAssigneeFilter("all");
  }, [canFilterByAssignee]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, groupFilter, statusFilter, assigneeFilter, pageSize]);

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
    await controller.loadItems({ groupKey: null, statusId: "all", background: true, force: true });
  };

  const openItem = async (item) => {
    setOpeningItemId(item.id);
    controller.setSelectedItem(controller.hydrateItem(item));
    setShowItemDrawer(true);
    try {
      await controller.loadItemActivities(item);
    } finally {
      setOpeningItemId(null);
    }
  };

  const applyFilters = () => {
    const hasDraftStatus = draftStatusOptions.some((status) => status.id === draftStatusFilter);
    setGroupFilter(draftGroupFilter);
    setStatusFilter(draftStatusFilter === "all" || hasDraftStatus ? draftStatusFilter : "all");
    setAssigneeFilter(canFilterByAssignee ? draftAssigneeFilter : "all");
    setShowFilters(false);
  };

  const clearFilters = () => {
    setGroupFilter("all");
    setStatusFilter("all");
    setAssigneeFilter("all");
    setDraftGroupFilter("all");
    setDraftStatusFilter("all");
    setDraftAssigneeFilter("all");
    setShowFilters(false);
  };

  const getStatusLabel = (item) => item.status_label || statusLabelById.get(item.status_id) || item.status_key;

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="All Items"
        description={`Advanced item management for ${workspace?.name}.`}
        actions={
          <Button
            onClick={() => setShowCreateModal(true)}
            disabled={controller.savingItem}
            aria-busy={controller.savingItem}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {controller.savingItem ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {controller.savingItem ? "Saving..." : "Create Item"}
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
              placeholder="Search title, description, group, status..."
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
          action={() => controller.loadItems({ groupKey: null, statusId: "all", background: true, force: true })}
          actionLabel="Retry"
        />
      ) : null}

      {showTableSkeleton ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={`all-items-skeleton-${index}`} className="animate-pulse rounded-lg border border-slate-100 p-3">
                <div className="h-3 w-1/3 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-11/12 rounded bg-slate-100" />
                <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <PageEmptyState
          title="No items found"
          description="Adjust your search and filters, or create a new item."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div>
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-3 sm:px-4">
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
                    <TableHead className="px-3 sm:px-4">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("group")}
                      >
                        Group • Status
                        {sortKey === "group" ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    </TableHead>
                    <TableHead className="px-3 sm:px-4">Type</TableHead>
                    <TableHead className="px-3 sm:px-4">Assignee</TableHead>
                    <TableHead className="px-3 sm:px-4">
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
                      <TableCell className="px-3 sm:px-4">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">{item.title}</p>
                          <p className="line-clamp-1 text-xs text-slate-500">{item.description || "No description."}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 sm:px-4 text-sm text-slate-700">
                        <Badge
                          variant="outline"
                          className="border-0 text-white"
                          style={{ backgroundColor: item.group_color || "#0F172A" }}
                        >
                          {getGroupLabel(item.group_key)} • {getStatusLabel(item)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 sm:px-4 text-sm text-slate-700">{item.item_type_label || "No Type"}</TableCell>
                      <TableCell className="px-3 sm:px-4 text-sm text-slate-700">
                        {item.group_key === "feedback" ? (
                          <AssigneeDisplay assignee={item.assignee} fallback="Unassigned" />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="px-3 sm:px-4 text-sm text-slate-700">
                        <span className="inline-flex items-center gap-2">
                          <RelativeDate value={item.updated_date || item.updated_at || item.created_date || item.created_at} />
                          {openingItemId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : null}
                        </span>
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
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {canFilterByAssignee ? (
              <div>
                <Label>Assignee</Label>
                <Select value={draftAssigneeFilter} onValueChange={setDraftAssigneeFilter}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All assignees</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {controller.memberDirectory.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.display_name || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
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
        showGroupContext
        onDeleted={async () => {
          await controller.loadItems({ groupKey: null, statusId: "all", background: true, force: true });
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
        itemTypes={controller.itemTypes}
        assigneeOptions={controller.memberDirectory}
        canAssign={controller.canManageAssignee}
        canManageGroupTransition
        defaultGroup="feedback"
      />
    </PageShell>
  );
}
