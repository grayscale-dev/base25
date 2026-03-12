import { requireAuth } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { addCacheHeaders } from "../_shared/rateLimiter.ts";

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

    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return new Response(authCheck.error.body, {
        status: authCheck.error.status,
        headers: corsHeaders,
      });
    }

    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from("workspace_roles")
      .select("workspace_id, role")
      .eq("user_id", authCheck.user.id);

    if (roleError) {
      console.error("listMyWorkspaces role query error:", roleError);
      return json({ error: "Failed to list workspaces" }, 500);
    }

    const uniqueWorkspaceIds = [...new Set((roleRows || []).map((row) => String(row.workspace_id || "")).filter(Boolean))];
    if (uniqueWorkspaceIds.length === 0) {
      return addCacheHeaders(json({ workspaces: [] }), 30);
    }

    const { data: workspaceRows, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("id,name,slug,description,logo_url,primary_color,visibility,status,created_at,updated_at")
      .in("id", uniqueWorkspaceIds)
      .eq("status", "active");

    if (workspaceError) {
      console.error("listMyWorkspaces workspace query error:", workspaceError);
      return json({ error: "Failed to list workspaces" }, 500);
    }

    const roleByWorkspaceId = new Map<string, string>();
    (roleRows || []).forEach((row) => {
      const workspaceId = String(row.workspace_id || "");
      if (!workspaceId || roleByWorkspaceId.has(workspaceId)) return;
      roleByWorkspaceId.set(workspaceId, String(row.role || "contributor"));
    });

    const workspaces = (workspaceRows || [])
      .map((workspace) => ({
        ...workspace,
        role: roleByWorkspaceId.get(String(workspace.id)) || "contributor",
      }))
      .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));

    return addCacheHeaders(json({ workspaces }), 30);
  } catch (error) {
    console.error("listMyWorkspaces error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
