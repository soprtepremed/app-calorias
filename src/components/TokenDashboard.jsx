/**
 * TokenDashboard.jsx — Panel de monitoreo de consumo de tokens IA
 * 
 * Acceso restringido: solo el admin (PIN 1702) puede verlo.
 * Muestra estadísticas de uso de la API de Gemini:
 * - Costo total en USD y MXN
 * - Total de llamadas y tokens
 * - Desglose por tipo de función (foto, scan, texto, onboarding)
 * - Desglose por modelo
 * - Historial por día
 */

import { useState, useEffect } from 'react'
import { getTokenStats } from '../services/tokenLogger'

// ── Constantes ──────────────────────────────────────────────────────────────
const ADMIN_PIN = '1702'
const MXN_RATE = 17.15  // Tipo de cambio USD→MXN aproximado

/** Labels amigables para cada tipo de función */
const FUNCTION_LABELS = {
    photo: { label: 'Análisis de Foto', emoji: '📷', color: '#FF375F' },
    scan: { label: 'Scanner Cámara', emoji: '🎥', color: '#FF6B1A' },
    text: { label: 'Búsqueda Texto', emoji: '✏️', color: '#34D399' },
    onboarding: { label: 'Onboarding IA', emoji: '🤖', color: '#818CF8' },
}

// ═══════════════════════════════════════════════════════════════════════════
// PIN GATE — Pantalla de acceso con PIN
// ═══════════════════════════════════════════════════════════════════════════

function PinGate({ onUnlock }) {
    const [pin, setPin] = useState('')
    const [error, setError] = useState(false)
    const [shake, setShake] = useState(false)

    const handleSubmit = (e) => {
        e?.preventDefault()
        if (pin === ADMIN_PIN) {
            onUnlock()
        } else {
            setError(true)
            setShake(true)
            setTimeout(() => setShake(false), 500)
            setTimeout(() => { setPin(''); setError(false) }, 1500)
        }
    }

    /** Teclado numérico visual */
    const handleKey = (digit) => {
        if (pin.length >= 4) return
        const next = pin + digit
        setPin(next)
        if (next.length === 4) {
            setTimeout(() => {
                if (next === ADMIN_PIN) onUnlock()
                else {
                    setError(true)
                    setShake(true)
                    setTimeout(() => setShake(false), 500)
                    setTimeout(() => { setPin(''); setError(false) }, 1500)
                }
            }, 200)
        }
    }

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: '60vh', gap: 32,
        }}>
            {/* Ícono */}
            <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #818CF8, #6366F1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 30px rgba(129,140,248,0.3)',
            }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
            </div>

            <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>
                    Panel de Administración
                </h2>
                <p style={{ fontSize: 13, color: '#8E8EA0', marginTop: 6 }}>
                    Ingresa tu PIN de acceso
                </p>
            </div>

            {/* Indicador de dígitos */}
            <div style={{
                display: 'flex', gap: 12,
                animation: shake ? 'shake 0.5s ease-in-out' : 'none',
            }}>
                {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: i < pin.length
                            ? (error ? '#EF4444' : '#818CF8')
                            : '#1E1E2E',
                        border: `2px solid ${error ? '#EF4444' : i < pin.length ? '#818CF8' : '#2E2E3A'}`,
                        transition: 'all 0.2s',
                    }} />
                ))}
            </div>

            {/* Teclado numérico */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12, maxWidth: 240,
            }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((d, i) => {
                    if (d === null) return <div key={i} />
                    return (
                        <button key={i} onClick={() => {
                            if (d === 'del') setPin(p => p.slice(0, -1))
                            else handleKey(String(d))
                        }}
                            style={{
                                width: 64, height: 64, borderRadius: 16,
                                background: d === 'del' ? 'transparent' : '#1A1A24',
                                border: d === 'del' ? 'none' : '1px solid #2A2A3A',
                                color: '#fff', fontSize: d === 'del' ? 14 : 22,
                                fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                            }}
                            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                            onTouchStart={e => e.currentTarget.style.transform = 'scale(0.92)'}
                            onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            {d === 'del' ? '⌫' : d}
                        </button>
                    )
                })}
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-8px); }
                    40%, 80% { transform: translateX(8px); }
                }
            `}</style>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// STAT CARD — Tarjeta de estadística individual
// ═══════════════════════════════════════════════════════════════════════════

function StatCard({ icon, label, value, sub, color = '#818CF8' }) {
    return (
        <div style={{
            background: '#12121A', border: '1px solid #1E1E2E', borderRadius: 16,
            padding: '16px 18px', flex: '1 1 140px', minWidth: 140,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#8E8EA0' }}>{icon} {label}</span>
            </div>
            <div style={{
                fontSize: 22, fontWeight: 800, color,
                fontFamily: "'Inter', system-ui, sans-serif",
            }}>
                {value}
            </div>
            {sub && (
                <div style={{ fontSize: 11, color: '#555570', marginTop: 4 }}>
                    {sub}
                </div>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// BAR ROW — Fila con barra de progreso para desglose
// ═══════════════════════════════════════════════════════════════════════════

function BarRow({ label, emoji, count, cost, total, maxTotal, color }) {
    const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0

    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 4,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#E0E0EC' }}>{label}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>
                        ${cost.toFixed(4)}
                    </span>
                    <span style={{ fontSize: 11, color: '#555570', marginLeft: 6 }}>
                        | ${(cost * MXN_RATE).toFixed(2)} MXN
                    </span>
                </div>
            </div>
            <div style={{ fontSize: 10, color: '#555570', marginBottom: 4 }}>
                {count} llamada{count !== 1 ? 's' : ''}
            </div>
            <div style={{
                height: 6, borderRadius: 3, background: '#1A1A24',
                overflow: 'hidden',
            }}>
                <div style={{
                    width: `${Math.max(pct, 2)}%`, height: '100%',
                    borderRadius: 3, background: color,
                    transition: 'width 0.6s ease',
                }} />
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

function DashboardContent() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [days, setDays] = useState(30)

    useEffect(() => {
        setLoading(true)
        getTokenStats(days).then(data => {
            setStats(data)
            setLoading(false)
        })
    }, [days])

    if (loading) {
        return (
            <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                minHeight: '40vh', color: '#8E8EA0',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: 40, height: 40, border: '3px solid #2A2A3A',
                        borderTopColor: '#818CF8', borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
                    }} />
                    Cargando estadísticas...
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
            </div>
        )
    }

    if (!stats || stats.totalCalls === 0) {
        return (
            <div style={{
                textAlign: 'center', padding: 40, color: '#8E8EA0',
            }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
                <h3 style={{ color: '#E0E0EC', fontWeight: 700 }}>Sin datos todavía</h3>
                <p style={{ fontSize: 13 }}>
                    Los tokens se registrarán automáticamente cuando uses funciones de IA
                    (fotos, scanner, búsqueda de alimentos).
                </p>
            </div>
        )
    }

    const { totalCalls, totalInput, totalOutput, totalTokens, totalCost, byFunction, byModel, byDay } = stats
    const maxFuncTotal = Math.max(...Object.values(byFunction).map(f => f.total), 1)

    // Ordenar días para la tabla
    const sortedDays = Object.entries(byDay)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 10)

    return (
        <div style={{ paddingBottom: 20 }}>
            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 20,
            }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
                        🤖 Consumo de Tokens IA
                    </h2>
                    <p style={{ fontSize: 12, color: '#8E8EA0', marginTop: 4 }}>
                        Gemini • gemini-2.5-flash / 2.0-flash-lite
                    </p>
                </div>
                {/* Selector de período */}
                <select value={days} onChange={e => setDays(Number(e.target.value))}
                    style={{
                        background: '#1A1A24', border: '1px solid #2E2E3A',
                        borderRadius: 10, padding: '6px 10px', color: '#E0E0EC',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>
                    <option value={7}>7 días</option>
                    <option value={15}>15 días</option>
                    <option value={30}>30 días</option>
                    <option value={90}>90 días</option>
                </select>
            </div>

            {/* Cards principales */}
            <div style={{
                display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20,
            }}>
                <StatCard
                    icon="💰" label="Total USD"
                    value={'$' + totalCost.toFixed(4)}
                    sub={`≈ $${(totalCost * MXN_RATE).toFixed(2)} MXN`}
                    color="#34D399"
                />
                <StatCard
                    icon="📞" label="Llamadas IA"
                    value={totalCalls.toLocaleString()}
                    sub={`${(totalCalls / days).toFixed(1)}/día promedio`}
                    color="#818CF8"
                />
                <StatCard
                    icon="🪙" label="Total Tokens"
                    value={totalTokens.toLocaleString()}
                    sub={`In: ${totalInput.toLocaleString()} • Out: ${totalOutput.toLocaleString()}`}
                    color="#FF6B1A"
                />
            </div>

            {/* Desglose por función */}
            <div style={{
                background: '#12121A', border: '1px solid #1E1E2E',
                borderRadius: 16, padding: 20, marginBottom: 16,
            }}>
                <h3 style={{
                    fontSize: 14, fontWeight: 700, color: '#E0E0EC',
                    marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    📊 Por Tipo de Función
                </h3>
                {Object.entries(byFunction)
                    .sort(([, a], [, b]) => b.cost - a.cost)
                    .map(([type, data]) => {
                        const meta = FUNCTION_LABELS[type] || { label: type, emoji: '❓', color: '#888' }
                        return (
                            <BarRow key={type}
                                label={meta.label} emoji={meta.emoji}
                                count={data.count} cost={data.cost}
                                total={data.total} maxTotal={maxFuncTotal}
                                color={meta.color}
                            />
                        )
                    })}
            </div>

            {/* Desglose por modelo */}
            <div style={{
                background: '#12121A', border: '1px solid #1E1E2E',
                borderRadius: 16, padding: 20, marginBottom: 16,
            }}>
                <h3 style={{
                    fontSize: 14, fontWeight: 700, color: '#E0E0EC',
                    marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    🧠 Por Modelo
                </h3>
                {Object.entries(byModel).map(([model, data]) => (
                    <div key={model} style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', padding: '10px 0',
                        borderBottom: '1px solid #1A1A24',
                    }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#E0E0EC' }}>
                                {model}
                            </div>
                            <div style={{ fontSize: 11, color: '#555570', marginTop: 2 }}>
                                {data.count} llamadas • {data.total.toLocaleString()} tokens
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#34D399' }}>
                                ${data.cost.toFixed(4)}
                            </div>
                            <div style={{ fontSize: 11, color: '#555570' }}>
                                ${(data.cost * MXN_RATE).toFixed(2)} MXN
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Historial por día */}
            {sortedDays.length > 0 && (
                <div style={{
                    background: '#12121A', border: '1px solid #1E1E2E',
                    borderRadius: 16, padding: 20, marginBottom: 16,
                }}>
                    <h3 style={{
                        fontSize: 14, fontWeight: 700, color: '#E0E0EC',
                        marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        📅 Por Día
                    </h3>
                    {sortedDays.map(([day, data]) => (
                        <div key={day} style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', padding: '8px 0',
                            borderBottom: '1px solid #1A1A24',
                        }}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#E0E0EC' }}>
                                    {new Date(day + 'T12:00:00').toLocaleDateString('es-MX', {
                                        weekday: 'short', day: 'numeric', month: 'short'
                                    })}
                                </div>
                                <div style={{ fontSize: 11, color: '#555570' }}>
                                    {data.count} llamadas • {data.total.toLocaleString()} tokens
                                </div>
                            </div>
                            <div style={{
                                fontSize: 14, fontWeight: 700, color: '#818CF8',
                            }}>
                                ${data.cost.toFixed(4)}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer con precios */}
            <div style={{
                background: '#0D0D15', border: '1px solid #1A1A24',
                borderRadius: 12, padding: '12px 16px', marginTop: 8,
            }}>
                <div style={{ fontSize: 11, color: '#555570', fontWeight: 600, marginBottom: 6 }}>
                    Precios Gemini (Feb 2026)
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: '#8E8EA0' }}>
                    <span>
                        <b style={{ color: '#FF375F' }}>gemini-2.5-flash</b>
                        {' '}In: $0.15/1M • Out: $0.60/1M
                    </span>
                    <span>
                        <b style={{ color: '#FF6B1A' }}>gemini-2.0-flash-lite</b>
                        {' '}In: $0.075/1M • Out: $0.30/1M
                    </span>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT — Componente principal con PIN gate
// ═══════════════════════════════════════════════════════════════════════════

export default function TokenDashboard() {
    const [unlocked, setUnlocked] = useState(false)

    if (!unlocked) {
        return <PinGate onUnlock={() => setUnlocked(true)} />
    }

    return <DashboardContent />
}
