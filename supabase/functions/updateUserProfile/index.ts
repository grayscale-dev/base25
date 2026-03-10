import { ErrorResponses, requireAuth } from "../_shared/authHelpers.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { first_name, last_name, full_name, profile_photo_url } = payload;

    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return authCheck.error;
    }

    const updates: Record<string, string | null> = {};
    const trimmedFirstName =
      typeof first_name === "string" ? first_name.trim() : undefined;
    const trimmedLastName =
      typeof last_name === "string" ? last_name.trim() : undefined;

    if (trimmedFirstName !== undefined || trimmedLastName !== undefined) {
      if (!trimmedFirstName || !trimmedLastName) {
        return Response.json(
          {
            error: "Invalid name",
            code: "INVALID_INPUT",
            message: "First and last name are required",
          },
          { status: 400 },
        );
      }
      updates.first_name = trimmedFirstName;
      updates.last_name = trimmedLastName;
      updates.full_name = `${trimmedFirstName} ${trimmedLastName}`.trim();
    } else if (full_name !== undefined) {
      if (typeof full_name !== "string" || full_name.trim() === "") {
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
        first_name: user.user_metadata?.first_name || "",
        last_name: user.user_metadata?.last_name || "",
        full_name: user.user_metadata?.full_name || "",
        profile_photo_url: user.user_metadata?.profile_photo_url || null,
      },
    });
  } catch (error) {
    console.error("Update user profile error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
