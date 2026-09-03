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
      // injectManifest (au lieu de generateSW, utilisé jusqu'ici) : requis
      // pour pouvoir écouter les événements push/notificationclick dans
      // notre propre service worker (src/sw.js) — generateSW ne génère
      // qu'un service worker de cache, sans point d'extension pour du code
      // personnalisé. Le comportement de cache (précache + photos
      // produits) est repris à l'identique dans src/sw.js.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
      },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'GestionPro',
        short_name: 'GestionPro',
        description: 'Application de gestion hors-ligne',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        // Ouvrir sur la Landing (page marketing publique) à chaque lancement
        // de l'app installée n'a pas de sens pour un usage quotidien : direct
        // sur /login, qui redirige elle-même vers /dashboard si déjà connecté.
        start_url: '/login',
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
        enabled: true,
        type: 'module'
      }
    })
  ],
})
