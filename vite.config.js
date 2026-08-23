import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // Le défaut de 5000ms est trop juste pour les premiers tests de fichiers
    // qui font beaucoup d'interactions userEvent (typing + click) : le coût
    // d'import/transform à froid des dépendances (framer-motion,
    // react-hook-form, zod...) empiète sur ce budget et faisait échouer ces
    // tests systématiquement en CI (runners plus lents/à froid), pas juste
    // occasionnellement.
    testTimeout: 15000,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'GestionPro',
        short_name: 'GestionPro',
        description: 'Application de gestion hors-ligne',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            // pwa-192x192.png/pwa-512x512.png étaient référencées mais
            // n'existaient nulle part dans public/ — le manifest pointait
            // vers des fichiers introuvables. favicon.svg existe déjà et un
            // icône SVG "any" est valide pour un manifest PWA.
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // Photos produits/menu/villas (bucket Supabase Storage product-images) :
        // sans cette règle, le service worker ne touche que les fichiers de
        // build précachés — une photo déjà vue disparaîtrait dès qu'on repasse
        // hors-ligne. CacheFirst car ce sont des fichiers immuables (nouvelle
        // photo = nouveau chemin, jamais réécrits sur place).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/public/product-images/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
})
