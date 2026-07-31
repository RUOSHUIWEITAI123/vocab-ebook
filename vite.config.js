import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  server: {
    port: 3000,
    open: true,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: '580词考研英语电子书',
        short_name: '580词电子书',
        description: '交互式考研英语词汇学习电子书',
        theme_color: '#2e7d32',
        background_color: '#fafaf7',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        globIgnores: ['**/dict/*.json'],
        runtimeCaching: [
          {
            urlPattern: /\/data\/dict\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'dict-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/data\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'content-cache',
              expiration: { maxEntries: 10 },
            },
          },
        ],
      },
    }),
  ],
});
