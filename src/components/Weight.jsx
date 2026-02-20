import { useEffect, useState } from 'react'
import { getWeightHistory, logWeight, deleteWeight, todayStr } from '../services/supabase'
import { Card, Modal, FormInput, EmptyState, SectionTitle, PrimaryButton, OutlineButton, Spinner } from './UI'
import { ScaleIcon, ArrowUpIcon, ArrowDownIcon, TrashIcon, PlusIcon } from './Icons'

/** Formatea fecha */
function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
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

    const handleSave = async () => {
        const w = parseFloat(weight)
        if (isNaN(w) || w <= 0 || w > 500) return showToast('Ingresa un peso válido')
        setSaving(true)
        try {
            await logWeight(todayStr(), w, notes.trim())
            setModal(false); setWeight(''); setNotes('')
            await load()
            showToast('Peso registrado')
        } catch { showToast('Error al guardar') }
        finally { setSaving(false) }
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este registro?')) return
        try {
            await deleteWeight(id)
            await load()
            showToast('Registro eliminado')
        } catch { showToast('Error al eliminar') }
    }

    // Gráfica de línea simple SVG
    const ChartLine = () => {
        if (history.length < 2) return null
        const vals = [...history].reverse().map(h => Number(h.weight_kg))
        const min = Math.min(...vals) - 1
        const max = Math.max(...vals) + 1
        const W = 300, H = 80
        const pts = vals.map((v, i) => {
            const x = (i / (vals.length - 1)) * W
            const y = H - ((v - min) / (max - min)) * H
            return `${x},${y}`
        })

        return (
            <div className="mb-4">
                <SectionTitle>Tendencia</SectionTitle>
                <div className="bg-[#1C1D27] rounded-xl p-4 border border-[#2A2B38] overflow-x-auto">
                    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-20">
                        {/* Área */}
                        <defs>
                            <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#FF6B1A" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#FF6B1A" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <polyline
                            points={pts.join(' ')}
                            fill="none" stroke="#FF6B1A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ filter: 'drop-shadow(0 0 4px #FF6B1A80)' }}
                        />
                        {/* Puntos */}
                        {vals.map((v, i) => {
                            const x = (i / (vals.length - 1)) * W
                            const y = H - ((v - min) / (max - min)) * H
                            return (
                                <circle key={i} cx={x} cy={y} r="4"
                                    fill="#FF6B1A" stroke="#14151C" strokeWidth="2" />
                            )
                        })}
                    </svg>
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
