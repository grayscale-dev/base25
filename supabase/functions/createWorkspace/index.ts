import { requireAuth } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  try {
    console.log("createWorkspace invoked", {
      method: req.method,
      hasAuthorization: Boolean(req.headers.get("Authorization")),
      hasForwardedAuthorization: Boolean(req.headers.get("x-forwarded-authorization")),
      hasUserAccessToken: Boolean(req.headers.get("x-user-access-token")),
    });

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
    const { name, slug, description, visibility } = payload;

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

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (workspaceError) {
      console.error("Workspace slug lookup error:", workspaceError);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (workspace) {
      return new Response(JSON.stringify({ error: "Slug already exists" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: createdWorkspace, error: createError } = await supabaseAdmin
      .from("workspaces")
      .insert({
        name,
        slug,
        description: description || "",
        visibility: visibility || "restricted",
        status: "active",
      })
      .select("*")
      .single();

    if (createError) {
      console.error("Create workspace error:", createError);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: roleError } = await supabaseAdmin
      .from("workspace_roles")
      .insert({
        workspace_id: createdWorkspace.id,
        user_id: authCheck.user.id,
        email: authCheck.user.email,
        role: "admin",
        assigned_via: "explicit",
      });

    if (roleError) {
      console.error("Assign workspace admin error:", roleError);
      return new Response(
        JSON.stringify({ error: "Workspace created but role assignment failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { error: seedError } = await supabaseAdmin.rpc("seed_default_item_statuses", {
      target_workspace_id: createdWorkspace.id,
    });
    if (seedError) {
      // Non-fatal because migration trigger should also seed these defaults.
      console.warn("Failed to seed default item statuses via RPC:", seedError);
    }

    return new Response(JSON.stringify(createdWorkspace), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Create workspace error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
