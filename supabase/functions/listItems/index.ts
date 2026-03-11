import { supabaseAdmin } from "../_shared/supabase.ts";
import { requireWorkspaceReadAccess } from "../_shared/itemAccess.ts";
import { isValidGroupKey } from "../_shared/itemValidation.ts";
import { applyRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const payload = await req.json();
    const access = await requireWorkspaceReadAccess(req, payload);
    if (!access.success) {
      return json({ error: access.error }, access.status || 403);
    }

    const groupKey = payload.group_key;
    if (groupKey && !isValidGroupKey(groupKey)) {
      return json({ error: "group_key is invalid" }, 400);
    }

    const limit = Math.min(Math.max(Number(payload.limit || 50), 1), 200);
    const statusKey =
      typeof payload.status_key === "string" ? String(payload.status_key) : null;

    let query = supabaseAdmin
      .from("items")
      .select("*")
      .eq("workspace_id", access.workspace.id);

    if (groupKey) query = query.eq("group_key", groupKey);
    if (statusKey) query = query.eq("status_key", statusKey);
    if (access.isPublicAccess) query = query.eq("visibility", "public");

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("listItems query error:", error);
      return json({ error: "Failed to list items" }, 500);
    }

    return json({
      items: data ?? [],
      workspace: {
        id: access.workspace.id,
        slug: access.workspace.slug,
        visibility: access.workspace.visibility,
      },
    });
  } catch (error) {
    console.error("listItems error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
