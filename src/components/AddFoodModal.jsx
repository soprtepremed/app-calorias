/**
 * AddFoodModal.jsx — Modal premium para añadir alimentos.
 *
 * Flujo MANUAL:
 *   1. Usuario describe la comida y pone cantidad/unidad
 *   2. Gemini calcula calorías y macros
 *   3. Se muestra ConfirmStep con resumen visual
 *   4. Solo al confirmar se guarda
 *
 * Flujo FOTO IA:
 *   1. Usuario toma/sube foto
 *   2. Gemini detecta ingredientes y pre-llena datos
 *   3. Se le pide al usuario la PORCIÓN real (ConfirmStep)
 *   4. Confirmar → guardar
 *
 * Módulos extraídos:
 *   ConfirmStep.jsx — Pantalla de confirmación con macros
 *
 * Props:
 *   open          — boolean
 *   onClose       — () => void
 *   onSave        — (items[], mealType) => Promise
 *   showToast     — (msg) => void
 *   onOpenScanner — () => void (abrir cámara en vivo)
 */
import { useState, useRef } from 'react'
import { analyzeFoodPhoto, analyzeFoodByText } from '../services/gemini'
import { uploadFoodPhoto } from '../services/supabase'
import { Modal, PrimaryButton, OutlineButton, Spinner } from './UI'
import {
    SunIcon, UtensilsIcon, MoonIcon, AppleIcon,
    PencilIcon, CameraIcon, SparkIcon,
} from './Icons'
import ConfirmStep from './ConfirmStep'

// ── Configuración de tipos de comida con emojis ──────────────────────
const MEALS = [
    { key: 'desayuno', label: 'Desayuno', emoji: '🌅', Icon: SunIcon, color: '#FF9F0A' },
    { key: 'almuerzo', label: 'Almuerzo', emoji: '🍽️', Icon: UtensilsIcon, color: '#FF375F' },
    { key: 'cena', label: 'Cena', emoji: '🌙', Icon: MoonIcon, color: '#0A84FF' },
    { key: 'snack', label: 'Snack', emoji: '🍎', Icon: AppleIcon, color: '#30D158' },
]

// ── Unidades disponibles ─────────────────────────────────────────────
const UNITS = ['gramos', 'ml', 'piezas', 'tazas', 'cucharadas', 'porciones']

// ── Pasos del flujo ──────────────────────────────────────────────────
const STEP_INPUT = 'input'        // Paso 1: entrada de datos
const STEP_CONFIRM = 'confirm'    // Paso 2: confirmación antes de guardar

export default function AddFoodModal({ open, onClose, onSave, showToast, onOpenScanner }) {
    // ── Estado general ───────────────────────────────────────────────
    const [meal, setMeal] = useState('desayuno')
    const [tab, setTab] = useState('manual')     // 'manual' | 'photo'
    const [step, setStep] = useState(STEP_INPUT) // paso actual del flujo
    const [loading, setLoading] = useState(false)

    // ── Estado manual ────────────────────────────────────────────────
    const [name, setName] = useState('')
    const [qty, setQty] = useState('100')
    const [unit, setUnit] = useState('gramos')
    const [kcal, setKcal] = useState('')
    const [protein, setProtein] = useState('')
    const [carbs, setCarbs] = useState('')
    const [fat, setFat] = useState('')
    const [aiExplanation, setAiExplanation] = useState('')
    const [aiDone, setAiDone] = useState(false)
    const [showUnits, setShowUnits] = useState(false) // dropdown custom de unidades

    // ── Estado foto ──────────────────────────────────────────────────
    const [photoURL, setPhotoURL] = useState(null)
    const [uploadURL, setUploadURL] = useState(null)
    const [detected, setDetected] = useState([])    // items detectados por IA
    const [editingItem, setEditingItem] = useState(null)  // item seleccionado para editar porción

    const fileInputRef = useRef(null)

    // ── Reset completo ───────────────────────────────────────────────
    const reset = () => {
        setTab('manual'); setMeal('desayuno'); setStep(STEP_INPUT)
        setPhotoURL(null); setUploadURL(null)
        setDetected([]); setEditingItem(null)
        setName(''); setQty('100'); setUnit('gramos')
        setKcal(''); setProtein(''); setCarbs(''); setFat('')
        setAiExplanation(''); setAiDone(false)
        setLoading(false)
    }

    const handleClose = () => { reset(); onClose() }

    // ══════════════════════════════════════════════════════════════════
    // FLUJO MANUAL
    // ══════════════════════════════════════════════════════════════════

    /**
     * Paso 1: Calcular macros con Gemini.
     * NO guarda aún — solo muestra la confirmación.
     */
    const calcByText = async () => {
        if (!name.trim()) return showToast('Describe qué comiste')
        setLoading(true)
        try {
            const r = await analyzeFoodByText(name.trim(), Number(qty) || 100, unit)
            setKcal(String(Math.round(r.calories)))
            setProtein(String(r.protein_g))
            setCarbs(String(r.carbs_g))
            setFat(String(r.fat_g))
            setAiDone(true)

            // Generar explicación legible
            setAiExplanation(
                `${name.trim()} — ${qty} ${unit}. Estimación basada en datos nutricionales USDA.`
            )

            // Avanzar al paso de confirmación
            setStep(STEP_CONFIRM)
        } catch (err) {
            showToast(err?.message || 'Error al calcular con IA')
        } finally {
            setLoading(false)
        }
    }

    /** Paso 2: Confirmar y guardar */
    const confirmManual = async () => {
        setLoading(true)
        try {
            await onSave([{
                food_name: name.trim(),
                emoji: '🍽️',
                quantity: Number(qty) || 1,
                unit,
                calories: Number(kcal) || 0,
                protein_g: Number(protein) || 0,
                carbs_g: Number(carbs) || 0,
                fat_g: Number(fat) || 0,
                source: 'ai-text',
            }], meal)
            showToast('Alimento guardado ✓')
            handleClose()
        } catch {
            showToast('Error al guardar')
        } finally {
            setLoading(false)
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // FLUJO FOTO
    // ══════════════════════════════════════════════════════════════════

    const onPhotoChange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setPhotoURL(URL.createObjectURL(file))
        setLoading(true)
        setDetected([])
        setUploadURL(null)
        setEditingItem(null)

        try {
            const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg'
            const [geminiResult, storageUrl] = await Promise.allSettled([
                analyzeFoodPhoto(file),
                uploadFoodPhoto(file, ext).catch(err => {
                    console.warn('Storage upload falló:', err.message)
                    return null
                }),
            ])

            const url = storageUrl.status === 'fulfilled' ? storageUrl.value : null
            setUploadURL(url)

            if (geminiResult.status === 'fulfilled') {
                const r = geminiResult.value
                // Inyectar photo_url y marcar como editable
                const items = r.items.map(item => ({
                    ...item,
                    photo_url: url,
                    // La IA estima la porción, pero el usuario puede ajustarla
                    originalQty: item.quantity,
                    originalUnit: item.unit,
                }))
                setDetected(items)
                if (!items.length) showToast('No detecté alimentos en la foto')
                else showToast(`${items.length} alimento(s) detectado(s) ✓`)
            } else {
                showToast('Error al analizar con IA')
            }
        } catch (err) {
            console.error(err)
            showToast('Error al procesar la foto')
        } finally {
            setLoading(false)
            e.target.value = ''
        }
    }

    /** Seleccionar un item detectado para editar porción y confirmar */
    const selectItemForConfirm = (item, idx) => {
        setEditingItem({ ...item, idx })
        setStep(STEP_CONFIRM)
    }

    /** Actualizar cantidad del item en edición */
    const updateEditingQty = (val) => {
        setEditingItem(prev => {
            if (!prev) return prev
            const newQty = Number(val) || 0
            const ratio = prev.originalQty > 0 ? newQty / prev.originalQty : 1
            return {
                ...prev,
                quantity: newQty,
                // Recalcular macros proporcionalmente
                calories: Math.round(prev.originalCalories * ratio),
                protein_g: Math.round(prev.originalProtein * ratio * 10) / 10,
                carbs_g: Math.round(prev.originalCarbs * ratio * 10) / 10,
                fat_g: Math.round(prev.originalFat * ratio * 10) / 10,
            }
        })
    }

    /** Guardar un item de foto después de confirmar porción */
    const confirmPhotoItem = async () => {
        if (!editingItem) return
        setLoading(true)
        try {
            await onSave([{
                food_name: editingItem.food_name,
                emoji: editingItem.emoji ?? '📷',
                quantity: editingItem.quantity,
                unit: editingItem.unit,
                calories: editingItem.calories,
                protein_g: editingItem.protein_g,
                carbs_g: editingItem.carbs_g,
                fat_g: editingItem.fat_g,
                source: 'ai-photo',
                photo_url: editingItem.photo_url,
            }], meal)
            showToast(`${editingItem.food_name} guardado ✓`)
            // Quitar el item ya guardado de la lista
            setDetected(prev => prev.filter((_, i) => i !== editingItem.idx))
            setEditingItem(null)
            setStep(STEP_INPUT)
            // Si no quedan más items, cerrar
            if (detected.length <= 1) handleClose()
        } catch {
            showToast('Error al guardar')
        } finally {
            setLoading(false)
        }
    }

    // ── Color activo según tipo de comida ─────────────────────────────
    const activeMeal = MEALS.find(m => m.key === meal) ?? MEALS[0]

    return (
        <Modal open={open} onClose={handleClose} title="Añadir Alimento">

            {/* ── PASO 1: ENTRADA DE DATOS ─────────────────────────── */}
            {step === STEP_INPUT && (
                <>
                    {/* Chips de tipo de comida — grandes y coloridos */}
                    <div className="flex gap-2 flex-wrap mb-5">
                        {MEALS.map(m => (
                            <button
                                key={m.key}
                                onClick={() => setMeal(m.key)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border-2 transition-all active:scale-95"
                                style={meal === m.key ? {
                                    background: `linear-gradient(135deg, ${m.color}25, ${m.color}10)`,
                                    borderColor: m.color,
                                    color: m.color,
                                    boxShadow: `0 0 16px ${m.color}20`,
                                } : {
                                    background: 'transparent',
                                    borderColor: 'rgba(255,255,255,0.08)',
                                    color: '#8E8EA0',
                                }}
                            >
                                <span className="text-base">{m.emoji}</span>
                                <span>{m.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Tabs: Manual / Foto IA */}
                    <div className="flex gap-1 bg-[#0D0D11] rounded-xl p-1 mb-5 border border-[#2E2E3A]">
                        {[
                            { key: 'manual', label: 'Manual', Icon: PencilIcon },
                            { key: 'photo', label: 'Foto IA', Icon: CameraIcon },
                        ].map(t => (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                                    text-sm font-bold transition-all
                                    ${tab === t.key
                                        ? 'bg-[#1C1C22] text-white border border-[#2E2E3A]'
                                        : 'text-[#8E8EA0]'
                                    }`}
                            >
                                <t.Icon size={15} />{t.label}
                            </button>
                        ))}
                    </div>

                    {/* ── TAB MANUAL ── */}
                    {tab === 'manual' && (
                        <div className="space-y-4">
                            {/* Descripción del alimento */}
                            <div>
                                <label className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest mb-1.5 block">
                                    Describe tu comida *
                                </label>
                                <input
                                    id="food-desc"
                                    value={name}
                                    onChange={e => { setName(e.target.value); if (aiDone) setAiDone(false) }}
                                    placeholder="Ej: 2 huevos revueltos con tortilla y frijoles"
                                    className="w-full px-4 py-3.5 rounded-xl text-white text-base font-semibold
                                               placeholder-[#454558] focus:outline-none transition-all"
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: `1.5px solid rgba(255,255,255,0.1)`,
                                    }}
                                    onFocus={e => e.target.style.borderColor = activeMeal.color}
                                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                />
                                <p className="text-[10px] text-[#8E8EA0] mt-1.5 ml-1">
                                    Sé específico: incluye preparación, ingredientes y cantidad
                                </p>
                            </div>

                            {/* Cantidad + Unidad */}
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest mb-1.5 block">
                                        Cantidad
                                    </label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={qty}
                                        onChange={e => setQty(e.target.value)}
                                        placeholder="100"
                                        className="w-full px-3 py-3 rounded-xl text-white text-sm font-bold text-center focus:outline-none"
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1.5px solid rgba(255,255,255,0.08)',
                                        }}
                                    />
                                </div>
                                <div className="flex-1 relative">
                                    <label className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest mb-1.5 block">
                                        Unidad
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowUnits(!showUnits)}
                                        className="w-full px-3 py-3 rounded-xl text-white text-sm font-bold text-center
                                                   focus:outline-none flex items-center justify-center gap-1.5"
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: showUnits
                                                ? `1.5px solid ${activeMeal.color}`
                                                : '1.5px solid rgba(255,255,255,0.08)',
                                        }}
                                    >
                                        {unit}
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                                            style={{ transform: showUnits ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                                            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                        </svg>
                                    </button>
                                    {showUnits && (
                                        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl overflow-hidden
                                                        border border-[#2E2E3A] shadow-xl"
                                            style={{ background: '#1C1C22' }}>
                                            {UNITS.map(u => (
                                                <button
                                                    key={u}
                                                    type="button"
                                                    onClick={() => { setUnit(u); setShowUnits(false) }}
                                                    className="w-full px-3 py-2.5 text-sm font-semibold text-left transition-colors"
                                                    style={{
                                                        color: unit === u ? activeMeal.color : '#ccc',
                                                        background: unit === u ? `${activeMeal.color}15` : 'transparent',
                                                    }}
                                                    onMouseEnter={e => { if (unit !== u) e.target.style.background = 'rgba(255,255,255,0.06)' }}
                                                    onMouseLeave={e => { if (unit !== u) e.target.style.background = 'transparent' }}
                                                >
                                                    {u}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Botón Calcular con IA */}
                            <button
                                onClick={calcByText}
                                disabled={loading || !name.trim()}
                                className="w-full py-4 rounded-2xl text-sm font-black relative overflow-hidden
                                           transition-all active:scale-[0.98] disabled:opacity-40"
                                style={{
                                    background: 'linear-gradient(135deg, #0A84FF, #BF5AF2)',
                                    boxShadow: '0 0 24px rgba(10,132,255,0.4)',
                                }}
                            >
                                <div className="flex items-center justify-center gap-2.5">
                                    {loading
                                        ? <><Spinner /><span className="text-white">Calculando con IA...</span></>
                                        : <><SparkIcon size={17} className="text-white" /><span className="text-white">Calcular calorías con Gemini IA</span></>
                                    }
                                </div>
                            </button>

                            <OutlineButton onClick={handleClose}>Cancelar</OutlineButton>
                        </div>
                    )}

                    {/* ── TAB FOTO ── */}
                    {tab === 'photo' && (
                        <div>
                            {/* Botón cámara en vivo */}
                            <button
                                onClick={() => { handleClose(); onOpenScanner() }}
                                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl mb-4
                                           border border-dashed border-[#0A84FF]/50 text-[#0A84FF]
                                           font-bold text-sm hover:bg-[#0A84FF]/10 transition-all"
                            >
                                <CameraIcon size={18} />
                                Usar cámara con detección en vivo
                            </button>

                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex-1 h-px bg-[#2E2E3A]" />
                                <span className="text-[10px] text-[#8E8EA0] font-bold">O SUBE UNA FOTO</span>
                                <div className="flex-1 h-px bg-[#2E2E3A]" />
                            </div>

                            {/* Input de archivo */}
                            <label className={`block border-2 border-dashed rounded-2xl cursor-pointer overflow-hidden transition-all
                                ${photoURL ? 'border-[#0A84FF]/40' : 'border-[#2E2E3A] hover:border-[#0A84FF]/30'}`}>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={onPhotoChange}
                                />
                                {photoURL
                                    ? <img src={photoURL} alt="preview" className="w-full max-h-48 object-cover" />
                                    : (
                                        <div className="flex flex-col items-center py-8 text-[#8E8EA0]">
                                            <CameraIcon size={32} className="mb-2 opacity-50" />
                                            <p className="text-sm">Toca para elegir imagen</p>
                                        </div>
                                    )
                                }
                            </label>

                            {/* Loading */}
                            {loading && (
                                <div className="flex items-center gap-3 justify-center py-6 text-[#8E8EA0]">
                                    <Spinner /> <span className="text-sm">Analizando con IA...</span>
                                </div>
                            )}

                            {/* Items detectados — pedir porción para cada uno */}
                            {!loading && detected.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    <p className="text-[9px] font-black text-[#8E8EA0] uppercase tracking-widest mb-3">
                                        Alimentos detectados — toca para ajustar porción y confirmar
                                    </p>
                                    {detected.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => selectItemForConfirm({
                                                ...item,
                                                originalCalories: item.calories,
                                                originalProtein: item.protein_g,
                                                originalCarbs: item.carbs_g,
                                                originalFat: item.fat_g,
                                                originalQty: item.quantity,
                                            }, idx)}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl border
                                                       cursor-pointer transition-all text-left
                                                       hover:bg-[#0A84FF]/10 hover:border-[#0A84FF]/40
                                                       bg-[#1C1C22] border-[#2E2E3A]"
                                        >
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                                                style={{ background: 'rgba(10,132,255,0.15)' }}>
                                                {item.emoji ?? '🍽️'}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-white">{item.food_name}</p>
                                                <p className="text-[10px] text-[#8E8EA0]">
                                                    {item.quantity}{item.unit} · {Math.round(item.calories)} kcal
                                                </p>
                                            </div>
                                            <span className="text-[10px] text-[#0A84FF] font-bold">
                                                AJUSTAR →
                                            </span>
                                        </button>
                                    ))}

                                    <OutlineButton onClick={handleClose}>Cancelar</OutlineButton>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ── PASO 2: CONFIRMACIÓN (delegada a ConfirmStep) ────── */}
            {step === STEP_CONFIRM && (
                <ConfirmStep
                    tab={tab}
                    activeMeal={activeMeal}
                    name={name}
                    qty={qty}
                    unit={unit}
                    kcal={kcal}
                    protein={protein}
                    carbs={carbs}
                    fat={fat}
                    aiExplanation={aiExplanation}
                    editingItem={editingItem}
                    onUpdateQty={updateEditingQty}
                    onBack={() => { setStep(STEP_INPUT); setEditingItem(null) }}
                    onConfirm={tab === 'photo' ? confirmPhotoItem : confirmManual}
                    loading={loading}
                />
            )}
        </Modal>
    )
}
