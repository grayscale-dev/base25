import { requireAuth } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_SERVICES = ["feedback", "roadmap", "changelog", "docs", "support"];

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) {
      return new Response(rateLimitResponse.body, {
        status: rateLimitResponse.status,
        headers: corsHeaders,
      });
    }

    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return new Response(authCheck.error.body, {
        status: authCheck.error.status,
        headers: corsHeaders,
      });
    }

    const payload = await req.json();
    const boardId = payload.workspace_id || payload.board_id;
    const service = payload.service;
    const eventType = payload.event_type;
    const occurredAt = payload.timestamp ? new Date(payload.timestamp) : new Date();
    const idempotencyKey = payload.idempotency_key || null;

    if (!boardId || !service || !eventType) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_SERVICES.includes(service)) {
      return new Response(JSON.stringify({ error: "Invalid service" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actorUserId = authCheck.user.id;

    const { error: insertError } = await supabaseAdmin
      .from("billing_interactions")
      .insert({
        board_id: boardId,
        service,
        event_type: eventType,
        actor_user_id: actorUserId,
        occurred_at: occurredAt.toISOString(),
        idempotency_key: idempotencyKey,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(JSON.stringify({ status: "duplicate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("Interaction insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to record interaction" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const usageDate = occurredAt.toISOString().slice(0, 10);
    const { error: usageError } = await supabaseAdmin.rpc("increment_usage_daily", {
      p_board_id: boardId,
      p_service: service,
      p_usage_date: usageDate,
      p_increment: 1,
    });

    if (usageError) {
      console.error("Usage increment error:", usageError);
    }

    return new Response(JSON.stringify({ status: "recorded" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Record interaction error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
