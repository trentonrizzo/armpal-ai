import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/', // <— Important for Vercel routing
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'ArmPal',
        short_name: 'ArmPal',
        start_url: '/',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#ff0000',
        description: 'Track your strength, master your technique, and grow freaky strong.',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[^\/]+/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ap-network-cache'
            }
          }
        ]
      }
    })
  ]
});
