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
        theme_color: '#0f1115',
        background_color: '#0f1115',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        runtimeCaching: [
          // Morceaux et échantillons de piano : disponibles hors ligne une fois ouverts
          {
            urlPattern: ({ url }) => url.pathname.includes('/songs/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'songs' },
          },
          {
            urlPattern: ({ url }) => url.href.startsWith('https://tonejs.github.io/audio/salamander/'),
            handler: 'CacheFirst',
            options: { cacheName: 'piano-samples', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
})
