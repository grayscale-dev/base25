import { authorizeWriteAction } from "../_shared/authHelpers.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { item_id, board_id, updates } = payload;

    if (!item_id || !board_id || !updates) {
      return Response.json(
        {
          error: "Missing required fields",
          code: "INVALID_INPUT",
          required: ["item_id", "board_id", "updates"],
        },
        { status: 400 },
      );
    }

    const auth = await authorizeWriteAction(req, board_id, "support");
    if (!auth.success) {
      return auth.error;
    }

    const { data, error } = await auth.supabase
      .from("roadmap_items")
      .update(updates)
      .eq("id", item_id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Update roadmap item error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error("Update roadmap item error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
