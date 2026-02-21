/**
 * FastingTracker.jsx — Rastreador de ayuno intermitente
 *
 * Funcionalidades:
 *  - Presets populares: 16:8, 18:6, 20:4, personalizado
 *  - Timer en vivo con anillo SVG de progreso
 *  - Persistencia en localStorage (sobrevive recargas)
 *  - Estados: en progreso, completado, excedido
 *  - Inicio/fin con hora personalizable
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { logActivity } from '../services/supabase'

// ── Constantes ──────────────────────────────────────────────────────────────

const LS_KEY = 'kcal_fasting'

const PRESETS = [
    { label: '16:8', hours: 16, desc: '16h ayuno · 8h alimentación', popular: true },
    { label: '18:6', hours: 18, desc: '18h ayuno · 6h alimentación', popular: false },
    { label: '20:4', hours: 20, desc: '20h ayuno · 4h alimentación', popular: false },
    { label: '14:10', hours: 14, desc: '14h ayuno · 10h alimentación', popular: false },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Formatea milisegundos a "HH:MM:SS" */
function formatDuration(ms) {
    const abs = Math.abs(ms)
    const h = Math.floor(abs / 3600000)
    const m = Math.floor((abs % 3600000) / 60000)
    const s = Math.floor((abs % 60000) / 1000)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Formatea hora legible "HH:MM AM/PM" */
function formatTime(date) {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
}

/** Lee el estado de ayuno desde localStorage */
function loadFastingState() {
    try {
        const raw = localStorage.getItem(LS_KEY)
        if (!raw) return null
        return JSON.parse(raw)
    } catch { return null }
}

/** Guarda el estado de ayuno en localStorage */
function saveFastingState(state) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(state))
    } catch { /* silencioso */ }
}

/** Limpia el estado de ayuno */
function clearFastingState() {
    try { localStorage.removeItem(LS_KEY) } catch { }
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function FastingTracker({ showToast }) {
    // Estado: null = sin ayuno activo, objeto = ayuno en progreso
    const [fasting, setFasting] = useState(() => {
        const saved = loadFastingState()
        // Auto-cerrar ayunos huérfanos (>48h activos)
        if (saved) {
            const elapsedMs = Date.now() - saved.startedAt
            const MAX_FASTING_MS = 48 * 3600000 // 48 horas máximo
            if (elapsedMs > MAX_FASTING_MS) {
                const durationH = Math.round(elapsedMs / 3600000 * 10) / 10
                logActivity('fasting_expired', {
                    hours_goal: saved.hours,
                    hours_actual: durationH,
                    reason: 'auto_closed_48h',
                })
                clearFastingState()
                return null
            }
        }
        return saved
    })
    const [now, setNow] = useState(Date.now())
    const [showSetup, setShowSetup] = useState(false)
    const [customHours, setCustomHours] = useState(16)
    const timerRef = useRef(null)

    // ── Timer en vivo ────────────────────────────────────────────────────
    useEffect(() => {
        if (fasting) {
            timerRef.current = setInterval(() => setNow(Date.now()), 1000)
        }
        return () => clearInterval(timerRef.current)
    }, [fasting])

    // ── Cálculos derivados ───────────────────────────────────────────────
    const elapsed = fasting ? now - fasting.startedAt : 0
    const goalMs = fasting ? fasting.hours * 3600000 : 0
    const remaining = goalMs - elapsed
    const pct = fasting ? Math.min(elapsed / goalMs, 1) : 0
    const isComplete = pct >= 1
    const exceeded = isComplete ? elapsed - goalMs : 0

    // ── Acciones ─────────────────────────────────────────────────────────

    const startFasting = useCallback((hours) => {
        const state = {
            startedAt: Date.now(),
            hours,
            startLabel: formatTime(new Date()),
        }
        setFasting(state)
        saveFastingState(state)
        setShowSetup(false)
        showToast?.(`Ayuno de ${hours}h iniciado 🕐`)
        // Registrar inicio en activity_log
        logActivity('fasting_start', { hours, protocol: `${hours}:${24 - hours}` })
    }, [showToast])

    const stopFasting = useCallback(() => {
        // Registrar fin en activity_log con duración
        if (fasting) {
            const durationMs = Date.now() - fasting.startedAt
            const durationH = Math.round(durationMs / 3600000 * 10) / 10
            logActivity('fasting_end', {
                hours_goal: fasting.hours,
                hours_actual: durationH,
                completed: durationMs >= fasting.hours * 3600000,
            })
        }
        clearFastingState()
        setFasting(null)
        showToast?.('Ayuno finalizado ✓')
    }, [showToast, fasting])

    // ── SVG Ring ─────────────────────────────────────────────────────────
    const SIZE = 160
    const CTR = SIZE / 2
    const R = 65
    const CIRCUM = 2 * Math.PI * R
    const offset = CIRCUM - pct * CIRCUM

    // Color dinámico según estado
    const ringColor = isComplete ? '#30D158' : '#FF9F0A'
    const glowColor = isComplete ? 'rgba(48,209,88,0.4)' : 'rgba(255,159,10,0.4)'

    // ── Render: sin ayuno activo ─────────────────────────────────────────
    if (!fasting && !showSetup) {
        return (
            <div className="card p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">⏱️</span>
                        <h3 className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest">
                            Ayuno intermitente
                        </h3>
                    </div>
                </div>
                <p className="text-xs text-[#8E8EA0] mb-3">
                    Programa tu ventana de ayuno y rastrea tu progreso en tiempo real.
                </p>
                <button
                    onClick={() => setShowSetup(true)}
                    className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                    style={{
                        background: 'linear-gradient(135deg,#FF6B1A,#FF9F0A)',
                        boxShadow: '0 0 20px rgba(255,107,26,0.35)',
                        color: 'white',
                    }}
                >
                    🕐 Iniciar ayuno
                </button>
            </div>
        )
    }

    // ── Render: pantalla de configuración ─────────────────────────────────
    if (!fasting && showSetup) {
        return (
            <div className="card p-4 mb-3 animate-fade-up">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">⏱️</span>
                        <h3 className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest">
                            Configurar ayuno
                        </h3>
                    </div>
                    <button onClick={() => setShowSetup(false)}
                        className="text-[#8E8EA0] text-xs font-semibold hover:text-white transition-colors">
                        Cancelar
                    </button>
                </div>

                {/* Presets */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                    {PRESETS.map(p => (
                        <button
                            key={p.label}
                            onClick={() => startFasting(p.hours)}
                            className="relative p-3 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                borderColor: 'rgba(255,255,255,0.08)',
                            }}
                        >
                            {p.popular && (
                                <span className="absolute -top-1.5 -right-1.5 text-[8px] font-black text-white
                                    px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'linear-gradient(135deg,#FF6B1A,#FF9F0A)' }}>
                                    Popular
                                </span>
                            )}
                            <p className="text-lg font-black text-white leading-none mb-0.5">{p.label}</p>
                            <p className="text-[9px] text-[#8E8EA0]">{p.desc}</p>
                        </button>
                    ))}
                </div>

                {/* Personalizado */}
                <div className="flex items-center gap-3 p-3 rounded-xl border"
                    style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="flex-1">
                        <p className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest mb-1">Personalizado</p>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={customHours}
                                onChange={e => setCustomHours(Math.max(1, Math.min(48, Number(e.target.value))))}
                                min="1" max="48"
                                className="w-16 px-2 py-1.5 rounded-lg text-center text-white text-sm font-bold
                                           focus:outline-none"
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                            <span className="text-xs text-[#8E8EA0]">horas de ayuno</span>
                        </div>
                    </div>
                    <button
                        onClick={() => startFasting(customHours)}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                        style={{
                            background: 'linear-gradient(135deg,#FF6B1A,#FF9F0A)',
                            boxShadow: '0 0 12px rgba(255,107,26,0.3)',
                        }}
                    >
                        Iniciar
                    </button>
                </div>
            </div>
        )
    }

    // ── Render: ayuno activo ──────────────────────────────────────────────
    const endTime = new Date(fasting.startedAt + goalMs)

    return (
        <div className="card p-4 mb-3 animate-fade-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{isComplete ? '🎉' : '⏱️'}</span>
                    <div>
                        <h3 className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest">
                            Ayuno {fasting.hours}:{24 - fasting.hours}
                        </h3>
                        <p className="text-[9px] text-[#8E8EA0]">
                            Inicio: {fasting.startLabel} · Fin: {formatTime(endTime)}
                        </p>
                    </div>
                </div>
                <button onClick={stopFasting}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-[#8E8EA0]
                               border border-[#2E2E3A] hover:text-red-400 hover:border-red-500/30 transition-all">
                    Finalizar
                </button>
            </div>

            {/* Anillo + timer central */}
            <div className="flex flex-col items-center py-2">
                <div className="relative" style={{ width: SIZE, height: SIZE }}>
                    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                        {/* Track */}
                        <circle cx={CTR} cy={CTR} r={R}
                            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
                        {/* Progreso */}
                        <circle cx={CTR} cy={CTR} r={R}
                            fill="none"
                            stroke={ringColor}
                            strokeWidth={10}
                            strokeLinecap="round"
                            strokeDasharray={CIRCUM}
                            strokeDashoffset={offset}
                            className="progress-ring"
                            style={{
                                filter: `drop-shadow(0 0 8px ${glowColor})`,
                                transform: 'rotate(-90deg)',
                                transformOrigin: '50% 50%',
                            }}
                        />
                    </svg>

                    {/* Contenido central */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {isComplete ? (
                            <>
                                <span className="text-[9px] font-black text-[#8E8EA0] uppercase tracking-widest">
                                    Completado
                                </span>
                                <span className="text-3xl font-black num leading-none mt-1"
                                    style={{ color: '#30D158', textShadow: '0 0 20px rgba(48,209,88,0.5)' }}>
                                    ✓
                                </span>
                                {exceeded > 0 && (
                                    <span className="text-xs text-[#30D158] font-bold num mt-1">
                                        +{formatDuration(exceeded)}
                                    </span>
                                )}
                            </>
                        ) : (
                            <>
                                <span className="text-[9px] font-black text-[#8E8EA0] uppercase tracking-widest">
                                    Falta
                                </span>
                                <span className="text-2xl font-black num leading-none mt-1"
                                    style={{ color: '#FF9F0A', textShadow: '0 0 20px rgba(255,159,10,0.4)' }}>
                                    {formatDuration(remaining)}
                                </span>
                                <span className="text-[10px] text-[#8E8EA0] mt-1 num">
                                    {Math.round(pct * 100)}%
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Barra de progreso lineal + info */}
            <div className="mt-1">
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all duration-1000"
                        style={{
                            width: `${pct * 100}%`,
                            background: `linear-gradient(90deg, #FF6B1A, ${ringColor})`,
                            boxShadow: `0 0 8px ${glowColor}`,
                        }}
                    />
                </div>
                <div className="flex justify-between text-[9px] text-[#8E8EA0] font-semibold">
                    <span>Transcurrido: <span className="num text-white">{formatDuration(elapsed)}</span></span>
                    <span>Meta: <span className="num text-white">{fasting.hours}h</span></span>
                </div>
            </div>

            {/* Mensaje motivacional */}
            <p className="text-center text-[10px] mt-3 font-semibold"
                style={{ color: isComplete ? '#30D158' : '#8E8EA0' }}>
                {isComplete
                    ? '¡Felicidades! Has completado tu ayuno 🎉'
                    : pct > 0.75
                        ? '¡Ya casi! Mantente fuerte 💪'
                        : pct > 0.5
                            ? 'Más de la mitad, ¡sigue así! 🔥'
                            : 'Tu cuerpo está entrando en cetosis 🧘'}
            </p>
        </div>
    )
}
