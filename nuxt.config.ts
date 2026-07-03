// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    "@nuxt/eslint",
    "@nuxt/ui",
    "@comark/nuxt",
    "@nuxthub/core",
    "nuxt-auth-utils",
    "nuxt-charts",
    "nuxt-csurf",
    "nuxt-spyglass",
  ],

  devtools: {
    enabled: true,
  },

  ssr: false,

  css: ["~/assets/css/main.css"],

  experimental: {
    viewTransition: true,
  },

  compatibilityDate: "2026-06-30",

  nitro: {
    experimental: {
      openAPI: true,
    },
  },

  routeRules: {
    // spyglass ingest needs no CSRF — it's a dev-only debug endpoint
    "/_spyglass/ingest": { csurf: false } as any,
  },

  hub: {
    db: "sqlite",
    blob: true,
  },

  vite: {
    optimizeDeps: {
      include: [
        "@tiptap/extension-emoji",
        "@tiptap/extension-text-align",
        "date-fns",
        "striptags", // CJS
        "tiptap-extension-code-block-shiki",
      ],
    },
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: "never",
        braceStyle: "1tbs",
      },
    },
  },

  runtimeConfig: {
    public: {
      // Hermes dashboard backend URL — the Nitro proxy forwards /api/hermes/* here.
      // Override via NUXT_PUBLIC_HERMES_API_URL env var.
      hermesApiUrl: "http://127.0.0.1:8080",
    },
  },
});
