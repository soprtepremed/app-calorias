/**
 * water.js — Recordatorios de agua con Web Notifications API
 */

let reminderId = null

/** Solicita permiso de notificaciones al navegador */
export async function requestNotificationPermission() {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const r = await Notification.requestPermission()
    return r === 'granted'
}

/**
 * Inicia recordatorio periódico de agua.
 * @param {number} intervalHours
 * @param {number} waterGoal
 * @param {() => number} getCurrentGlasses
 */
export function startWaterReminder(intervalHours = 2, waterGoal = 8, getCurrentGlasses = () => 0) {
    stopWaterReminder()
    const ms = intervalHours * 60 * 60 * 1000
    reminderId = setInterval(() => {
        const glasses = getCurrentGlasses()
        const hour = new Date().getHours()
        if (glasses >= waterGoal || hour < 8 || hour >= 22) return
        showWaterNotif(glasses, waterGoal)
    }, ms)
}

/** Detiene el recordatorio */
export function stopWaterReminder() {
    if (reminderId !== null) { clearInterval(reminderId); reminderId = null }
}

/** Muestra notificación de agua */
function showWaterNotif(current, goal) {
    if (Notification.permission !== 'granted') return
    const remaining = goal - current
    const messages = [
        `Te faltan ${remaining} vasos para tu meta 💧`,
        `¡Recuerda hidratarte! Llevas ${current}/${goal} vasos.`,
        `Tu cuerpo necesita agua — ${remaining} vasos más hoy.`,
    ]
    const n = new Notification('💧 Hora de tomar agua', {
        body: messages[Math.floor(Math.random() * messages.length)],
        tag: 'water-reminder',
        icon: '/favicon.png',
    })
    setTimeout(() => n.close(), 8000)
    n.onclick = () => { window.focus(); n.close() }
}
