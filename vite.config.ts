import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

/**
 * SubTranslate build configuration.
 *
 * The PWA plugin does three things for us:
 *  1. Pre-caches the app shell so the UI boots with zero network.
 *  2. Runtime-caches Whisper / ONNX WASM weights (they are large, immutable files).
 *  3. Emits a Web Manifest so the app is installable on Android, desktop and iOS.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'robots.txt', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'SubTranslate - Live Audio Subtitles',
        short_name: 'SubTranslate',
        description:
          'Real-time, privacy-first audio transcription and translation. Live subtitles over Instagram, TikTok, YouTube and any other app.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'portrait-primary',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        categories: ['utilities', 'productivity', 'education'],
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: 'Open Overlay Simulator',
            short_name: 'Overlay',
            description: 'Preview live subtitles over an app',
            url: '/#/overlay',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Open Dashboard',
            short_name: 'Dashboard',
            description: 'Jump straight to the live dashboard',
            url: '/#/',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff,woff2,json}'],
        // The app shell must stay small; model weights are runtime-cached instead.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /\.(?:png|jpg|jpeg|svg|webp|json)$/],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        runtimeCaching: [
          {
            // On-device Whisper / ONNX Runtime WASM binaries.
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*\.(?:wasm|mjs|js)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'subtranslate-wasm',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Hugging Face model weights + tokenizer files.
            urlPattern: /^https:\/\/(?:huggingface\.co|cdn-lfs[^/]*\.huggingface\.co|hf\.co)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'subtranslate-ml-models',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
          {
            // Free translation API: serve a recent answer if the network drops.
            urlPattern: /^https:\/\/api\.mymemory\.translated\.net\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'subtranslate-translations',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'subtranslate-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          capacitor: ['@capacitor/core', '@capacitor/app'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
