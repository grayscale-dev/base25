import { base44 } from "@/api/base44Client";

function getErrorStatus(error) {
  if (!error) return null;
  return error.status ?? error.context?.status ?? error.response?.status ?? null;
}

function getErrorMessage(error, fallback) {
  const message =
    error?.context?.body?.error ||
    error?.body?.error ||
    error?.message ||
    "";
  const normalized = String(message || "").trim();
  return normalized || fallback;
}

export async function openStripeBilling({ workspaceId, returnUrl }) {
  if (!workspaceId) {
    return { ok: false, error: "Workspace is missing." };
  }

  const resolvedReturnUrl = returnUrl || (typeof window !== "undefined" ? window.location.href : "");
  if (!resolvedReturnUrl) {
    return { ok: false, error: "Return URL is missing." };
  }

  try {
    const { data } = await base44.functions.invoke(
      "createBillingPortal",
      {
        workspace_id: workspaceId,
        return_url: resolvedReturnUrl,
      },
      { authMode: "user" }
    );
    if (data?.url) {
      window.location.href = data.url;
      return { ok: true, destination: "portal" };
    }
  } catch (portalError) {
    const portalStatus = getErrorStatus(portalError);
    if (portalStatus !== 404) {
      return {
        ok: false,
        error: getErrorMessage(portalError, "Unable to open Stripe billing portal."),
      };
    }
  }

  let data = null;
  try {
    const response = await base44.functions.invoke(
      "createCheckoutSession",
      {
        workspace_id: workspaceId,
        success_url: resolvedReturnUrl,
        cancel_url: resolvedReturnUrl,
      },
      { authMode: "user" }
    );
    data = response?.data || null;
  } catch (checkoutError) {
    return {
      ok: false,
      error: getErrorMessage(checkoutError, "Unable to open Stripe checkout."),
    };
  }

  if (!data?.url) {
    return { ok: false, error: "Stripe checkout URL was not returned." };
  }

  window.location.href = data.url;
  return { ok: true, destination: "checkout" };
}
