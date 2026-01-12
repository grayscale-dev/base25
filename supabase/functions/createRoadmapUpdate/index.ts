import { authorizeWriteAction } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { roadmap_item_id, board_id, content, update_type = "progress" } =
      payload;

    if (!roadmap_item_id || !board_id || !content) {
      return Response.json(
        {
          error: "Missing required fields",
          code: "INVALID_INPUT",
          required: ["roadmap_item_id", "board_id", "content"],
        },
        { status: 400 },
      );
    }

    const auth = await authorizeWriteAction(req, board_id, "support");
    if (!auth.success) {
      return auth.error;
    }

    const { data, error } = await auth.supabase
      .from("roadmap_updates")
      .insert({
        roadmap_item_id,
        board_id,
        content,
        author_id: auth.user.id,
        update_type,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Create roadmap update error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    const usageDate = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `roadmap_updates:${data.id}:create_update`;
    await supabaseAdmin.from("billing_interactions").insert({
      board_id,
      service: "roadmap",
      event_type: "create_update",
      actor_user_id: auth.user.id,
      occurred_at: new Date().toISOString(),
      idempotency_key: idempotencyKey,
    });
    await supabaseAdmin.rpc("increment_usage_daily", {
      p_board_id: board_id,
      p_service: "roadmap",
      p_usage_date: usageDate,
      p_increment: 1,
    });

    return Response.json(data);
  } catch (error) {
    console.error("Create roadmap update error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
