import { useEffect, useState, useRef } from 'react'
import { getWeightHistory, logWeight, deleteWeight, todayStr, logActivity } from '../services/supabase'
import { withOfflineFallback } from '../services/offlineQueue'
import { Card, Modal, FormInput, EmptyState, SectionTitle, PrimaryButton, OutlineButton, Spinner } from './UI'
import { ScaleIcon, ArrowUpIcon, ArrowDownIcon, TrashIcon, PlusIcon } from './Icons'

/** Formatea fecha completa */
function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Weight({ showToast }) {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState(false)
    const [weight, setWeight] = useState('')
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)

    const load = async () => {
        try {
            setHistory(await getWeightHistory(12))
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    const saveBusy = useRef(false)

    const handleSave = async () => {
        const w = parseFloat(weight)
        if (isNaN(w) || w <= 0 || w > 500) return showToast('Ingresa un peso válido')
        if (saveBusy.current) return
        saveBusy.current = true
        setSaving(true)
        try {
            await withOfflineFallback(
                () => logWeight(todayStr(), w, notes.trim()),
                'logWeight',
                { date: todayStr(), weight_kg: w, notes: notes.trim() },
            )
            await withOfflineFallback(
                () => logActivity('weight', { weight_kg: w, notes: notes.trim() }),
                'logActivity',
                { type: 'weight', metadata: { weight_kg: w, notes: notes.trim() } },
            )
            setModal(false); setWeight(''); setNotes('')
            await load()
            showToast(navigator.onLine ? 'Peso registrado' : '📦 Guardado offline')
        } catch { showToast('Error al guardar') }
        finally { setSaving(false); saveBusy.current = false }
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este registro?')) return
        try {
            await deleteWeight(id)
            await load()
            showToast('Registro eliminado')
        } catch { showToast('Error al eliminar') }
    }

    // Gráfica de tendencia con eje de tiempo
    const ChartLine = () => {
        if (history.length < 2) {
            // Recordatorio si solo hay 1 registro
            if (history.length === 1) {
                return (
                    <div className="mb-4 bg-[#1C1D27] rounded-xl p-4 border border-[#2A2B38] text-center">
                        <p className="text-xs text-[#8E8EA0] mb-1">📊 Necesitas al menos 2 registros para ver la gráfica</p>
                        <p className="text-[10px] text-[#FF9F0A] font-bold">Pésate mañana para ver tu tendencia</p>
                    </div>
                )
            }
            return null
        }

        const entries = [...history].reverse() // más antiguo primero
        const vals = entries.map(h => Number(h.weight_kg))
        const dates = entries.map(h => {
            const d = new Date(h.log_date + 'T12:00:00')
            return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
        })
        const min = Math.min(...vals) - 0.5
        const max = Math.max(...vals) + 0.5
        const range = max - min || 1

        const PAD_L = 40, PAD_R = 10, PAD_T = 20, PAD_B = 30
        const W = 320, H = 140
        const plotW = W - PAD_L - PAD_R
        const plotH = H - PAD_T - PAD_B

        const points = vals.map((v, i) => {
            const x = PAD_L + (i / (vals.length - 1)) * plotW
            const y = PAD_T + plotH - ((v - min) / range) * plotH
            return { x, y, val: v }
        })

        const polyline = points.map(p => `${p.x},${p.y}`).join(' ')
        // Área rellena
        const areaPath = `M${points[0].x},${PAD_T + plotH} ${points.map(p => `L${p.x},${p.y}`).join(' ')} L${points[points.length - 1].x},${PAD_T + plotH} Z`

        // Recordatorio basado en último registro
        const lastDate = new Date(history[0].log_date + 'T12:00:00')
        const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000)
        const reminder = daysSince >= 3
            ? `⏰ Han pasado ${daysSince} días desde tu último pesaje`
            : daysSince >= 1
                ? '✅ Registro actualizado'
                : null

        return (
            <div className="mb-4">
                <SectionTitle>Tendencia de peso</SectionTitle>
                <div className="bg-[#1C1D27] rounded-xl p-4 border border-[#2A2B38]">
                    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="h-36">
                        <defs>
                            <linearGradient id="wAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#FF6B1A" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#FF6B1A" stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        {/* Líneas horizontales de referencia */}
                        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                            const y = PAD_T + plotH - pct * plotH
                            const val = (min + pct * range).toFixed(1)
                            return (
                                <g key={i}>
                                    <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                                        stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                                    <text x={PAD_L - 4} y={y + 3} textAnchor="end"
                                        fill="#7B7D94" fontSize="8" fontFamily="Inter">{val}</text>
                                </g>
                            )
                        })}

                        {/* Área rellena */}
                        <path d={areaPath} fill="url(#wAreaGrad)" />

                        {/* Línea principal */}
                        <polyline points={polyline}
                            fill="none" stroke="#FF6B1A" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round"
                            style={{ filter: 'drop-shadow(0 0 6px rgba(255,107,26,0.5))' }} />

                        {/* Puntos + etiquetas */}
                        {points.map((p, i) => (
                            <g key={i}>
                                <circle cx={p.x} cy={p.y} r="4"
                                    fill="#FF6B1A" stroke="#14151C" strokeWidth="2" />
                                {/* Etiqueta de peso */}
                                <text x={p.x} y={p.y - 8} textAnchor="middle"
                                    fill="white" fontSize="7" fontWeight="bold" fontFamily="Inter">
                                    {p.val.toFixed(1)}
                                </text>
                            </g>
                        ))}

                        {/* Eje X — fechas */}
                        {points.map((p, i) => {
                            // Solo mostrar algunas fechas si hay muchos puntos
                            if (vals.length > 6 && i % 2 !== 0 && i !== vals.length - 1) return null
                            return (
                                <text key={`d${i}`} x={p.x} y={H - 4} textAnchor="middle"
                                    fill="#7B7D94" fontSize="7" fontFamily="Inter">
                                    {dates[i]}
                                </text>
                            )
                        })}
                    </svg>

                    {/* Recordatorio */}
                    {reminder && (
                        <p className="text-center text-[10px] font-semibold mt-2"
                            style={{ color: daysSince >= 3 ? '#FF9F0A' : '#30D158' }}>
                            {reminder}
                        </p>
                    )}
                </div>
            </div>
        )
    }

    if (loading) {
        return <div className="flex justify-center h-48 items-center"><Spinner /></div>
    }

    return (
        <div className="animate-fade-up">

            {/* Header + botón */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-[10px] font-bold text-[#7B7D94] uppercase tracking-widest">Registro</p>
                    <h2 className="text-xl font-black text-white">Peso Corporal</h2>
                </div>
                <button
                    onClick={() => setModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                     bg-[#FF6B1A] text-white text-sm font-bold
                     shadow-lg shadow-[#FF6B1A]/30 active:scale-95 transition-all"
                >
                    <PlusIcon size={16} /> Registrar
                </button>
            </div>

            {/* Stat actual */}
            {history.length > 0 && (
                <Card className="mb-4 flex flex-col items-center py-6">
                    <div className="text-6xl font-black text-white tracking-tight leading-none">
                        {Number(history[0].weight_kg).toFixed(1)}
                    </div>
                    <div className="text-[#7B7D94] font-bold text-sm mt-1">kg actuales</div>
                    {history.length > 1 && (() => {
                        const diff = Number(history[0].weight_kg) - Number(history[1].weight_kg)
                        const up = diff > 0
                        return (
                            <div className={`flex items-center gap-1.5 mt-3 text-sm font-black
                ${up ? 'text-red-400' : 'text-[#00E5A0]'}`}>
                                {up ? <ArrowUpIcon size={16} /> : <ArrowDownIcon size={16} />}
                                {up ? '+' : ''}{diff.toFixed(1)} kg vs registro anterior
                            </div>
                        )
                    })()}
                </Card>
            )}

            {/* Gráfica */}
            <ChartLine />

            {/* Historial lista */}
            <Card>
                <SectionTitle>Historial</SectionTitle>

                {history.length === 0 ? (
                    <EmptyState icon={ScaleIcon} text="Sin registros aún. Toca 'Registrar' para empezar." />
                ) : (
                    <div className="space-y-2">
                        {history.map((entry, idx) => {
                            const diff = idx < history.length - 1
                                ? Number(entry.weight_kg) - Number(history[idx + 1].weight_kg)
                                : null

                            return (
                                <div key={entry.id}
                                    className="flex items-center gap-3 bg-[#1C1D27] rounded-xl px-3 py-3
                             border border-[#2A2B38] group"
                                >
                                    {/* Fecha */}
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-white capitalize">{fmtDate(entry.log_date)}</p>
                                        {entry.notes && <p className="text-[10px] text-[#7B7D94] mt-0.5">{entry.notes}</p>}
                                    </div>

                                    {/* Diff */}
                                    {diff !== null && (
                                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg
                      ${diff > 0
                                                ? 'bg-red-500/10 text-red-400'
                                                : diff < 0
                                                    ? 'bg-[#00E5A0]/10 text-[#00E5A0]'
                                                    : 'bg-white/5 text-[#7B7D94]'
                                            }`}
                                        >
                                            {diff > 0 ? <ArrowUpIcon size={11} /> : diff < 0 ? <ArrowDownIcon size={11} /> : null}
                                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                        </div>
                                    )}

                                    {/* Peso */}
                                    <span className="text-lg font-black text-[#FF6B1A]">
                                        {Number(entry.weight_kg).toFixed(1)} kg
                                    </span>

                                    {/* Eliminar */}
                                    <button
                                        onClick={() => handleDelete(entry.id)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg
                               text-[#2A2B38] hover:text-red-400 hover:bg-red-500/10
                               opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <TrashIcon size={14} />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Card>

            {/* Modal registro peso */}
            <Modal open={modal} onClose={() => setModal(false)} title="Registrar Peso">
                <FormInput
                    label="Peso en kg"
                    id="weight-val"
                    type="number"
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    placeholder="70.5"
                    step="0.1"
                    min="20"
                    max="500"
                />
                <FormInput
                    label="Nota (opcional)"
                    id="weight-notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Ej: En ayunas"
                />
                <div className="flex gap-3 mt-2">
                    <OutlineButton onClick={() => setModal(false)}>Cancelar</OutlineButton>
                    <PrimaryButton onClick={handleSave} loading={saving}>Guardar</PrimaryButton>
                </div>
            </Modal>
        </div>
    )
}
