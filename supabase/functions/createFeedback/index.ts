import { authorizeWriteAction } from "../_shared/authHelpers.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const {
      board_id,
      title,
      type,
      description,
      steps_to_reproduce,
      expected_behavior,
      actual_behavior,
      attachments,
    } = payload;

    if (!board_id || !title || !type || !description) {
      return Response.json(
        {
          error: "Missing required fields",
          code: "INVALID_INPUT",
          required: ["board_id", "title", "type", "description"],
        },
        { status: 400 },
      );
    }

    const auth = await authorizeWriteAction(req, board_id, "contributor");
    if (!auth.success) {
      return auth.error;
    }

    const defaultVisibility = auth.board.settings?.default_feedback_visibility ??
      "public";

    const { data, error } = await auth.supabase
      .from("feedback")
      .insert({
        board_id,
        title,
        type,
        description,
        steps_to_reproduce: steps_to_reproduce || "",
        expected_behavior: expected_behavior || "",
        actual_behavior: actual_behavior || "",
        attachments: attachments || [],
        status: "open",
        visibility: defaultVisibility,
        tags: [],
        vote_count: 0,
        submitter_id: auth.user.id,
        submitter_email: auth.user.email,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Create feedback error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error("Create feedback error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
