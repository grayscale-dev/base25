const fallback = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

export const env = {
  supabaseUrl: fallback(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "http://127.0.0.1:54321"
  ),
  supabaseAnonKey: fallback(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
  ),
  base44AppId: fallback(process.env.NEXT_PUBLIC_BASE44_APP_ID, ""),
  base44FunctionsVersion: fallback(
    process.env.NEXT_PUBLIC_BASE44_FUNCTIONS_VERSION,
    ""
  ),
  base44AppBaseUrl: fallback(process.env.NEXT_PUBLIC_BASE44_APP_BASE_URL, ""),
  authProvider: fallback(process.env.NEXT_PUBLIC_AUTH_PROVIDER, ""),
};
