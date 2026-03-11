import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StateBanner } from "@/components/common/StateDisplay";
import { getGroupLabel } from "@/lib/item-groups";

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function resolveStatusLabel(statusesByGroup, statusKey) {
  if (!statusKey) return "Unknown";
  for (const groupStatuses of Object.values(statusesByGroup || {})) {
    const match = groupStatuses.find((status) => status.status_key === statusKey);
    if (match?.label) return match.label;
  }
  return String(statusKey);
}

function StatusPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
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
    const fromStatus = metadata.from_status
      ? resolveStatusLabel(controller.statusesByGroup, metadata.from_status)
      : null;
    const toStatus = metadata.to_status
      ? resolveStatusLabel(controller.statusesByGroup, metadata.to_status)
      : null;
    if (fromStatus && toStatus) return { from: fromStatus, to: toStatus };
  }

  if (activity.activity_type === "group_change") {
    const fromGroup = metadata.from_group
      ? getGroupLabel(metadata.from_group, String(metadata.from_group))
      : null;
    const toGroup = metadata.to_group
      ? getGroupLabel(metadata.to_group, String(metadata.to_group))
      : null;
    if (fromGroup && toGroup) return { from: fromGroup, to: toGroup };
  }

  const metadataFromKey = Object.keys(metadata).find((key) => key.startsWith("from_"));
  const metadataToKey = Object.keys(metadata).find((key) => key.startsWith("to_"));
  if (metadataFromKey && metadataToKey) {
    return {
      from: String(metadata[metadataFromKey]),
      to: String(metadata[metadataToKey]),
    };
  }

  return parseFromToContent(activity?.content);
}

function renderActivityContent(activity, controller) {
  const { from, to } = resolveFromToValues(activity, controller);

  if (activity.activity_type === "status_change" && from && to) {
    return (
      <>
        <span className="font-semibold text-slate-800">Status</span> changed from{" "}
        <StatusPill>{from}</StatusPill> to <StatusPill>{to}</StatusPill>
      </>
    );
  }

  if (activity.activity_type === "group_change" && from && to) {
    return (
      <>
        <span className="font-semibold text-slate-800">Moved</span> from{" "}
        <StatusPill>{from}</StatusPill> to <StatusPill>{to}</StatusPill>
      </>
    );
  }

  if (from && to) {
    return (
      <>
        <span className="font-semibold text-slate-800">
          {activity.activity_type_label || "Activity"}
        </span>{" "}
        from <StatusPill>{from}</StatusPill> to <StatusPill>{to}</StatusPill>
      </>
    );
  }

  if (activity.activity_type === "update") {
    const normalized = String(activity.content || "").trim();
    if (normalized.toLowerCase() === "initial post updated") {
      return (
        <>
          <span className="font-semibold text-slate-800">Updated</span> initial post
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

  const thread = controller.thread;

  useEffect(() => {
    setInitialPostDraft(thread.initialPost?.content || "");
    setEditingInitialPost(false);
  }, [thread.initialPost?.id, thread.initialPost?.content]);

  const saveInitialPost = async () => {
    if (!item?.id) return;
    setThreadError("");
    const result = await controller.updateInitialPost(item.id, initialPostDraft);
    if (!result.ok) {
      setThreadError(result.error || "Unable to update initial post.");
      return;
    }
    setEditingInitialPost(false);
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
    const result = await controller.updateComment(editingCommentId, editingCommentDraft);
    if (!result.ok) {
      setThreadError(result.error || "Unable to update comment.");
      return;
    }
    cancelCommentEdit();
  };

  const removeComment = async (commentId) => {
    setThreadError("");
    const result = await controller.deleteComment(commentId);
    if (!result.ok) {
      setThreadError(result.error || "Unable to delete comment.");
    }
  };

  const submitComment = async () => {
    if (!item?.id) return;
    setThreadError("");
    const result = await controller.addComment(item.id, newComment);
    if (!result.ok) {
      setThreadError(result.error || "Unable to post comment.");
      return;
    }
    setNewComment("");
  };

  return (
    <div className="space-y-6">
      <StateBanner tone="danger" message={threadError} />

      <div className="space-y-3 border-t border-slate-200 pt-3">
        <p className="text-sm font-medium text-slate-900">Discussion</p>

        {thread.initialPost ? (
          <article className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {thread.initialPost.author_label}
              </p>
              <div className="flex items-center gap-5">
                <p className="text-xs text-slate-500">
                  {formatDate(thread.initialPost.created_at)}
                </p>
                {thread.initialPost.can_edit && !editingInitialPost ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-2 w-2 text-slate-400 hover:text-slate-600"
                    onClick={() => setEditingInitialPost(true)}
                    aria-label="Edit initial post"
                    title="Edit initial post"
                  >
                    <Pencil className="h-1 w-1" />
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
                    disabled={controller.savingItem}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    {controller.savingItem ? "Saving..." : "Save initial post"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setInitialPostDraft(thread.initialPost?.content || "");
                      setEditingInitialPost(false);
                    }}
                    disabled={controller.savingItem}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {thread.initialPost.content || "No initial post content."}
              </p>
            )}
          </article>
        ) : null}

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
                  <p className="text-xs text-slate-500">{formatDate(comment.created_at_resolved)}</p>
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
                    >
                      <Trash2 className="h-3 w-3" />
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
                      disabled={controller.savingActivity}
                      className="bg-slate-900 hover:bg-slate-800"
                    >
                      {controller.savingActivity ? "Saving..." : "Save reply"}
                    </Button>
                    <Button variant="outline" onClick={cancelCommentEdit}>
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
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <Label htmlFor="thread-new-reply">Reply</Label>
            <Textarea
              id="thread-new-reply"
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              className="min-h-[96px]"
              placeholder="Write your reply..."
            />
            <Button
              onClick={submitComment}
              disabled={!newComment.trim() || controller.savingActivity}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {controller.savingActivity ? "Posting..." : "Post reply"}
            </Button>
          </div>
        ) : null}
      </div>

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
                {activity.author_label} • {formatDate(activity.created_at_resolved)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
