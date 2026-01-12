import { authorizeWriteAction } from "../_shared/authHelpers.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { doc_page_id, board_id, content, is_question } = payload;

    if (!doc_page_id || !board_id || !content) {
      return Response.json(
        {
          error: "Missing required fields",
          code: "INVALID_INPUT",
          required: ["doc_page_id", "board_id", "content"],
        },
        { status: 400 },
      );
    }

    const auth = await authorizeWriteAction(req, board_id, "contributor");
    if (!auth.success) {
      return auth.error;
    }

    const { data, error } = await auth.supabase
      .from("doc_comments")
      .insert({
        board_id,
        doc_page_id,
        content,
        author_id: auth.user.id,
        author_email: auth.user.email,
        is_question: is_question !== undefined ? is_question : true,
        is_answered: false,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Create doc comment error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error("Create doc comment error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
