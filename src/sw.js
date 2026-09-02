import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

// Passage de la stratégie generateSW à injectManifest : nécessaire pour
// pouvoir écouter les événements push/notificationclick nous-mêmes
// (generateSW ne génère qu'un service worker de cache, sans point
// d'extension pour du code personnalisé). Le comportement de cache existant
// (précache du build + cache des photos produits) est repris à l'identique
// ci-dessous, juste exprimé en API Workbox directe plutôt qu'en config.

precacheAndRoute(self.__WB_MANIFEST);

// Photos produits/menu/villas (bucket Supabase Storage product-images) :
// sans cette règle, le service worker ne touche que les fichiers de build
// précachés — une photo déjà vue disparaîtrait dès qu'on repasse
// hors-ligne. CacheFirst car ce sont des fichiers immuables (nouvelle
// photo = nouveau chemin, jamais réécrits sur place).
registerRoute(
    ({ url }) => url.pathname.includes('/storage/v1/object/public/product-images/'),
    new CacheFirst({
        cacheName: 'product-images',
        plugins: [
            new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 24 * 60 * 60 }),
            new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
    })
);

// registerType: 'autoUpdate' reposait sur skipWaiting/clientsClaim gérés
// automatiquement par generateSW — à refaire nous-mêmes ici pour garder le
// même comportement (nouvelle version activée immédiatement, sans attendre
// la fermeture de tous les onglets).
self.skipWaiting();
clientsClaim();

// Notification push : reçoit le message envoyé par send-push-notification
// (déclenché depuis process_sale quand un produit franchit le seuil de
// stock bas) et l'affiche via l'API Notification du système.
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: 'GestionPro', body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'GestionPro';
    const options = {
        body: data.body || '',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: { url: data.url || '/dashboard/stock' },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// Clic sur la notification : ramène au premier onglet déjà ouvert de l'app
// plutôt que d'en ouvrir un nouveau si un est déjà là.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/dashboard';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
        })
    );
});
