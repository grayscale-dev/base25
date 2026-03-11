import AuthSignIn from "@/screens/AuthSignIn";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";

export const metadata = buildMarketingMetadata({
  title: "Sign In | base25",
  description: "Sign in to your base25 workspaces using a secure email magic link.",
  path: "/auth/sign-in",
});

export default function AuthSignInPage() {
  return <AuthSignIn />;
}
