const DEFAULT_SITE_BASE_URL = "https://base25.app";

function ensureUrlProtocol(value) {
  if (!value) return value;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function getSiteBaseUrl(rawValue = process.env.NEXT_PUBLIC_BASE44_APP_BASE_URL) {
  const trimmed = (rawValue || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    return DEFAULT_SITE_BASE_URL;
  }

  try {
    return new URL(ensureUrlProtocol(trimmed)).origin;
  } catch {
    return DEFAULT_SITE_BASE_URL;
  }
}

