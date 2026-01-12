import { authorizeWriteAction, requireStaff } from "../_shared/authHelpers.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { feedback_id, board_id, content, attachments } = payload;

    if (!feedback_id || !board_id || !content) {
      return Response.json(
        {
          error: "Missing required fields",
          code: "INVALID_INPUT",
          required: ["feedback_id", "board_id", "content"],
        },
        { status: 400 },
      );
    }

    const auth = await authorizeWriteAction(req, board_id, "contributor");
    if (!auth.success) {
      return auth.error;
    }

    const staffCheck = await requireStaff(board_id, auth.user.id);
    const isOfficial = staffCheck.success;
    const authorRole = isOfficial ? "support" : "user";

    const { data, error } = await auth.supabase
      .from("feedback_responses")
      .insert({
        feedback_id,
        board_id,
        content,
        is_official: isOfficial,
        author_id: auth.user.id,
        author_role: authorRole,
        attachments: attachments || [],
      })
      .select("*")
      .single();

    if (error) {
      console.error("Create feedback response error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error("Create feedback response error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
