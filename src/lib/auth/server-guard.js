import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireServerAuth(returnToPath = "/workspaces") {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const signInPath = `/auth/sign-in?returnTo=${encodeURIComponent(returnToPath)}`;
    redirect(signInPath);
  }

  return user;
}
