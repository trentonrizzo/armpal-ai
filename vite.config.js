import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",

  plugins: [
    react(),

    VitePWA({
      // 🚫 DO NOT AUTO REGISTER (iOS BUG SOURCE)
      registerType: "prompt",
      injectRegister: false,

      includeAssets: [
        "favicon.ico",
        "pwa-192x192.png",
        "pwa-512x512.png",
      ],

      manifest: {
        name: "ArmPal",
        short_name: "ArmPal",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#ff0000",
        description:
          "Track your strength, master your technique, and grow freaky strong.",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },

      // ✅ iOS-SAFE WORKBOX CONFIG
      workbox: {
        cleanupOutdatedCaches: true,

        // 🔥 FORCE NEW BUILDS TO TAKE OVER
        skipWaiting: true,
        clientsClaim: true,

        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],

        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

        runtimeCaching: [
          // HTML / SPA navigation
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
              networkTimeoutSeconds: 2,
            },
          },

          // JS / CSS
          {
            urlPattern: ({ request }) =>
              request.destination === "script" ||
              request.destination === "style",
            handler: "NetworkFirst",
            options: {
              cacheName: "asset-cache",
            },
          },

          // Images
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },

      // ✅ DEV MODE: NO SW AT ALL
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
