import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub Pages sert le site sous /<nom-du-repo>/
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Piano Coach',
        short_name: 'Piano',
        lang: 'fr',
        description: "Apprendre n'importe quel morceau au piano",
        theme_color: '#0d0e12',
        background_color: '#0d0e12',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          // Le motif tient dans la zone sûre : Android peut le découper en cercle
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [
          // Morceaux et échantillons de piano : disponibles hors ligne une fois ouverts
          {
            urlPattern: ({ url }) => url.pathname.includes('/songs/'),
            // Inclut raw.githubusercontent.com : la bibliothèque reste lisible hors ligne
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'songs' },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'smpldsnds.github.io',
            handler: 'CacheFirst',
            options: { cacheName: 'piano-samples', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('mzstatic.com'),
            handler: 'CacheFirst',
            options: { cacheName: 'covers', expiration: { maxEntries: 300 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
})
