/**
 * Generate canonical board URL paths
 * @param {string} slug - Board slug
 * @param {string} section - Board section (feedback, roadmap, changelog, docs, support, etc.)
 * @param {Object} options - Additional options
 * @param {string} options.query - Query string (e.g., "?id=123&tab=details")
 * @returns {string} Canonical board URL path
 */
export function boardUrl(slug, section, options = {}) {
  const path = `/board/${slug}/${section}`;
  return options.query ? `${path}${options.query}` : path;
}

/**
 * Build query string from params object
 * @param {Object} params - Query parameters
 * @returns {string} Query string (e.g., "?id=123&tab=details")
 */
export function buildQuery(params) {
  if (!params || Object.keys(params).length === 0) return '';
  const searchParams = new URLSearchParams(params);
  return `?${searchParams.toString()}`;
}