import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",

  plugins: [
    react(),

    VitePWA({
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

      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,

        globIgnores: ["**/password-reset-standalone.html", "**/reset-password.html"],

        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/password-reset-standalone\.html$/,
          /^\/reset-password\.html$/,
          /^\/reset-password$/,
        ],

        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,

        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => {
              const path = url.pathname || "";
              if (request.mode !== "navigate") return false;
              if (/^\/password-reset-standalone\.html$/i.test(path)) return false;
              if (/^\/reset-password\.html$/i.test(path)) return false;
              if (/^\/reset-password$/i.test(path)) return false;
              return true;
            },
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
              networkTimeoutSeconds: 2,
            },
          },

          {
            urlPattern: ({ request }) =>
              request.destination === "script" || request.destination === "style",
            handler: "NetworkFirst",
            options: {
              cacheName: "asset-cache",
            },
          },

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

      devOptions: {
        enabled: false,
      },
    }),
  ],
});
