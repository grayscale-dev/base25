import { useEffect, useState } from "react";
import { Loader2, Pencil, SendHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RelativeDate from "@/components/common/RelativeDate";
import { StateBanner } from "@/components/common/StateDisplay";
import { getGroupColor, getGroupLabel } from "@/lib/item-groups";

function resolveStatusLabel(controller, statusId, fallbackStatusKey = null) {
  if (statusId) {
    const byId = controller.statusById?.get(statusId);
    if (byId?.label) return byId.label;
  }
  if (fallbackStatusKey) {
    for (const groupStatuses of Object.values(controller.statusesByGroup || {})) {
      const match = groupStatuses.find((status) => status.status_key === fallbackStatusKey);
      if (match?.label) return match.label;
    }
  }
  return String(fallbackStatusKey || statusId || "Unknown");
}

function hexToRgba(hex, alpha) {
  const normalized = String(hex || "").trim().toLowerCase();
  if (!normalized) return null;

  const short = normalized.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    const [r, g, b] = short[1].split("").map((value) => parseInt(value + value, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const full = normalized.match(/^#([0-9a-f]{6})$/i);
  if (full) {
    const r = parseInt(full[1].slice(0, 2), 16);
    const g = parseInt(full[1].slice(2, 4), 16);
    const b = parseInt(full[1].slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return null;
}

function resolveGroupColor(controller, groupKey) {
  if (!groupKey) return null;
  const normalizedGroupKey = String(groupKey).toLowerCase();
  const color = (
    controller?.groups?.find((group) => String(group?.group_key || "").toLowerCase() === normalizedGroupKey)?.color_hex ||
    getGroupColor(normalizedGroupKey)
  );
  const normalizedColor = String(color || "").trim().toUpperCase();
  if (normalizedColor === "#FFF" || normalizedColor === "#FFFFFF") {
    return getGroupColor(normalizedGroupKey);
  }
  return color;
}

function StatusPill({ children, colorHex = null }) {
  const rgbaBackground = hexToRgba(colorHex, 0.14);
  const rgbaBorder = hexToRgba(colorHex, 0.36);
  const style = colorHex
    ? {
        backgroundColor: rgbaBackground || undefined,
        borderColor: rgbaBorder || colorHex,
        color: colorHex,
      }
    : undefined;

  return (
    <span
      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"
      style={style}
    >
      {children}
    </span>
  );
}

function renderBoldLead(content) {
  const normalized = String(content || "").trim();
  if (!normalized) {
    return <span className="font-semibold text-slate-800">Activity</span>;
  }
  const [lead, ...restParts] = normalized.split(" ");
  const rest = restParts.join(" ");
  return (
    <>
      <span className="font-semibold text-slate-800">{lead}</span>
      {rest ? ` ${rest}` : ""}
    </>
  );
}

function parseFromToContent(content) {
  const normalized = String(content || "");
  const match = normalized.match(/from\s+(.+?)\s+to\s+(.+)/i);
  if (!match) return { from: null, to: null };
  return {
    from: match[1]?.trim() || null,
    to: match[2]?.trim() || null,
  };
}

function resolveFromToValues(activity, controller) {
  const metadata = activity?.metadata || {};

  if (activity.activity_type === "status_change") {
    const fromStatusRecord = metadata.from_status_id ? controller.statusById?.get(metadata.from_status_id) : null;
    const toStatusRecord = metadata.to_status_id ? controller.statusById?.get(metadata.to_status_id) : null;
    const fromStatus = (metadata.from_status_id || metadata.from_status)
      ? resolveStatusLabel(controller, metadata.from_status_id, metadata.from_status)
      : null;
    const toStatus = (metadata.to_status_id || metadata.to_status)
      ? resolveStatusLabel(controller, metadata.to_status_id, metadata.to_status)
      : null;
    if (fromStatus && toStatus) {
      return {
        from: fromStatus,
        to: toStatus,
        fromGroupKey: fromStatusRecord?.group_key || null,
        toGroupKey: toStatusRecord?.group_key || null,
      };
    }
  }

  if (activity.activity_type === "group_change") {
    const fromGroupKey = metadata.from_group || null;
    const toGroupKey = metadata.to_group || null;
    const fromGroup = fromGroupKey
      ? getGroupLabel(fromGroupKey, String(fromGroupKey))
      : null;
    const toGroup = toGroupKey
      ? getGroupLabel(toGroupKey, String(toGroupKey))
      : null;
    if (fromGroup && toGroup) {
      return {
        from: fromGroup,
        to: toGroup,
        fromGroupKey,
        toGroupKey,
      };
    }
  }

  const metadataFromKey = Object.keys(metadata).find((key) => key.startsWith("from_"));
  const metadataToKey = Object.keys(metadata).find((key) => key.startsWith("to_"));
  if (metadataFromKey && metadataToKey) {
    return {
      from: String(metadata[metadataFromKey]),
      to: String(metadata[metadataToKey]),
      fromGroupKey: null,
      toGroupKey: null,
    };
  }

  const parsed = parseFromToContent(activity?.content);
  return {
    ...parsed,
    fromGroupKey: null,
    toGroupKey: null,
  };
}

function renderActivityContent(activity, controller) {
  const { from, to, fromGroupKey, toGroupKey } = resolveFromToValues(activity, controller);
  const fromColor = resolveGroupColor(controller, fromGroupKey);
  const toColor = resolveGroupColor(controller, toGroupKey);

  if (activity.activity_type === "status_change" && from && to) {
    return (
      <>
        <span className="font-semibold text-slate-800">Status</span> changed from{" "}
        <StatusPill colorHex={fromColor}>{from}</StatusPill> to <StatusPill colorHex={toColor}>{to}</StatusPill>
      </>
    );
  }

  if (activity.activity_type === "group_change" && from && to) {
    return (
      <>
        <span className="font-semibold text-slate-800">Moved</span> from{" "}
        <StatusPill colorHex={fromColor}>{from}</StatusPill> to <StatusPill colorHex={toColor}>{to}</StatusPill>
      </>
    );
  }

  if (from && to) {
    return (
      <>
        <span className="font-semibold text-slate-800">
          {activity.activity_type_label || "Activity"}
        </span>{" "}
        from <StatusPill colorHex={fromColor}>{from}</StatusPill> to <StatusPill colorHex={toColor}>{to}</StatusPill>
      </>
    );
  }

  if (activity.activity_type === "update") {
    const normalized = String(activity.content || "").trim();
    if (normalized.toLowerCase() === "initial post updated" || normalized.toLowerCase() === "description updated") {
      return (
        <>
          <span className="font-semibold text-slate-800">Updated</span> description
        </>
      );
    }
  }

  return renderBoldLead(activity.content);
}

export default function ItemThreadPanel({ controller, item }) {
  const [threadError, setThreadError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [initialPostDraft, setInitialPostDraft] = useState("");
  const [editingInitialPost, setEditingInitialPost] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState("");
  const [savingInitialPost, setSavingInitialPost] = useState(false);
  const [savingCommentId, setSavingCommentId] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [postingComment, setPostingComment] = useState(false);

  const thread = controller.thread;

  useEffect(() => {
    setInitialPostDraft(thread.initialPost?.content || "");
    setEditingInitialPost(false);
  }, [thread.initialPost?.id, thread.initialPost?.content]);

  const saveInitialPost = async () => {
    if (!item?.id) return;
    setThreadError("");
    setSavingInitialPost(true);
    try {
      const result = await controller.updateInitialPost(item.id, initialPostDraft);
      if (!result.ok) {
        setThreadError(result.error || "Unable to update description.");
        return;
      }
      setEditingInitialPost(false);
    } finally {
      setSavingInitialPost(false);
    }
  };

  const startCommentEdit = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentDraft(comment.content || "");
  };

  const cancelCommentEdit = () => {
    setEditingCommentId(null);
    setEditingCommentDraft("");
  };

  const saveCommentEdit = async () => {
    if (!editingCommentId) return;
    setThreadError("");
    setSavingCommentId(editingCommentId);
    try {
      const result = await controller.updateComment(editingCommentId, editingCommentDraft);
      if (!result.ok) {
        setThreadError(result.error || "Unable to update comment.");
        return;
      }
      cancelCommentEdit();
    } finally {
      setSavingCommentId(null);
    }
  };

  const removeComment = async (commentId) => {
    setThreadError("");
    setDeletingCommentId(commentId);
    try {
      const result = await controller.deleteComment(commentId);
      if (!result.ok) {
        setThreadError(result.error || "Unable to delete comment.");
      }
    } finally {
      setDeletingCommentId(null);
    }
  };

  const submitComment = async () => {
    if (!item?.id) return;
    setThreadError("");
    setPostingComment(true);
    try {
      const result = await controller.addComment(item.id, newComment);
      if (!result.ok) {
        setThreadError(result.error || "Unable to post comment.");
        return;
      }
      setNewComment("");
    } finally {
      setPostingComment(false);
    }
  };

  return (
    <div className="space-y-6">
      <StateBanner tone="danger" message={threadError} />

      <section className="space-y-3 border-t border-slate-200 pt-3">
        <p className="text-sm font-medium text-slate-900">Description</p>
        {thread.initialPost ? (
          <article className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {thread.initialPost.author_label}
              </p>
              <div className="flex items-center gap-5">
                <p className="text-xs text-slate-500">
                  <RelativeDate value={thread.initialPost.created_at} />
                </p>
                {thread.initialPost.can_edit && !editingInitialPost ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-slate-400 hover:text-slate-600"
                    onClick={() => setEditingInitialPost(true)}
                    aria-label="Edit description"
                    title="Edit description"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                ) : null}
              </div>
            </div>

            {thread.initialPost.can_edit && editingInitialPost ? (
              <div className="space-y-2">
                <Textarea
                  value={initialPostDraft}
                  onChange={(event) => setInitialPostDraft(event.target.value)}
                  className="min-h-[110px] bg-white"
                />
                <div className="flex items-center gap-2">
                  <Button
                    onClick={saveInitialPost}
                    disabled={savingInitialPost}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    {savingInitialPost ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save description"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setInitialPostDraft(thread.initialPost?.content || "");
                      setEditingInitialPost(false);
                    }}
                    disabled={savingInitialPost}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {thread.initialPost.content || "No description provided."}
              </p>
            )}
          </article>
        ) : (
          <p className="text-sm text-slate-500">No description provided.</p>
        )}
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-3">
        <p className="text-sm font-medium text-slate-900">Comments</p>
        {thread.comments.length === 0 ? (
          <p className="text-sm text-slate-500">No replies yet.</p>
        ) : (
          thread.comments.map((comment) => (
            <article key={comment.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {comment.author_label}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-slate-500">
                    <RelativeDate value={comment.created_at_resolved} />
                  </p>
                  {comment.can_edit && editingCommentId !== comment.id ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-slate-600"
                      onClick={() => startCommentEdit(comment)}
                      aria-label="Edit comment"
                      title="Edit comment"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  ) : null}
                  {comment.can_delete && editingCommentId !== comment.id ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-rose-400 hover:text-rose-600"
                      onClick={() => {
                        void removeComment(comment.id);
                      }}
                      aria-label="Delete comment"
                      title="Delete comment"
                      disabled={deletingCommentId === comment.id}
                    >
                      {deletingCommentId === comment.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>

              {editingCommentId === comment.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editingCommentDraft}
                    onChange={(event) => setEditingCommentDraft(event.target.value)}
                    className="min-h-[96px]"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={saveCommentEdit}
                      disabled={savingCommentId === comment.id}
                      className="bg-slate-900 hover:bg-slate-800"
                    >
                      {savingCommentId === comment.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save reply"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelCommentEdit}
                      disabled={savingCommentId === comment.id}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{comment.content}</p>
                </>
              )}
            </article>
          ))
        )}

        {controller.canComment ? (
          <div className="space-y-2">
            <Label htmlFor="thread-new-reply">Reply</Label>
            <div className="relative">
            <Textarea
              id="thread-new-reply"
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              className="min-h-[96px] pr-12"
              placeholder="Write your reply..."
            />
            <Button
              onClick={submitComment}
              size="icon"
              disabled={!newComment.trim() || postingComment}
              className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-slate-900 hover:bg-slate-800"
              aria-label="Send reply"
              title="Send reply"
            >
              {postingComment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
            </Button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="space-y-2 border-t border-slate-200 pt-3">
        <p className="text-sm font-medium text-slate-900">Activity</p>
        {thread.systemActivity.length === 0 ? (
          <p className="text-sm text-slate-500">No system activity yet.</p>
        ) : (
          thread.systemActivity.map((activity) => (
            <div key={activity.id} className="py-1">
              <p className="flex flex-wrap items-center gap-1 text-sm text-slate-700">
                {renderActivityContent(activity, controller)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {activity.author_label} • <RelativeDate value={activity.created_at_resolved} />
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
