import { requireAuth, requireMinimumRole, verifyWorkspace } from "../_shared/authHelpers.ts";
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

function fallbackNameFromEmail(email: string | null | undefined) {
  const localPart = String(email || "").split("@")[0] || "";
  if (!localPart) return "";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function resolveNameParts(metadata: Record<string, unknown>, email: string | null | undefined) {
  const firstName = String(
    metadata.first_name || metadata.given_name || "",
  ).trim();
  const lastName = String(
    metadata.last_name || metadata.family_name || "",
  ).trim();
  const fullNameFromMetadata = String(metadata.full_name || metadata.name || "").trim();

  if (firstName || lastName) {
    return {
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
    };
  }

  if (fullNameFromMetadata) {
    const parts = fullNameFromMetadata.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return {
        first_name: parts[0],
        last_name: "",
        full_name: fullNameFromMetadata,
      };
    }
    return {
      first_name: parts.slice(0, -1).join(" "),
      last_name: parts.slice(-1).join(""),
      full_name: fullNameFromMetadata,
    };
  }

  const fallback = fallbackNameFromEmail(email);
  return {
    first_name: fallback,
    last_name: "",
    full_name: fallback,
  };
}

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

    const accessCheck = await requireMinimumRole(workspaceId, authCheck.user.id, "contributor");
    if (!accessCheck.success) {
      return new Response(accessCheck.error.body, {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from("workspace_roles")
      .select("id, workspace_id, user_id, email, role")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (rowsError) {
      console.error("listWorkspaceMemberDirectory role query error:", rowsError);
      return json({ error: "Failed to list members" }, 500);
    }

    const members = await Promise.all(
      (rows || []).map(async (row) => {
        try {
          const { data, error } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
          if (error || !data?.user) {
            return {
              ...row,
              ...resolveNameParts({}, row.email),
              profile_photo_url: null,
            };
          }

          const metadata = (data.user.user_metadata || {}) as Record<string, unknown>;
          return {
            ...row,
            ...resolveNameParts(metadata, row.email),
            profile_photo_url: String(metadata.profile_photo_url || "").trim() || null,
          };
        } catch {
          return {
            ...row,
            ...resolveNameParts({}, row.email),
            profile_photo_url: null,
          };
        }
      }),
    );

    return json({ members });
  } catch (error) {
    console.error("listWorkspaceMemberDirectory error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
