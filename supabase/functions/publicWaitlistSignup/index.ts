import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, addNoCacheHeaders, RATE_LIMITS } from "../_shared/rateLimiter.ts";

Deno.serve(async (req) => {
  try {
    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.SIGNUP);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { first_name, last_name, email, company_name, notes } = body;

    if (!first_name || !last_name || !email || !notes) {
      return Response.json(
        {
          error:
            "Missing required fields: first_name, last_name, email, notes",
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("waitlist_signups")
      .insert({
        first_name,
        last_name,
        email,
        company_name: company_name || "",
        notes,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Waitlist signup error:", error);
      return Response.json(
        { error: "Failed to submit waitlist signup" },
        { status: 500 },
      );
    }

    const response = Response.json({
      success: true,
      id: data.id,
    });

    return addNoCacheHeaders(response);
  } catch (error) {
    console.error("Waitlist signup error:", error);
    return Response.json(
      { error: "Failed to submit waitlist signup" },
      { status: 500 },
    );
  }
});
