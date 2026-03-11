import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

let browserClient = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        flowType: "implicit",
      },
    });
  }
  return browserClient;
}

export const supabase = getSupabaseBrowserClient();
