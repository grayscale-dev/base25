import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withFallback = (nextKey, viteKey, defaultValue = "") =>
  process.env[nextKey] ?? process.env[viteKey] ?? defaultValue;

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  eslint: {
    // Lint is enforced via `npm run lint`; keep production builds deterministic.
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: withFallback(
      "NEXT_PUBLIC_SUPABASE_URL",
      "VITE_SUPABASE_URL",
      "http://127.0.0.1:54321"
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: withFallback(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "VITE_SUPABASE_ANON_KEY",
      ""
    ),
    NEXT_PUBLIC_BASE44_APP_ID: withFallback(
      "NEXT_PUBLIC_BASE44_APP_ID",
      "VITE_BASE44_APP_ID",
      ""
    ),
    NEXT_PUBLIC_BASE44_FUNCTIONS_VERSION: withFallback(
      "NEXT_PUBLIC_BASE44_FUNCTIONS_VERSION",
      "VITE_BASE44_FUNCTIONS_VERSION",
      ""
    ),
    NEXT_PUBLIC_BASE44_APP_BASE_URL: withFallback(
      "NEXT_PUBLIC_BASE44_APP_BASE_URL",
      "VITE_BASE44_APP_BASE_URL",
      ""
    ),
    NEXT_PUBLIC_AUTH_PROVIDER: withFallback(
      "NEXT_PUBLIC_AUTH_PROVIDER",
      "VITE_AUTH_PROVIDER",
      ""
    ),
  },
  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(__dirname, "src");
    return config;
  },
};

export default nextConfig;
