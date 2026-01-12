import { ErrorResponses, requireAuth } from "../_shared/authHelpers.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { full_name, profile_photo_url } = payload;

    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return authCheck.error;
    }

    const updates: Record<string, string> = {};

    if (full_name !== undefined) {
      if (full_name.trim() === "") {
        return Response.json(
          {
            error: "Invalid name",
            code: "INVALID_INPUT",
            message: "Name cannot be empty",
          },
          { status: 400 },
        );
      }
      updates.full_name = full_name.trim();
    }

    if (profile_photo_url !== undefined) {
      updates.profile_photo_url = profile_photo_url;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { error: "No updates provided", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const { error: updateError } = await authCheck.supabase.auth.updateUser({
      data: updates,
    });

    if (updateError) {
      console.error("Update user profile error:", updateError);
      return Response.json(ErrorResponses.INVALID_INPUT, { status: 400 });
    }

    const {
      data: { user },
      error: fetchError,
    } = await authCheck.supabase.auth.getUser();

    if (fetchError || !user) {
      console.error("Fetch updated user error:", fetchError);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    return Response.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || "",
        profile_photo_url: user.user_metadata?.profile_photo_url || null,
      },
    });
  } catch (error) {
    console.error("Update user profile error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
