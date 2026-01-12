import { authorizeWriteAction } from "../_shared/authHelpers.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { board_id, subject, message, priority } = payload;

    if (!board_id || !subject || !message) {
      return Response.json(
        {
          error: "Missing required fields",
          code: "INVALID_INPUT",
          required: ["board_id", "subject", "message"],
        },
        { status: 400 },
      );
    }

    const auth = await authorizeWriteAction(req, board_id, "contributor");
    if (!auth.success) {
      return auth.error;
    }

    if (!auth.board.support_enabled) {
      return Response.json(
        {
          error: "Support not enabled",
          code: "SUPPORT_DISABLED",
          message: "Support is not enabled for this board",
        },
        { status: 403 },
      );
    }

    const { data: thread, error: threadError } = await auth.supabase
      .from("support_threads")
      .insert({
        board_id,
        subject,
        status: "open",
        priority: priority || "medium",
        requester_id: auth.user.id,
        requester_email: auth.user.email,
        participants: [],
        feedback_ids: [],
        roadmap_item_ids: [],
        changelog_entry_ids: [],
        doc_page_ids: [],
        tags: [],
        last_message_at: new Date().toISOString(),
        message_count: 1,
      })
      .select("*")
      .single();

    if (threadError) {
      console.error("Create support thread error:", threadError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    const { data: firstMessage, error: messageError } = await auth.supabase
      .from("support_messages")
      .insert({
        thread_id: thread.id,
        board_id,
        content: message,
        author_id: auth.user.id,
        author_email: auth.user.email,
        is_internal_note: false,
        is_staff_reply: false,
        attachments: [],
      })
      .select("*")
      .single();

    if (messageError) {
      console.error("Create support message error:", messageError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    return Response.json({ thread, message: firstMessage });
  } catch (error) {
    console.error("Create support thread error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
