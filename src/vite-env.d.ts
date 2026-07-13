/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_API_URL: string;
  readonly VITE_FEATURE_COPILOT?: string;
  readonly VITE_FEATURE_BRAND_BILLING?: string;
  readonly VITE_FEATURE_ONBOARDING_V2?: string;
  readonly VITE_FEATURE_COCKPIT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
