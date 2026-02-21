/**
 * offlineQueue.js — Cola de operaciones offline con auto-sync
 *
 * Cuando no hay internet, las operaciones (agua, comida, peso, actividad)
 * se guardan en localStorage. Al detectar conexión, se sincronizan
 * automáticamente con Supabase.
 *
 * Patrón: "Store & Forward" — la UI siempre responde, la red es eventual.
 */

const LS_KEY = 'kcal_offline_queue'

// ── Estado reactivo ─────────────────────────────────────────────────────────

let _listeners = []

/** Suscribe un listener a cambios de la cola (para UI indicators) */
export function onQueueChange(fn) {
    _listeners.push(fn)
    return () => { _listeners = _listeners.filter(f => f !== fn) }
}

function _notify() {
    const q = getQueue()
    _listeners.forEach(fn => fn(q))
}

// ── Gestión de la cola ──────────────────────────────────────────────────────

/** Lee la cola desde localStorage */
export function getQueue() {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
    } catch {
        return []
    }
}

/** Guarda la cola en localStorage */
function saveQueue(queue) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(queue))
        _notify()
    } catch (e) {
        console.error('offlineQueue: error guardando cola', e)
    }
}

/**
 * Agrega una operación a la cola offline.
 * @param {'addFood'|'setWater'|'logWeight'|'logActivity'} action
 * @param {object} payload — argumentos de la función original
 */
export function enqueue(action, payload) {
    const queue = getQueue()
    queue.push({
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        action,
        payload,
        timestamp: new Date().toISOString(),
        retries: 0,
    })
    saveQueue(queue)
    console.info(`📦 Offline: enqueued "${action}"`, payload)
}

/** Elimina un item de la cola por ID */
function dequeue(id) {
    const queue = getQueue().filter(item => item.id !== id)
    saveQueue(queue)
}

/** ¿Hay items pendientes? */
export function hasPending() {
    return getQueue().length > 0
}

/** Cantidad de items pendientes */
export function pendingCount() {
    return getQueue().length
}

// ── Sync con Supabase ───────────────────────────────────────────────────────

/**
 * Importación dinámica para evitar dependencias circulares.
 * Solo se importa al momento de sincronizar.
 */
async function getSupabaseFns() {
    const mod = await import('./supabase.js')
    return {
        addFood: mod.addFood,
        setWaterGlasses: mod.setWaterGlasses,
        logWeight: mod.logWeight,
        logActivity: mod.logActivity,
    }
}

/**
 * Procesa toda la cola offline: ejecuta cada operación contra Supabase.
 * Items que fallan se mantienen en la cola (max 5 reintentos).
 * @returns {number} cantidad de items sincronizados con éxito
 */
export async function flushQueue() {
    const queue = getQueue()
    if (queue.length === 0) return 0

    // No intentar si no hay red
    if (!navigator.onLine) return 0

    console.info(`🔄 Offline sync: procesando ${queue.length} item(s)...`)

    const fns = await getSupabaseFns()
    let synced = 0

    for (const item of queue) {
        try {
            switch (item.action) {
                case 'addFood':
                    await fns.addFood(item.payload)
                    break
                case 'setWater':
                    await fns.setWaterGlasses(item.payload.date, item.payload.glasses)
                    break
                case 'logWeight':
                    await fns.logWeight(item.payload.date, item.payload.weight_kg, item.payload.notes)
                    break
                case 'logActivity':
                    await fns.logActivity(item.payload.type, item.payload.metadata)
                    break
                default:
                    console.warn('offlineQueue: acción desconocida', item.action)
            }
            dequeue(item.id)
            synced++
        } catch (err) {
            console.error(`offlineQueue: fallo al sincronizar "${item.action}"`, err)
            // Incrementar reintentos; eliminar si ya pasó de 5
            item.retries = (item.retries ?? 0) + 1
            if (item.retries > 5) {
                console.warn(`offlineQueue: eliminando "${item.action}" tras 5 reintentos`)
                dequeue(item.id)
            }
        }
    }

    // Re-guardar items que fallaron con reintentos actualizados
    const remaining = getQueue()
    saveQueue(remaining)

    if (synced > 0) console.info(`✅ Offline sync: ${synced} item(s) sincronizados`)
    return synced
}

// ── Auto-sync al recuperar conexión ─────────────────────────────────────────

/**
 * Inicializa el listener de red.
 * Cuando el navegador detecta `online`, vacía la cola automáticamente.
 * También intenta vaciar al cargar la página (por si quedaron pendientes).
 */
export function initOfflineSync() {
    // Sync al volver online
    window.addEventListener('online', () => {
        console.info('🌐 Conexión recuperada — sincronizando cola offline...')
        setTimeout(() => flushQueue(), 1500) // Esperar 1.5s para que la red se estabilice
    })

    // Sync al cargar la app (por si quedaron pendientes de la sesión anterior)
    if (navigator.onLine && hasPending()) {
        setTimeout(() => flushQueue(), 3000) // Esperar 3s después del arranque
    }
}

// ── Helper: ejecutar con fallback offline ───────────────────────────────────

/**
 * Wrapper que intenta ejecutar una función async.
 * Si falla por red, encola la operación para sync posterior.
 *
 * @param {Function} fn — función async a ejecutar
 * @param {string} action — nombre de la acción para la cola
 * @param {object} payload — datos para la cola
 * @param {object} [options] — opciones adicionales
 * @param {boolean} [options.silent] — no lanzar error al componente
 * @returns {Promise<any>} resultado de fn, o undefined si se encoló
 */
export async function withOfflineFallback(fn, action, payload, options = {}) {
    // Si no hay internet, encolar directamente
    if (!navigator.onLine) {
        enqueue(action, payload)
        return undefined
    }

    try {
        return await fn()
    } catch (err) {
        // Si el error parece de red, encolar
        const isNetworkError = !navigator.onLine
            || err.message?.includes('Failed to fetch')
            || err.message?.includes('NetworkError')
            || err.message?.includes('ERR_INTERNET_DISCONNECTED')
            || err.code === 'PGRST301' // JWT error (Supabase sin conexión)

        if (isNetworkError) {
            enqueue(action, payload)
            if (!options.silent) {
                console.warn(`📦 Sin red: "${action}" encolado para sync posterior`)
            }
            return undefined
        }

        // Error real (no de red), re-lanzar
        throw err
    }
}
