import { requireAuth } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
    const slug = String(payload?.slug || "").trim().toLowerCase();
    if (!slug) {
      return json({ error: "Workspace slug is required" }, 400);
    }

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("*")
      .eq("slug", slug)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (workspaceError) {
      console.error("Workspace lookup error:", workspaceError);
      return json({ error: "Internal server error" }, 500);
    }
    if (!workspace) {
      return json({ error: "Workspace not found" }, 404);
    }

    const userId = authCheck.user.id;
    const userEmail = authCheck.user.email;

    const { data: existingRole, error: roleLookupError } = await supabaseAdmin
      .from("workspace_roles")
      .select("role")
      .eq("workspace_id", workspace.id)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (roleLookupError) {
      console.error("Workspace role lookup error:", roleLookupError);
      return json({ error: "Internal server error" }, 500);
    }

    let resolvedRole = existingRole?.role || null;
    if (!resolvedRole) {
      if (workspace.visibility !== "public") {
        return json({ error: "This workspace is not accessible" }, 403);
      }

      const { data: insertedRole, error: insertRoleError } = await supabaseAdmin
        .from("workspace_roles")
        .upsert(
          {
            workspace_id: workspace.id,
            user_id: userId,
            email: userEmail,
            role: "viewer",
            assigned_via: "public",
          },
          { onConflict: "workspace_id,user_id" },
        )
        .select("role")
        .single();

      if (insertRoleError) {
        console.error("Workspace role upsert error:", insertRoleError);
        return json({ error: "Unable to join workspace" }, 500);
      }

      resolvedRole = insertedRole?.role || "viewer";
    }

    const response = json({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description || "",
      logo_url: workspace.logo_url || "",
      primary_color: workspace.primary_color || "#0f172a",
      visibility: workspace.visibility,
      role: resolvedRole,
    });

    return addCacheHeaders(response, 120);
  } catch (error) {
    console.error("Workspace fetch error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
