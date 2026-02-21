import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ── Registro del Service Worker (PWA) ─────────────────────────────────────
// Solo en producción o en HTTPS. El SW habilita:
//   - Cache offline de la app shell
//   - Notificaciones push
//   - Background sync de cola offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('✅ Service Worker registrado:', reg.scope)

        // Escuchar mensajes del SW (sync offline)
        navigator.serviceWorker.addEventListener('message', async (event) => {
          if (event.data?.type === 'SYNC_OFFLINE_QUEUE') {
            const { flushQueue } = await import('./services/offlineQueue.js')
            const synced = await flushQueue()
            if (synced > 0) {
              console.info(`☁️ Background sync: ${synced} item(s) sincronizados`)
            }
          }
        })
      })
      .catch(err => console.warn('SW registration failed:', err))
  })
}
