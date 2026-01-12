import { authorizeWriteAction, requireStaff } from "../_shared/authHelpers.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { feedback_id, board_id, updates } = payload;

    if (!feedback_id || !board_id || !updates) {
      return Response.json(
        {
          error: "Missing required fields",
          code: "INVALID_INPUT",
          required: ["feedback_id", "board_id", "updates"],
        },
        { status: 400 },
      );
    }

    const auth = await authorizeWriteAction(req, board_id, "contributor");
    if (!auth.success) {
      return auth.error;
    }

    const { data: feedback, error: feedbackError } = await supabaseAdmin
      .from("feedback")
      .select("*")
      .eq("id", feedback_id)
      .eq("board_id", board_id)
      .limit(1)
      .maybeSingle();

    if (feedbackError) {
      console.error("Feedback lookup error:", feedbackError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!feedback) {
      return Response.json(
        { error: "Feedback not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const staffFields = ["status", "priority", "assigned_to", "visibility"];
    const hasStaffUpdates = Object.keys(updates).some((key) =>
      staffFields.includes(key)
    );

    if (hasStaffUpdates) {
      const staffCheck = await requireStaff(board_id, auth.user.id);
      if (!staffCheck.success) {
        return staffCheck.error;
      }
    } else if (feedback.submitter_id !== auth.user.id) {
      return Response.json(
        {
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "You can only edit your own feedback",
        },
        { status: 403 },
      );
    }

    const { data: updated, error } = await auth.supabase
      .from("feedback")
      .update(updates)
      .eq("id", feedback_id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Update feedback error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("Update feedback error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
