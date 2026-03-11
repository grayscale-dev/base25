import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

let browserClient = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  }
  return browserClient;
}

export const supabase = getSupabaseBrowserClient();
