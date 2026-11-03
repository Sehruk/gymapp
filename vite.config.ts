import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// base './' lets the built app run from any sub-path (e.g. GitHub Pages project sites).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'], maximumFileSizeToCacheInBytes: 6 * 1024 * 1024 },
      manifest: {
        name: 'GymApp',
        short_name: 'GymApp',
        description: 'Offline workout, cardio and steps log',
        lang: 'en',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1120',
        theme_color: '#0b1120',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
})
