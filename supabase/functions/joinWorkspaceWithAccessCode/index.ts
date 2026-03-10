import { requireAuth } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashCode(code: string, salt: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

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

    const payload = await req.json().catch(() => ({}));
    const slug = payload.slug;
    const accessCode = typeof payload.access_code === "string"
      ? payload.access_code.trim().toUpperCase()
      : "";

    if (!slug || !accessCode) {
      return new Response(JSON.stringify({ error: "Missing slug or access_code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!authCheck.user.email) {
      return new Response(JSON.stringify({ error: "User email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("id, slug, name, visibility, status")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (workspaceError || !workspace) {
      return new Response(JSON.stringify({ error: "Workspace not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (workspace.visibility !== "restricted") {
      return new Response(JSON.stringify({ error: "Access code not required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: accessRow, error: accessError } = await supabaseAdmin
      .from("workspace_access_codes")
      .select("code_hash, code_salt, expires_at")
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    if (accessError || !accessRow) {
      return new Response(JSON.stringify({ error: "Access code invalid" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (accessRow.expires_at && new Date(accessRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Access code expired" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const computedHash = await hashCode(accessCode, accessRow.code_salt);
    if (computedHash !== accessRow.code_hash) {
      return new Response(JSON.stringify({ error: "Access code invalid" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingRole } = await supabaseAdmin
      .from("workspace_roles")
      .select("id, role")
      .eq("workspace_id", workspace.id)
      .eq("user_id", authCheck.user.id)
      .maybeSingle();

    if (!existingRole) {
      await supabaseAdmin.from("workspace_roles").insert({
        workspace_id: workspace.id,
        user_id: authCheck.user.id,
        email: authCheck.user.email,
        role: "contributor",
        assigned_via: "access_code",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        workspace,
        role: existingRole?.role ?? "contributor",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Join workspace access code error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
