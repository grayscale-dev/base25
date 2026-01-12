import { authorizeWriteAction } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const {
      board_id,
      title,
      description,
      status,
      target_date,
      target_quarter,
      visibility,
    } = payload;

    if (!board_id || !title || !status) {
      return Response.json(
        {
          error: "Missing required fields",
          code: "INVALID_INPUT",
          required: ["board_id", "title", "status"],
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
      .insert({
        board_id,
        title,
        description: description || "",
        status,
        target_date: target_date || null,
        target_quarter: target_quarter || null,
        visibility: visibility || "public",
        tags: [],
        display_order: 0,
        linked_feedback_ids: [],
      })
      .select("*")
      .single();

    if (error) {
      console.error("Create roadmap item error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    const usageDate = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `roadmap_items:${data.id}:create_item`;
    await supabaseAdmin.from("billing_interactions").insert({
      board_id,
      service: "roadmap",
      event_type: "create_item",
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
    console.error("Create roadmap item error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
