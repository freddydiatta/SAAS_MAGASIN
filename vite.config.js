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
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 // 5 MB
      }
    })
  ],
})
