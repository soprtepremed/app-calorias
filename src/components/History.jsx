import { useEffect, useState } from 'react'
import { getCalorieHistory } from '../services/supabase'
import { Card, EmptyState, SectionTitle, Spinner, ProgressBar } from './UI'
import { ChartIcon, FlameIcon } from './Icons'

/** Formatea fecha en español */
function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function History({ config }) {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getCalorieHistory(14)
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const goal = config?.calorie_goal ?? 2000

    // Promedio semanal
    const avg = data.length
        ? Math.round(data.reduce((s, d) => s + Number(d.total_calories ?? 0), 0) / data.length)
        : 0

    if (loading) {
        return <div className="flex justify-center h-48 items-center"><Spinner /></div>
    }

    return (
        <div className="animate-fade-up">

            {/* Resumen stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                    { label: 'Promedio', value: `${avg.toLocaleString()}`, sub: 'kcal/día' },
                    { label: 'Días', value: data.length, sub: 'registrados' },
                    { label: 'Balance', value: avg < goal ? 'Déficit' : 'Exceso', sub: `${Math.abs(avg - goal)} kcal` },
                ].map(s => (
                    <Card key={s.label} className="text-center !p-3">
                        <div className="text-lg font-black text-[#FF6B1A] leading-none">{s.value}</div>
                        <div className="text-[9px] font-bold text-[#7B7D94] uppercase tracking-widest mt-1">{s.label}</div>
                        <div className="text-[10px] text-[#7B7D94] mt-0.5">{s.sub}</div>
                    </Card>
                ))}
            </div>

            {/* Lista días */}
            <Card>
                <SectionTitle>Últimos 14 días</SectionTitle>

                {data.length === 0 ? (
                    <EmptyState icon={ChartIcon} text="Sin historial aún. Registra alimentos para verlo aquí." />
                ) : (
                    <div className="space-y-4">
                        {data.map(day => {
                            const kcal = Math.round(Number(day.total_calories ?? 0))
                            const pct = kcal / Math.max(goal, 1)
                            const over = pct > 1
                            const good = pct <= 0.85

                            return (
                                <div key={day.log_date}>
                                    {/* Fecha + indicador */}
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-sm font-semibold text-white capitalize">
                                            {fmtDate(day.log_date)}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className={`
                        text-xs font-black
                        ${over ? 'text-red-400' : good ? 'text-[#00E5A0]' : 'text-[#F97316]'}
                      `}>
                                                {kcal.toLocaleString()} kcal
                                            </span>
                                            <div className={`
                        w-2 h-2 rounded-full
                        ${over ? 'bg-red-400' : good ? 'bg-[#00E5A0]' : 'bg-[#F97316]'}
                      `} />
                                        </div>
                                    </div>

                                    {/* Barra progreso */}
                                    <ProgressBar value={kcal} max={goal} />

                                    {/* Macros */}
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
                                            {day.total_items} alimentos
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Card>
        </div>
    )
}
