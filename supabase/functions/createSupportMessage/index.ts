import { authorizeWriteAction, requireStaff } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { thread_id, board_id, content, is_internal_note, attachments } =
      payload;

    if (!thread_id || !board_id || !content) {
      return Response.json(
        {
          error: "Missing required fields",
          code: "INVALID_INPUT",
          required: ["thread_id", "board_id", "content"],
        },
        { status: 400 },
      );
    }

    const auth = await authorizeWriteAction(req, board_id, "contributor");
    if (!auth.success) {
      return auth.error;
    }

    const { data: thread, error: threadError } = await supabaseAdmin
      .from("support_threads")
      .select("*")
      .eq("id", thread_id)
      .eq("board_id", board_id)
      .limit(1)
      .maybeSingle();

    if (threadError) {
      console.error("Support thread lookup error:", threadError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!thread) {
      return Response.json(
        { error: "Thread not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const staffCheck = await requireStaff(board_id, auth.user.id);
    const isStaff = staffCheck.success;

    if (!isStaff && thread.requester_id !== auth.user.id) {
      return Response.json(
        {
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "You can only reply to your own support threads",
        },
        { status: 403 },
      );
    }

    if (is_internal_note && !isStaff) {
      return Response.json(
        {
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "Only staff can create internal notes",
        },
        { status: 403 },
      );
    }

    const { data: message, error: messageError } = await auth.supabase
      .from("support_messages")
      .insert({
        thread_id,
        board_id,
        content,
        author_id: auth.user.id,
        author_email: auth.user.email,
        is_internal_note: is_internal_note || false,
        is_staff_reply: isStaff,
        attachments: attachments || [],
      })
      .select("*")
      .single();

    if (messageError) {
      console.error("Create support message error:", messageError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    const { error: updateError } = await auth.supabase
      .from("support_threads")
      .update({
        last_message_at: new Date().toISOString(),
        message_count: (thread.message_count || 0) + 1,
        status: isStaff ? "awaiting_user" : "awaiting_support",
      })
      .eq("id", thread_id);

    if (updateError) {
      console.error("Update support thread error:", updateError);
    }

    return Response.json(message);
  } catch (error) {
    console.error("Create support message error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
