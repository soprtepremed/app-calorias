/**
 * service-worker.js — PWA Service Worker para K-Cal
 *
 * Funcionalidades:
 *  1. Cache offline — guarda la app shell para funcionar sin internet
 *  2. Estrategia Network First — intenta red, si falla usa cache
 *  3. Notificaciones push — maneja eventos push del servidor (futuro)
 *  4. Precache de assets estáticos en install
 *
 * IMPORTANTE: Este SW se registra desde main.jsx y vive en /sw.js
 * después del build de Vite (se copia desde public/).
 */

const CACHE_NAME = 'kcal-v1'

// Assets a pre-cachear durante la instalación
// Solo incluimos la shell de la app; JS/CSS los cachea dinámicamente
const PRECACHE_URLS = [
    '/',
    '/favicon.png',
    '/manifest.json',
]

// ── INSTALL ───────────────────────────────────────────────────────────────
// Pre-cachear assets esenciales
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...')
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting()) // Activar inmediatamente
    )
})

// ── ACTIVATE ──────────────────────────────────────────────────────────────
// Limpiar caches antiguas
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...')
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim()) // Tomar control de todas las páginas
    )
})

// ── FETCH ─────────────────────────────────────────────────────────────────
// Estrategia: Network First con fallback a cache
// - APIs (supabase, gemini) → SIEMPRE red, nunca cache
// - Assets estáticos → intenta red, si falla usa cache
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url)

    // No cachear: APIs externas, supabase, chrome-extension, etc.
    if (
        url.origin !== location.origin ||
        url.pathname.startsWith('/rest/') ||
        url.pathname.startsWith('/auth/') ||
        url.pathname.startsWith('/storage/') ||
        event.request.method !== 'GET'
    ) {
        return // Dejar que el navegador maneje normalmente
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Clonar y cachear la respuesta exitosa
                if (response.ok) {
                    const clone = response.clone()
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone)
                    })
                }
                return response
            })
            .catch(() => {
                // Sin red → servir desde cache
                return caches.match(event.request).then(cached => {
                    if (cached) return cached
                    // Si no hay cache, servir la página principal (SPA fallback)
                    if (event.request.mode === 'navigate') {
                        return caches.match('/')
                    }
                    return new Response('Offline', { status: 503 })
                })
            })
    )
})

// ── PUSH NOTIFICATIONS ───────────────────────────────────────────────────
// Maneja notificaciones push desde el servidor (o programadas localmente)
self.addEventListener('push', (event) => {
    const defaults = {
        title: '💧 K-Cal — Hora de tomar agua',
        body: 'Tu cuerpo necesita hidratación. ¡Toma un vaso de agua!',
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: 'kcal-reminder',
        vibrate: [200, 100, 200],
        data: { url: '/' },
        actions: [
            { action: 'open', title: '📱 Abrir K-Cal' },
            { action: 'dismiss', title: 'Después' },
        ],
    }

    let payload = defaults
    try {
        if (event.data) {
            const data = event.data.json()
            payload = { ...defaults, ...data }
        }
    } catch { /* usa defaults */ }

    event.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon,
            badge: payload.badge,
            tag: payload.tag,
            vibrate: payload.vibrate,
            data: payload.data,
            actions: payload.actions,
        })
    )
})

// ── NOTIFICATION CLICK ───────────────────────────────────────────────────
// Al hacer click en la notificación, abrir/enfocar la app
self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    if (event.action === 'dismiss') return

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => {
                // Si ya hay una ventana abierta, enfocarla
                for (const client of clients) {
                    if (client.url.includes(self.location.origin)) {
                        return client.focus()
                    }
                }
                // Si no, abrir una nueva
                return self.clients.openWindow(event.notification.data?.url ?? '/')
            })
    )
})

// ── PERIODIC SYNC (futuro) ───────────────────────────────────────────────
// Permite sincronizar datos en segundo plano (cuando el browser lo soporte)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'sync-offline-queue') {
        event.waitUntil(
            // Notificar a todas las páginas abiertas que sincronicen
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SYNC_OFFLINE_QUEUE' })
                })
            })
        )
    }
})

// ── BACKGROUND SYNC ──────────────────────────────────────────────────────
// Cuando el dispositivo recupera conexión, sincronizar cola offline
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-offline') {
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SYNC_OFFLINE_QUEUE' })
                })
            })
        )
    }
})
