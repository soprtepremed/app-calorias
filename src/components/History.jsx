import { useEffect, useState } from 'react'
import { getCalorieHistory, getActivityLog, todayStr } from '../services/supabase'
import { Card, EmptyState, SectionTitle, Spinner, ProgressBar } from './UI'
import { ChartIcon, FlameIcon, DropIcon, ScaleIcon } from './Icons'

/** Formatea fecha completa en español (usa fecha local) */
function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00')
    // Comparar con fecha LOCAL, no UTC
    const now = new Date()
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayLocal = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

    if (dateStr === todayLocal) return 'Hoy'
    if (dateStr === yesterdayLocal) return 'Ayer'
    return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Formatea hora "5:03 PM" */
function fmtTime(isoStr) {
    const d = new Date(isoStr)
    return d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/** Config de cada tipo de evento para el timeline */
const EVENT_CONFIG = {
    water: {
        icon: '💧',
        color: '#5AC8FA',
        bg: 'rgba(90,200,250,0.12)',
        label: (m) => `Vaso #${m.glass_number ?? '?'} de agua`,
        sub: (m) => m.total_ml ? `${m.total_ml}ml acumulados` : null,
    },
    food_add: {
        icon: '🍽️',
        color: '#FF6B1A',
        bg: 'rgba(255,107,26,0.12)',
        label: (m) => m.food_name ?? 'Alimento registrado',
        sub: (m) => m.calories ? `${Math.round(m.calories)} kcal · ${m.meal_type ?? ''}` : null,
    },
    fasting_start: {
        icon: '⏱️',
        color: '#FF9F0A',
        bg: 'rgba(255,159,10,0.12)',
        label: (m) => `Ayuno ${m.protocol ?? ''} iniciado`,
        sub: (m) => m.hours ? `Meta: ${m.hours} horas` : null,
    },
    fasting_end: {
        icon: '✅',
        color: '#30D158',
        bg: 'rgba(48,209,88,0.12)',
        label: (m) => m.completed ? 'Ayuno completado' : 'Ayuno finalizado',
        sub: (m) => m.hours_actual ? `Duración: ${m.hours_actual}h de ${m.hours_goal}h` : null,
    },
    weight: {
        icon: '⚖️',
        color: '#30D158',
        bg: 'rgba(48,209,88,0.12)',
        label: (m) => `Peso registrado: ${m.weight_kg} kg`,
        sub: (m) => m.notes || null,
    },
    food_delete: {
        icon: '🗑️',
        color: '#FF375F',
        bg: 'rgba(255,55,95,0.10)',
        label: (m) => `${m.food_name ?? 'Alimento'} eliminado`,
        sub: (m) => m.calories ? `−${Math.round(m.calories)} kcal` : null,
    },
}

/**
 * History.jsx — Timeline completa de actividad
 * Muestra eventos individuales: cada vaso de agua, comida, ayuno, peso
 * Agrupados por día, con hora exacta de cada evento
 */
export default function History({ config }) {
    const [summary, setSummary] = useState([])
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState('timeline') // 'timeline' | 'summary'
    const [visibleCount, setVisibleCount] = useState(50) // Paginación: eventos visibles

    useEffect(() => {
        Promise.all([
            getCalorieHistory(15),
            getActivityLog(15),
        ])
            .then(([s, e]) => { setSummary(s); setEvents(e) })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const goal = config?.calorie_goal ?? 2000
    const waterGoal = config?.water_goal ?? 8

    // Agrupar eventos por fecha
    const grouped = {}
    for (const ev of events) {
        const date = ev.log_date
        if (!grouped[date]) grouped[date] = []
        grouped[date].push(ev)
    }
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

    // Stats
    const foodDays = summary.filter(d => d.total_items > 0)
    const avg = foodDays.length
        ? Math.round(foodDays.reduce((s, d) => s + Number(d.total_calories ?? 0), 0) / foodDays.length)
        : 0

    if (loading) {
        return <div className="flex justify-center h-48 items-center"><Spinner /></div>
    }

    return (
        <div className="animate-fade-up">
            {/* Tabs */}
            <div className="flex gap-1 bg-[#1C1D27] rounded-xl p-1 mb-4">
                {[
                    { id: 'timeline', label: '📋 Timeline' },
                    { id: 'summary', label: '📊 Resumen' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setView(tab.id)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${view === tab.id
                            ? 'bg-[#FF6B1A] text-white shadow-lg'
                            : 'text-[#8E8EA0] hover:text-white'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══ VISTA TIMELINE ═══ */}
            {view === 'timeline' && (
                <Card>
                    <SectionTitle>Actividad reciente</SectionTitle>

                    {sortedDates.length === 0 ? (
                        <EmptyState icon={ChartIcon} text="Sin actividad registrada aún. Toma agua, registra alimentos o inicia un ayuno para ver tu historial." />
                    ) : (() => {
                        // Paginación: contar eventos acumulados y cortar
                        let totalRendered = 0
                        const hasMore = events.length > visibleCount

                        return (
                            <div className="space-y-5">
                                {sortedDates.map(date => {
                                    const dayEvents = grouped[date]
                                    // Si ya pasamos el límite, no renderizar este día
                                    if (totalRendered >= visibleCount) return null
                                    const eventsToShow = dayEvents.slice(0, visibleCount - totalRendered)
                                    totalRendered += eventsToShow.length

                                    return (
                                        <div key={date}>
                                            {/* Header del día */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-[#FF6B1A]" />
                                                <span className="text-sm font-bold text-white capitalize">
                                                    {fmtDate(date)}
                                                </span>
                                                <span className="text-[10px] text-[#7B7D94] ml-auto">
                                                    {dayEvents.length} evento{dayEvents.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>

                                            {/* Eventos del día */}
                                            <div className="ml-3 border-l-2 border-[#2A2B38] pl-4 space-y-2">
                                                {eventsToShow.map(ev => {
                                                    const cfg = EVENT_CONFIG[ev.type] ?? {
                                                        icon: '📝', color: '#8E8EA0', bg: 'rgba(142,142,160,0.1)',
                                                        label: () => ev.type, sub: () => null,
                                                    }
                                                    const meta = ev.metadata ?? {}
                                                    return (
                                                        <div key={ev.id}
                                                            className="flex items-start gap-3 p-2.5 rounded-xl transition-all hover:scale-[1.01]"
                                                            style={{ background: cfg.bg }}
                                                        >
                                                            {/* Icono */}
                                                            <span className="text-base mt-0.5">{cfg.icon}</span>

                                                            {/* Contenido */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold text-white truncate">
                                                                    {cfg.label(meta)}
                                                                </p>
                                                                {cfg.sub(meta) && (
                                                                    <p className="text-[10px] mt-0.5" style={{ color: cfg.color }}>
                                                                        {cfg.sub(meta)}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Hora */}
                                                            <span className="text-[10px] text-[#7B7D94] font-semibold whitespace-nowrap mt-0.5">
                                                                {fmtTime(ev.log_time)}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}

                                {/* Botón cargar más */}
                                {hasMore && (
                                    <button
                                        onClick={() => setVisibleCount(c => c + 50)}
                                        className="w-full py-2.5 rounded-xl bg-[#1C1D27] border border-[#2A2B38]
                                                   text-xs font-bold text-[#FF6B1A] hover:bg-[#252530] transition-all"
                                    >
                                        Cargar más ({events.length - visibleCount} restantes)
                                    </button>
                                )}
                            </div>
                        )
                    })()}
                </Card>
            )}

            {/* ═══ VISTA RESUMEN ═══ */}
            {view === 'summary' && (
                <>
                    {/* Stats cards */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {[
                            { label: 'Prom. kcal', value: avg.toLocaleString(), sub: 'kcal/día', color: '#FF6B1A' },
                            { label: 'Días activos', value: summary.length, sub: 'últimos 15', color: '#30D158' },
                            {
                                label: 'Balance',
                                value: avg <= goal ? 'Déficit' : 'Exceso',
                                sub: `${Math.abs(avg - goal)} kcal`,
                                color: avg <= goal ? '#30D158' : '#FF453A',
                            },
                        ].map(s => (
                            <Card key={s.label} className="text-center !p-3">
                                <div className="text-lg font-black leading-none" style={{ color: s.color }}>
                                    {s.value}
                                </div>
                                <div className="text-[9px] font-bold text-[#7B7D94] uppercase tracking-widest mt-1">
                                    {s.label}
                                </div>
                                <div className="text-[10px] text-[#7B7D94] mt-0.5">{s.sub}</div>
                            </Card>
                        ))}
                    </div>

                    {/* Lista por día */}
                    <Card>
                        <SectionTitle>Resumen diario</SectionTitle>
                        {summary.length === 0 ? (
                            <EmptyState icon={ChartIcon} text="Sin datos aún." />
                        ) : (
                            <div className="space-y-4">
                                {summary.map(day => {
                                    const kcal = Math.round(Number(day.total_calories ?? 0))
                                    const pct = kcal / Math.max(goal, 1)
                                    const over = pct > 1
                                    const good = pct <= 0.85
                                    const glasses = day.glasses ?? 0
                                    const hasFood = day.total_items > 0
                                    const hasWater = glasses > 0
                                    const hasWeight = day.weight_kg != null

                                    return (
                                        <div key={day.log_date} className="pb-3 border-b border-[#1E1E28] last:border-0 last:pb-0">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-bold text-white capitalize">
                                                    {fmtDate(day.log_date)}
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                {hasFood && (
                                                    <div className="bg-[#252530] rounded-xl p-3">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span>🔥</span>
                                                            <span className="text-xs font-bold text-white">Alimentación</span>
                                                            <span className={`ml-auto text-xs font-black ${over ? 'text-red-400' : good ? 'text-[#30D158]' : 'text-[#FF9F0A]'}`}>
                                                                {kcal.toLocaleString()} kcal
                                                            </span>
                                                        </div>
                                                        <ProgressBar value={kcal} max={goal} />
                                                        <div className="flex gap-3 mt-1.5">
                                                            {[
                                                                { label: 'P', value: day.total_protein, color: '#3B82F6' },
                                                                { label: 'C', value: day.total_carbs, color: '#F97316' },
                                                                { label: 'G', value: day.total_fat, color: '#A855F7' },
                                                            ].map(m => (
                                                                <span key={m.label} className="text-[10px] font-semibold" style={{ color: m.color }}>
                                                                    {m.label}:{Math.round(Number(m.value ?? 0))}g
                                                                </span>
                                                            ))}
                                                            <span className="text-[10px] text-[#7B7D94] ml-auto">
                                                                {day.total_items} alimento{day.total_items !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {hasWater && (
                                                    <div className="bg-[#252530] rounded-xl p-3 flex items-center gap-3">
                                                        <span>💧</span>
                                                        <span className="text-xs font-bold text-white">Hidratación</span>
                                                        <span className={`ml-auto text-xs font-black ${glasses >= waterGoal ? 'text-[#30D158]' : 'text-[#5AC8FA]'}`}>
                                                            {glasses}/{waterGoal} vasos
                                                        </span>
                                                    </div>
                                                )}

                                                {hasWeight && (
                                                    <div className="bg-[#252530] rounded-xl p-3 flex items-center gap-3">
                                                        <span>⚖️</span>
                                                        <span className="text-xs font-bold text-white">Peso</span>
                                                        <span className="ml-auto text-xs font-black text-[#30D158]">
                                                            {day.weight_kg} kg
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </Card>
                </>
            )}
        </div>
    )
}
