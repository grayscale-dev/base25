import { ErrorResponses, requireAuth } from "../_shared/authHelpers.ts";

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
    const payload = await req.json();
    const { first_name, last_name, full_name, profile_photo_url } = payload;

    const authCheck = await requireAuth(req);
    if (!authCheck.success) {
      return new Response(authCheck.error.body, {
        status: authCheck.error.status,
        headers: corsHeaders,
      });
    }

    const updates: Record<string, string | null> = {};
    const trimmedFirstName =
      typeof first_name === "string" ? first_name.trim() : undefined;
    const trimmedLastName =
      typeof last_name === "string" ? last_name.trim() : undefined;

    if (trimmedFirstName !== undefined || trimmedLastName !== undefined) {
      if (!trimmedFirstName || !trimmedLastName) {
        return new Response(
          JSON.stringify({
            error: "Invalid name",
            code: "INVALID_INPUT",
            message: "First and last name are required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      updates.first_name = trimmedFirstName;
      updates.last_name = trimmedLastName;
      updates.full_name = `${trimmedFirstName} ${trimmedLastName}`.trim();
    } else if (full_name !== undefined) {
      if (typeof full_name !== "string" || full_name.trim() === "") {
        return new Response(
          JSON.stringify({
            error: "Invalid name",
            code: "INVALID_INPUT",
            message: "Name cannot be empty",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      updates.full_name = full_name.trim();
    }

    if (profile_photo_url !== undefined) {
      updates.profile_photo_url = profile_photo_url;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: "No updates provided", code: "INVALID_INPUT" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { error: updateError } = await authCheck.supabase.auth.updateUser({
      data: updates,
    });

    if (updateError) {
      console.error("Update user profile error:", updateError);
      return new Response(JSON.stringify(ErrorResponses.INVALID_INPUT), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: fetchError,
    } = await authCheck.supabase.auth.getUser();

    if (fetchError || !user) {
      console.error("Fetch updated user error:", fetchError);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.user_metadata?.first_name || "",
          last_name: user.user_metadata?.last_name || "",
          full_name: user.user_metadata?.full_name || "",
          profile_photo_url: user.user_metadata?.profile_photo_url || null,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Update user profile error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
