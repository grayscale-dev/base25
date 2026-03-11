import { requireAdmin, requireAuth, verifyWorkspace } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

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

const VISIBILITY_VALUES = new Set(["public", "restricted"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return new Response(authCheck.error.body, {
        status: authCheck.error.status,
        headers: corsHeaders,
      });
    }

    const payload = await req.json().catch(() => ({}));
    const workspaceId = String(payload?.workspace_id || "").trim();

    if (!workspaceId) {
      return json({ error: "workspace_id is required" }, 400);
    }

    const workspaceCheck = await verifyWorkspace(workspaceId);
    if (!workspaceCheck.success) {
      return new Response(workspaceCheck.error.body, {
        status: workspaceCheck.error.status,
        headers: corsHeaders,
      });
    }

    const permissionCheck = await requireAdmin(workspaceId, authCheck.user.id);
    if (!permissionCheck.success) {
      return new Response(permissionCheck.error.body, {
        status: permissionCheck.error.status,
        headers: corsHeaders,
      });
    }

    const isOwner = permissionCheck.role === "owner";
    const existingWorkspace = workspaceCheck.workspace;

    const nextName =
      typeof payload.name === "string" ? payload.name.trim() : existingWorkspace.name;
    const nextSlug =
      typeof payload.slug === "string" ? payload.slug.trim().toLowerCase() : existingWorkspace.slug;

    if (!nextName) {
      return json({ error: "Workspace name is required" }, 400);
    }
    if (!nextSlug) {
      return json({ error: "Workspace slug is required" }, 400);
    }

    if ((nextName !== existingWorkspace.name || nextSlug !== existingWorkspace.slug) && !isOwner) {
      return json(
        {
          error: "Only the workspace owner can change the workspace name or slug",
          code: "OWNER_REQUIRED_FOR_IDENTITY_UPDATE",
        },
        403,
      );
    }

    if (nextSlug !== existingWorkspace.slug) {
      const { data: duplicate, error: duplicateError } = await supabaseAdmin
        .from("workspaces")
        .select("id")
        .eq("slug", nextSlug)
        .neq("id", workspaceId)
        .limit(1)
        .maybeSingle();

      if (duplicateError) {
        console.error("updateWorkspaceSettings slug lookup error:", duplicateError);
        return json({ error: "Failed to validate slug" }, 500);
      }
      if (duplicate) {
        return json({ error: "This workspace slug is already taken" }, 409);
      }
    }

    const patch: Record<string, unknown> = {
      name: nextName,
      slug: nextSlug,
    };

    if (typeof payload.description === "string") {
      patch.description = payload.description;
    }
    if (typeof payload.logo_url === "string") {
      patch.logo_url = payload.logo_url;
    }
    if (typeof payload.primary_color === "string") {
      patch.primary_color = payload.primary_color;
    }
    if (typeof payload.visibility === "string") {
      if (!VISIBILITY_VALUES.has(payload.visibility)) {
        return json({ error: "visibility must be public or restricted" }, 400);
      }
      patch.visibility = payload.visibility;
    }
    if (payload.settings !== undefined) {
      if (!payload.settings || typeof payload.settings !== "object" || Array.isArray(payload.settings)) {
        return json({ error: "settings must be an object" }, 400);
      }
      patch.settings = payload.settings;
    }

    const { data: updatedWorkspace, error: updateError } = await supabaseAdmin
      .from("workspaces")
      .update(patch)
      .eq("id", workspaceId)
      .select("*")
      .single();

    if (updateError) {
      console.error("updateWorkspaceSettings update error:", updateError);
      return json({ error: "Failed to update workspace settings" }, 500);
    }

    return json(updatedWorkspace);
  } catch (error) {
    console.error("updateWorkspaceSettings unexpected error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
