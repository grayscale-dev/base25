import { supabaseAdmin } from "./supabase.ts";

export const BILLING_ALLOWED_STATUSES = ["active", "trialing"] as const;

export type BillingAccessState = {
  status: string;
  accessAllowed: boolean;
};

export function isBillingAccessAllowed(status: string | null | undefined) {
  return BILLING_ALLOWED_STATUSES.includes(String(status || "").toLowerCase() as (typeof BILLING_ALLOWED_STATUSES)[number]);
}

export async function getWorkspaceBillingAccessState(workspaceId: string): Promise<BillingAccessState> {
  const { data, error } = await supabaseAdmin
    .from("billing_customers")
    .select("status")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("Billing status lookup error:", error);
    return {
      status: "inactive",
      accessAllowed: false,
    };
  }

  const status = String(data?.status || "inactive").toLowerCase();
  return {
    status,
    accessAllowed: isBillingAccessAllowed(status),
  };
}
