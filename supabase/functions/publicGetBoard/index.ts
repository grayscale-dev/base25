import { supabaseAdmin } from "../_shared/supabase.ts";
import { applyRateLimit, addCacheHeaders, RATE_LIMITS } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    const rateLimitResponse = await applyRateLimit(req, RATE_LIMITS.PUBLIC_API);
    if (rateLimitResponse) return rateLimitResponse;

    const payload = await req.json();
    const { slug } = payload;

    if (!slug) {
      return new Response(JSON.stringify({ error: "Board slug is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabaseAdmin
      .from("boards")
      .select("*")
      .eq("slug", slug)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Board lookup error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data) {
      return new Response(JSON.stringify({ error: "Board not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (data.visibility !== "public") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.replace("Bearer ", "")
        : null;

      if (!token) {
        return new Response(
          JSON.stringify({ error: "This board is not publicly accessible" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(
        token,
      );
      if (authError || !authData?.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const userId = authData.user.id;
      const email = authData.user.email || "";

      const { data: role } = await supabaseAdmin
        .from("board_roles")
        .select("id")
        .eq("board_id", data.id)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (!role) {
        const domain = email.split("@")[1] || "";
        const { data: ruleMatch } = await supabaseAdmin
          .from("board_access_rules")
          .select("id, pattern, pattern_type")
          .eq("board_id", data.id)
          .eq("is_active", true);

        const matchesRule = (ruleMatch || []).some((rule) => {
          if (rule.pattern_type === "exact") {
            return email.toLowerCase() === rule.pattern.toLowerCase();
          }
          if (rule.pattern_type === "domain") {
            const ruleDomain = rule.pattern.replace(/^[*@]+/, "").toLowerCase();
            return domain.toLowerCase() === ruleDomain;
          }
          if (rule.pattern_type === "substring") {
            return email.toLowerCase().includes(rule.pattern.toLowerCase());
          }
          return false;
        });

        if (!matchesRule) {
          return new Response(
            JSON.stringify({ error: "This board is not accessible" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    const response = new Response(
      JSON.stringify({
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description || "",
        logo_url: data.logo_url || "",
        primary_color: data.primary_color || "#0f172a",
        visibility: data.visibility,
        support_enabled: data.support_enabled || false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );

    return addCacheHeaders(response, 300);
  } catch (error) {
    console.error("Public board fetch error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
