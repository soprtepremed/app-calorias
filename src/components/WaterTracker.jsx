/**
 * WaterTracker.jsx — Componente de hidratación premium.
 *
 * Diseño:
 * - Un solo vaso SVG grande al centro con agua animada
 * - Progreso en LITROS (meta configurable, default 3L = 12 vasos)
 * - Botones rápidos: +250ml (vaso), +500ml (botella), +1L
 * - Input para cantidad personalizada
 * - Animaciones CSS suaves: agua sube, onda, burbujas, pulso
 *
 * Props:
 *   glasses  — número de vasos actuales (cada vaso = 250ml)
 *   goal     — meta en vasos (ej: 12 = 3L)
 *   onChange — callback(nuevoValorDeVasos)
 */
import { useState, useRef } from 'react'

// ── Íconos SVG inline (estilo lineal, consistente con el design system) ─
const DropIcon = ({ size = 15, style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
)

/** Vaso pequeño — 250ml */
const GlassIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2h8l-1.5 16a2 2 0 0 1-2 1.8h-1a2 2 0 0 1-2-1.8L8 2z" />
        <path d="M9.5 10h5" opacity="0.5" />
    </svg>
)

/** Botella — 500ml */
const BottleIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2h4v3l2 2v13a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7l2-2V2z" />
        <path d="M10 12h4" opacity="0.5" />
    </svg>
)

/** Jarra — 1L */
const JugIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h10l-1 17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 3z" />
        <path d="M16 7h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1.5" />
        <path d="M8.5 9h5" opacity="0.5" />
    </svg>
)

/** Lápiz / editar — cantidad personalizada */
const EditIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
)

/** Check con destello — meta alcanzada */
const GoalCheckIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
        <path d="M18 2l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#30D158" stroke="none" opacity="0.6" />
    </svg>
)

const ML_PER_GLASS = 250

// Opciones rápidas de cantidad — ahora con componentes SVG
const QUICK_AMOUNTS = [
    { ml: 250, label: '250ml', Icon: GlassIcon },
    { ml: 500, label: '500ml', Icon: BottleIcon },
    { ml: 1000, label: '1 L', Icon: JugIcon },
]

export default function WaterTracker({ glasses, goal, onChange }) {
    const glassRef = useRef(null)
    const [animating, setAnimating] = useState(false)
    const [showCustom, setShowCustom] = useState(false)
    const [customMl, setCustomMl] = useState('')

    // ── Cálculos en litros ──────────────────────────────────────────────
    const totalMl = glasses * ML_PER_GLASS
    const goalMl = goal * ML_PER_GLASS
    const litersConsumed = (totalMl / 1000).toFixed(1)
    const litersGoal = (goalMl / 1000).toFixed(1)
    const litersRemaining = Math.max(0, (goalMl - totalMl) / 1000).toFixed(1)

    const pct = goal > 0 ? Math.min(glasses / goal, 1) : 0
    const color = pct >= 1 ? '#30D158' : pct >= 0.5 ? '#5AC8FA' : '#FF9F0A'

    // Altura del agua en el vaso SVG (y va de 88 vacío a 15 lleno)
    const waterY = 88 - (pct * 73)

    // ── Agregar agua con animación ──────────────────────────────────────
    const addWater = (ml) => {
        if (animating) return
        const glassesToAdd = Math.round(ml / ML_PER_GLASS * 100) / 100
        // Convertimos ml a vasos redondeando a enteros
        const newGlasses = Math.min(glasses + Math.max(1, Math.round(ml / ML_PER_GLASS)), goal * 2)

        setAnimating(true)

        // Disparar animación CSS del vaso
        const el = glassRef.current
        if (el) {
            el.classList.remove('water-pulse')
            void el.offsetWidth
            el.classList.add('water-pulse')
        }

        onChange(newGlasses)
        setTimeout(() => setAnimating(false), 600)
    }

    const removeWater = () => {
        if (glasses <= 0) return
        onChange(Math.max(0, glasses - 1))
    }

    const handleCustomSubmit = () => {
        const ml = parseInt(customMl, 10)
        if (ml > 0) {
            addWater(ml)
            setCustomMl('')
            setShowCustom(false)
        }
    }

    return (
        <div className="card p-4 mb-3">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <DropIcon size={15} style={{ color: '#5AC8FA' }} />
                    <span className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest">
                        Hidratación
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-lg font-black num transition-all" style={{ color }}>
                        {litersConsumed}
                    </span>
                    <span className="text-[10px] text-[#8E8EA0] font-semibold">
                        / {litersGoal} L
                    </span>
                    {pct >= 1 && <span className="animate-bounce inline-flex"><GoalCheckIcon /></span>}
                </div>
            </div>

            {/* ── Barra de progreso ───────────────────────────────────── */}
            <div className="h-1.5 rounded-full bg-white/5 mb-4 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                        width: `${Math.min(100, pct * 100)}%`,
                        background: `linear-gradient(90deg, #1A8FBF, ${color})`,
                        boxShadow: `0 0 8px ${color}40`
                    }}
                />
            </div>

            {/* ── Vaso SVG grande central ─────────────────────────────── */}
            <div className="flex justify-center mb-3">
                <button
                    ref={glassRef}
                    onClick={() => addWater(250)}
                    className="relative"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    aria-label="Agregar un vaso de agua"
                >
                    <svg viewBox="0 0 80 100" style={{ width: 110, height: 138 }}>
                        <defs>
                            {/* Gradiente del agua */}
                            <linearGradient id="wt-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#7FD8F5" stopOpacity="0.95" />
                                <stop offset="60%" stopColor="#3BA3D9" stopOpacity="0.9" />
                                <stop offset="100%" stopColor="#1A6F9F" stopOpacity="0.98" />
                            </linearGradient>
                            {/* Clip del interior del vaso */}
                            <clipPath id="wt-clip">
                                <path d="M15 12 L19 85 C19 88 22 90 25 90 L55 90 C58 90 61 88 61 85 L65 12 Z" />
                            </clipPath>
                            {/* Reflejo lateral */}
                            <linearGradient id="wt-shine" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="white" stopOpacity="0.15" />
                                <stop offset="100%" stopColor="white" stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        {/* Contorno del vaso */}
                        <path
                            d="M12 8 L17 86 C17 90 21 93 25 93 L55 93 C59 93 63 90 63 86 L68 8 Z"
                            fill="none"
                            stroke={pct >= 1 ? '#30D158' : 'rgba(90,200,250,0.5)'}
                            strokeWidth="2"
                            strokeLinejoin="round"
                        />

                        {/* Agua animada */}
                        <rect
                            className="water-fill-rect"
                            x="12" y={waterY}
                            width="56" height={100 - waterY}
                            fill="url(#wt-grad)"
                            clipPath="url(#wt-clip)"
                        />

                        {/* Onda del nivel */}
                        {pct > 0 && pct < 1 && (
                            <path
                                className="water-wave-anim"
                                d={`M15 ${waterY + 1} Q28 ${waterY - 3} 40 ${waterY + 1} Q52 ${waterY + 5} 65 ${waterY + 1}`}
                                fill="none"
                                stroke="rgba(255,255,255,0.35)"
                                strokeWidth="1.2"
                                clipPath="url(#wt-clip)"
                            />
                        )}

                        {/* Brillo lateral */}
                        <rect x="18" y="15" width="7" height="70" rx="3.5"
                            fill="url(#wt-shine)" clipPath="url(#wt-clip)" />

                        {/* Burbujas al agregar */}
                        {animating && (
                            <>
                                <circle className="water-bubble-up" cx="35" cy={waterY + 15} r="1.5"
                                    fill="rgba(255,255,255,0.5)" />
                                <circle className="water-bubble-up-delayed" cx="48" cy={waterY + 25} r="1"
                                    fill="rgba(255,255,255,0.4)" />
                                <circle className="water-bubble-up" cx="42" cy={waterY + 8} r="2"
                                    fill="rgba(255,255,255,0.35)" />
                            </>
                        )}

                        {/* Indicador central "tap" */}
                        {pct < 1 && (
                            <text x="40" y="58" textAnchor="middle" fill="white"
                                fontSize="7" fontWeight="600" opacity="0.5">
                                TAP +250ml
                            </text>
                        )}

                        {/* Check SVG cuando está lleno */}
                        {pct >= 1 && (
                            <g transform="translate(28, 42)">
                                <path d="M2 12 L9 19 L22 4" fill="none" stroke="#30D158"
                                    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </g>
                        )}
                    </svg>
                </button>
            </div>

            {/* ── Botones de cantidad rápida ──────────────────────────── */}
            <div className="flex gap-2 mb-3">
                {QUICK_AMOUNTS.map(({ ml, label, Icon }) => (
                    <button
                        key={ml}
                        onClick={() => addWater(ml)}
                        className="flex-1 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all active:scale-95"
                        style={{
                            background: 'rgba(90,200,250,0.08)',
                            border: '1px solid rgba(90,200,250,0.15)',
                            color: '#5AC8FA',
                            fontSize: 11,
                            fontWeight: 700,
                        }}
                    >
                        <Icon size={20} />
                        <span>+{label}</span>
                    </button>
                ))}

                {/* Botón personalizado */}
                <button
                    onClick={() => setShowCustom(!showCustom)}
                    className="flex-1 py-2.5 rounded-xl flex flex-col items-center gap-0 transition-all active:scale-95"
                    style={{
                        background: showCustom ? 'rgba(255,159,10,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${showCustom ? 'rgba(255,159,10,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        color: showCustom ? '#FF9F0A' : '#8E8EA0',
                        fontSize: 11,
                        fontWeight: 700,
                    }}
                >
                    <EditIcon size={20} />
                    <span style={{ marginTop: 4 }}>Otro</span>
                </button>
            </div>

            {/* ── Input personalizado (expandible) ────────────────────── */}
            {showCustom && (
                <div className="flex gap-2 mb-3 animate-fade-up">
                    <input
                        type="number"
                        inputMode="numeric"
                        placeholder="ml"
                        value={customMl}
                        onChange={(e) => setCustomMl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                        className="flex-1 px-3 py-2 rounded-xl text-sm text-white num"
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,159,10,0.25)',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleCustomSubmit}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                        style={{
                            background: 'linear-gradient(135deg, #FF9F0A, #FF6B1A)',
                            color: 'white',
                        }}
                    >
                        + Agregar
                    </button>
                </div>
            )}

            {/* ── Botón restar ────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <button
                    onClick={removeWater}
                    disabled={glasses <= 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={{
                        background: glasses > 0 ? 'rgba(255,55,95,0.1)' : 'transparent',
                        color: glasses > 0 ? '#FF375F' : '#3A3A44',
                        border: `1px solid ${glasses > 0 ? 'rgba(255,55,95,0.2)' : 'transparent'}`,
                    }}
                >
                    − Quitar vaso
                </button>

                {/* Info de vasos */}
                <span className="text-[10px] text-[#8E8EA0] num">
                    {glasses} vaso{glasses !== 1 ? 's' : ''} · {totalMl} ml
                </span>
            </div>

            {/* ── Mensaje motivacional ─────────────────────────────────── */}
            <p className="text-center text-[11px] mt-3 font-semibold"
                style={{ color: pct >= 1 ? '#30D158' : '#8E8EA0' }}>
                {pct >= 1
                    ? <span className="inline-flex items-center gap-1">¡Meta de hidratación alcanzada! <GoalCheckIcon size={12} /></span>
                    : `Te faltan ${litersRemaining} L para tu meta`}
            </p>
        </div>
    )
}
