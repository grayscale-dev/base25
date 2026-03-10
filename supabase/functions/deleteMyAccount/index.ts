import { requireAuth } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  try {
    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return authCheck.error;
    }

    const userId = authCheck.user.id;
    const userEmail = authCheck.user.email || null;

    const cleanupTasks = [
      supabaseAdmin.from("board_roles").delete().eq("user_id", userId),
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
        return Response.json(
          { error: "Unable to delete account", code: "DELETE_FAILED" },
          { status: 500 },
        );
      }
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      userId,
    );
    if (deleteError) {
      console.error("deleteMyAccount auth deletion failure:", deleteError);
      return Response.json(
        { error: "Unable to delete account", code: "DELETE_FAILED" },
        { status: 500 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("deleteMyAccount unexpected error:", error);
    return Response.json(
      { error: "Unable to delete account", code: "DELETE_FAILED" },
      { status: 500 },
    );
  }
});
