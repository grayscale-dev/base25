import { requireAuth } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-forwarded-authorization, x-user-access-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const userId = authCheck.user.id;
    const userEmail = authCheck.user.email || null;

    const cleanupTasks = [
      supabaseAdmin.from("workspace_roles").delete().eq("user_id", userId),
      supabaseAdmin
        .from("items")
        .update({ submitter_id: null, submitter_email: null })
        .eq("submitter_id", userId),
      supabaseAdmin
        .from("item_activities")
        .update({ author_id: null })
        .eq("author_id", userId),
      supabaseAdmin
        .from("audit_logs")
        .update({ actor_email: null })
        .eq("actor_id", userId),
    ];

    if (userEmail) {
      cleanupTasks.push(
        supabaseAdmin
          .from("items")
          .update({ submitter_email: null })
          .eq("submitter_email", userEmail),
      );
      cleanupTasks.push(
        supabaseAdmin
          .from("api_tokens")
          .delete()
          .eq("created_by", userEmail),
      );
    }

    for (const task of cleanupTasks) {
      const { error } = await task;
      if (error) {
        console.error("deleteMyAccount cleanup failure:", error);
        return new Response(
          JSON.stringify({ error: "Unable to delete account", code: "DELETE_FAILED" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      userId,
    );
    if (deleteError) {
      console.error("deleteMyAccount auth deletion failure:", deleteError);
      return new Response(
        JSON.stringify({ error: "Unable to delete account", code: "DELETE_FAILED" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("deleteMyAccount unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Unable to delete account", code: "DELETE_FAILED" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
