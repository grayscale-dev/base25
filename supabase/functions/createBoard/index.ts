import { requireAuth } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.SIGNUP);
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
    const { name, slug, description, visibility, support_enabled } = payload;

    if (!name || !slug) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          code: "INVALID_INPUT",
          required: ["name", "slug"],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: board, error: boardError } = await supabaseAdmin
      .from("boards")
      .select("id")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (boardError) {
      console.error("Board slug lookup error:", boardError);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (board) {
      return new Response(JSON.stringify({ error: "Slug already exists" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: createdBoard, error: createError } = await supabaseAdmin
      .from("boards")
      .insert({
        name,
        slug,
        description: description || "",
        visibility: visibility || "restricted",
        support_enabled: support_enabled ?? true,
        status: "active",
      })
      .select("*")
      .single();

    if (createError) {
      console.error("Create board error:", createError);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: roleError } = await supabaseAdmin
      .from("board_roles")
      .insert({
        board_id: createdBoard.id,
        user_id: authCheck.user.id,
        email: authCheck.user.email,
        role: "admin",
        assigned_via: "explicit",
      });

    if (roleError) {
      console.error("Assign board admin error:", roleError);
      return new Response(
        JSON.stringify({ error: "Board created but role assignment failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(createdBoard), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Create board error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
