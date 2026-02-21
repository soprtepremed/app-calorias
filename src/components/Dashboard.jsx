import { useEffect, useState, useCallback, useRef } from 'react'
import { getFoodByDate, getWaterByDate, addFood, deleteFood, setWaterGlasses, uploadFoodPhoto, todayStr, logActivity } from '../services/supabase'
import { withOfflineFallback } from '../services/offlineQueue'
import { analyzeFoodPhoto, analyzeFoodByText } from '../services/gemini'
import { Modal, FormInput, Chip, EmptyState, PrimaryButton, OutlineButton, Spinner } from './UI'
import CameraScanner from './CameraScanner'
import FastingTracker from './FastingTracker'
import {
    FlameIcon, DropIcon, TrashIcon, CameraIcon, PencilIcon,
    SparkIcon, CheckIcon, PlusIcon,
    SunIcon, UtensilsIcon, MoonIcon, AppleIcon, MEAL_ICONS, MEAL_LABELS
} from './Icons'

// ════════════════════════════════════════════════════════════════
// ACTIVITY RINGS — Estilo Apple Watch (3 anillos concéntricos)
// ════════════════════════════════════════════════════════════════
function ActivityRings({ calories, calorieGoal, protein, water, waterGoal }) {
    const SIZE = 220
    const CTR = SIZE / 2
    const RINGS = [
        // [radio, color, valor, máximo, label]
        { r: 85, color: '#FF375F', val: calories, max: calorieGoal, label: 'KCAL', shadow: '#FF375F' },
        { r: 62, color: '#30D158', val: water, max: waterGoal, label: 'AGUA', shadow: '#30D158' },
        { r: 39, color: '#0A84FF', val: protein, max: 150, label: 'PROTEÍNA', shadow: '#0A84FF' },
    ]

    return (
        <div className="flex flex-col items-center py-6">
            <div className="relative" style={{ width: SIZE, height: SIZE }}>
                <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                    <defs>
                        {RINGS.map((ring, i) => (
                            <filter key={i} id={`glow-${i}`}>
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        ))}
                    </defs>

                    {RINGS.map((ring, i) => {
                        const CIRCUM = 2 * Math.PI * ring.r
                        const pct = Math.min(ring.val / Math.max(ring.max, 1), 1)
                        const offset = CIRCUM - pct * CIRCUM
                        // Caps redondeados — calcular posición del punto final
                        const angle = pct * 2 * Math.PI - Math.PI / 2
                        const capX = CTR + ring.r * Math.cos(angle)
                        const capY = CTR + ring.r * Math.sin(angle)

                        return (
                            <g key={i}>
                                {/* Track oscuro */}
                                <circle
                                    cx={CTR} cy={CTR} r={ring.r}
                                    fill="none"
                                    stroke="rgba(255,255,255,0.07)"
                                    strokeWidth={12}
                                />
                                {/* Anillo de progreso */}
                                <circle
                                    cx={CTR} cy={CTR} r={ring.r}
                                    fill="none"
                                    stroke={ring.color}
                                    strokeWidth={12}
                                    strokeLinecap="round"
                                    strokeDasharray={CIRCUM}
                                    strokeDashoffset={offset}
                                    className="progress-ring"
                                    style={{
                                        filter: `drop-shadow(0 0 6px ${ring.color}80)`,
                                    }}
                                />
                                {/* Brillo en la punta */}
                                {pct > 0.03 && (
                                    <circle
                                        cx={capX} cy={capY} r={6}
                                        fill={ring.color}
                                        style={{ filter: `drop-shadow(0 0 4px ${ring.color})` }}
                                    />
                                )}
                            </g>
                        )
                    })}
                </svg>

                {/* Número central — calorías */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="num text-4xl font-black text-white leading-none">
                        {Math.round(calories).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold text-[#FF375F] uppercase tracking-widest mt-1">
                        📍 kcal hoy
                    </span>
                </div>
            </div>

            {/* Leyenda de anillos */}
            <div className="flex gap-6 mt-4">
                {RINGS.map((ring, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ring.color }} />
                        <div>
                            <p className="text-[9px] font-black text-[#8E8EA0] uppercase tracking-widest leading-none">
                                {ring.label}
                            </p>
                            <p className="text-xs font-bold text-white leading-tight num">
                                {ring.val > 0 ? Math.round(ring.val) : 0}
                                <span className="text-[8px] text-[#8E8EA0] ml-0.5">
                                    /{ring.max}
                                </span>
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ════════════════════════════════════════════════════════════════
// MACRO CARDS — Estilo Apple Fitness tarjetas cuadradas
// ════════════════════════════════════════════════════════════════
function MacroCards({ calories, protein, carbs, fat, goal }) {
    const stats = [
        { label: 'Restantes', value: Math.max(goal - Math.round(calories), 0), unit: 'kcal', color: '#FF375F', bg: 'rgba(255,55,95,0.12)' },
        { label: 'Proteína', value: Math.round(protein), unit: 'g', color: '#0A84FF', bg: 'rgba(10,132,255,0.12)' },
        { label: 'Carbohid.', value: Math.round(carbs), unit: 'g', color: '#FF9F0A', bg: 'rgba(255,159,10,0.12)' },
        { label: 'Grasa', value: Math.round(fat), unit: 'g', color: '#BF5AF2', bg: 'rgba(191,90,242,0.12)' },
    ]
    return (
        <div className="grid grid-cols-4 gap-2 mb-3">
            {stats.map(s => (
                <div key={s.label}
                    className="rounded-2xl p-3 flex flex-col items-center"
                    style={{ background: s.bg, border: `1px solid ${s.color}30` }}
                >
                    <span className="num text-lg font-black leading-none" style={{ color: s.color }}>
                        {s.value.toLocaleString()}
                    </span>
                    <span className="text-[8px] font-semibold mt-0.5" style={{ color: s.color + 'AA' }}>
                        {s.unit}
                    </span>
                    <span className="text-[8px] text-[#8E8EA0] font-medium mt-1 text-center leading-none">
                        {s.label}
                    </span>
                </div>
            ))}
        </div>
    )
}

// Gradiente global definido UNA sola vez — evita conflictos de id en múltiples SVGs
const WaterGradDefs = () => (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
            <linearGradient id="wg-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7FD8F5" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#1A8FBF" stopOpacity="0.95" />
            </linearGradient>
        </defs>
    </svg>
)

/**
 * WaterGlass — Vaso SVG con animaciones CSS puras.
 *
 * Estrategia: manipulamos classList directamente con useRef para
 * disparar los @keyframes de index.css sin pasar por el ciclo
 * de render de React → animación 100% en el compositor, sin cortes.
 */
function WaterGlass({ idx, filled, active, onClick }) {
    const btnRef = useRef(null)
    const clipId = `wg-clip-${idx}`

    const handleClick = () => {
        const el = btnRef.current
        if (!el) return
        // Quitar clase para poder re-disparar la animación si el usuario pulsa rápido
        el.classList.remove('glass-tap')
        // Forzar reflow (truco estándar para reiniciar animaciones CSS)
        void el.offsetWidth
        el.classList.add('glass-tap')
        onClick()
    }

    return (
        <button
            ref={btnRef}
            onClick={handleClick}
            className={filled ? 'glass-filled' : ''}
            style={{
                minWidth: 0,
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'none',
                padding: '2px 1px',
                cursor: 'pointer',
            }}
        >
            <svg viewBox="0 0 24 28" style={{ width: '100%', maxWidth: 30 }}>
                <defs>
                    <clipPath id={clipId}>
                        <path d="M5 4 L6.2 23.5 C6.2 24.3 6.9 25 7.7 25 L16.3 25 C17.1 25 17.8 24.3 17.8 23.5 L19 4 Z" />
                    </clipPath>
                </defs>

                {/* Cuerpo del vaso */}
                <path
                    d="M4 2 L5.5 24 C5.5 25.1 6.4 26 7.5 26 L16.5 26 C17.6 26 18.5 25.1 18.5 24 L20 2 Z"
                    fill="none"
                    stroke={filled ? '#5AC8FA' : 'rgba(255,255,255,0.13)'}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                />

                {/* Agua + onda — solo cuando está lleno */}
                {filled && (
                    <>
                        {/* El y se transiciona vía .water-rect en CSS */}
                        <rect
                            className="water-rect"
                            x="4" y={active ? '6' : '10'}
                            width="16" height="22"
                            fill="url(#wg-grad)"
                            clipPath={`url(#${clipId})`}
                        />
                        {/* Onda del nivel de agua */}
                        <path
                            d={active
                                ? 'M6 8 Q9 6.5 12 8 Q15 9.5 18 8'
                                : 'M6 12 Q9 10.5 12 12 Q15 13.5 18 12'}
                            fill="none"
                            stroke="rgba(255,255,255,0.4)"
                            strokeWidth="0.9"
                        />
                        {/* Brillo interior sutil */}
                        <line x1="7" y1="7" x2="7.5" y2="22"
                            stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeLinecap="round" />
                    </>
                )}
            </svg>
        </button>
    )
}


function WaterTracker({ glasses, goal, onChange }) {
    const pct = goal > 0 ? glasses / goal : 0
    const color = pct >= 1 ? '#30D158' : pct >= 0.5 ? '#5AC8FA' : '#FF9F0A'

    return (
        <div className="card p-4 mb-3">
            {/* SVG defs globales — gradiente compartido */}
            <WaterGradDefs />

            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <DropIcon size={15} style={{ color: '#5AC8FA' }} />
                    <span className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest">
                        Hidratación
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black transition-all" style={{ color }}>{glasses}</span>
                    <span className="text-[10px] text-[#8E8EA0] font-semibold">
                        /{goal} vasos · {glasses * 250}ml
                    </span>
                    {pct >= 1 && <span className="text-xs animate-bounce">🎉</span>}
                </div>
            </div>

            {/* Barra de progreso */}
            <div className="h-1 rounded-full bg-white/5 mb-3 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, pct * 100)}%`, background: `linear-gradient(90deg,#1A8FBF,${color})` }} />
            </div>

            {/* Vasitos con scroll si hay muchos */}
            <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {Array.from({ length: goal }).map((_, i) => (
                    <WaterGlass
                        key={i}
                        idx={i}
                        filled={i < glasses}
                        active={i === glasses - 1}
                        onClick={() => onChange(i + 1 === glasses ? i : i + 1)}
                    />
                ))}
            </div>

            {/* Mensaje motivacional */}
            <p className="text-center text-[10px] mt-2" style={{ color: pct >= 1 ? '#30D158' : '#8E8EA0' }}>
                {pct >= 1
                    ? '¡Meta de hidratación alcanzada! 💪'
                    : `${goal - glasses} vaso${goal - glasses !== 1 ? 's' : ''} más para tu meta`}
            </p>
        </div>
    )
}



// ════════════════════════════════════════════════════════════════
// FOOD LIST
// ════════════════════════════════════════════════════════════════
function FoodList({ foods, onDelete }) {
    if (!foods.length) return (
        <EmptyState icon={FlameIcon} text="Sin registros hoy. Toca + para añadir." />
    )

    const grouped = {}
    foods.forEach(f => {
        const k = f.meal_type ?? 'otro'
        if (!grouped[k]) grouped[k] = []
        grouped[k].push(f)
    })
    const order = ['desayuno', 'almuerzo', 'cena', 'snack', 'otro']

    const MEAL_COLORS = {
        desayuno: '#FF9F0A',
        almuerzo: '#FF375F',
        cena: '#0A84FF',
        snack: '#30D158',
        otro: '#8E8EA0',
    }

    return (
        <div className="space-y-5">
            {order.map(meal => {
                const items = grouped[meal]
                if (!items?.length) return null
                const MealIcon = MEAL_ICONS[meal] ?? UtensilsIcon
                const color = MEAL_COLORS[meal]
                const total = Math.round(items.reduce((s, f) => s + Number(f.calories ?? 0), 0))

                return (
                    <div key={meal}>
                        <div className="flex items-center gap-2 mb-2">
                            <MealIcon size={13} style={{ color }} />
                            <span className="text-[9px] font-black text-[#8E8EA0] uppercase tracking-widest">
                                {MEAL_LABELS[meal]}
                            </span>
                            <div className="flex-1 h-px" style={{ background: `${color}30` }} />
                            <span className="text-[10px] font-black num" style={{ color }}>{total} kcal</span>
                        </div>

                        <div className="space-y-1.5">
                            {items.map(food => (
                                <div key={food.id}
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5
                             border transition-colors group"
                                    style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate leading-none">{food.food_name}</p>
                                        <p className="text-[10px] text-[#8E8EA0] mt-1 num">
                                            {food.quantity}{food.unit}
                                            {' · '}P:{Math.round(food.protein_g ?? 0)}g C:{Math.round(food.carbs_g ?? 0)}g G:{Math.round(food.fat_g ?? 0)}g
                                        </p>
                                    </div>
                                    <span className="num text-sm font-black" style={{ color }}>{Math.round(food.calories)}</span>
                                    <button
                                        onClick={() => onDelete(food.id)}
                                        className="w-6 h-6 flex items-center justify-center rounded-lg
                               text-[#2E2E3A] hover:text-red-400 hover:bg-red-500/10
                               opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <TrashIcon size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ════════════════════════════════════════════════════════════════
// MODAL AÑADIR ALIMENTO
// ════════════════════════════════════════════════════════════════
function AddFoodModal({ open, onClose, onSave, showToast, onOpenScanner }) {
    const [meal, setMeal] = useState('desayuno')
    const [tab, setTab] = useState('manual')
    const [loading, setLoading] = useState(false)
    const [photoURL, setPhotoURL] = useState(null)
    const [detected, setDetected] = useState([])
    const [checked, setChecked] = useState([])
    const [name, setName] = useState('')
    const [qty, setQty] = useState('100')
    const [unit, setUnit] = useState('gramos')
    const [kcal, setKcal] = useState('')
    const [protein, setProtein] = useState('')
    const [carbs, setCarbs] = useState('')
    const [fat, setFat] = useState('')
    const [aiDone, setAiDone] = useState(false)
    const [fileRef, setFileRef] = useState(null)    // archivo original para storage
    const [uploadURL, setUploadURL] = useState(null)    // URL firmada en Supabase Storage

    const reset = () => {
        setTab('manual'); setMeal('desayuno'); setPhotoURL(null)
        setDetected([]); setChecked([]); setName(''); setQty('100'); setUnit('gramos')
        setKcal(''); setProtein(''); setCarbs(''); setFat('')
        setLoading(false); setAiDone(false); setFileRef(null); setUploadURL(null)
    }
    const handleClose = () => { reset(); onClose() }

    const calcByText = async () => {
        if (!name.trim()) return showToast('Escribe el nombre del alimento')
        setLoading(true)
        try {
            const r = await analyzeFoodByText(name.trim(), Number(qty) || 100, unit)
            setKcal(String(Math.round(r.calories))); setProtein(String(r.protein_g))
            setCarbs(String(r.carbs_g)); setFat(String(r.fat_g)); setAiDone(true)
            showToast('Macros calculados con IA ✓')
        } catch { showToast('Error al calcular') }
        finally { setLoading(false) }
    }

    const onPhotoChange = async (e) => {
        const file = e.target.files?.[0]; if (!file) return
        setPhotoURL(URL.createObjectURL(file))
        setFileRef(file)
        setLoading(true)
        setDetected([])
        setUploadURL(null)

        try {
            // 1. Subir foto a Supabase Storage (en paralelo con el análisis)
            const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg'
            const [geminiResult, storageUrl] = await Promise.allSettled([
                analyzeFoodPhoto(file),
                uploadFoodPhoto(file, ext).catch(err => {
                    console.warn('Storage upload falló (no bloquea):', err.message)
                    return null
                }),
            ])

            // 2. Guardar URL del storage
            const url = storageUrl.status === 'fulfilled' ? storageUrl.value : null
            setUploadURL(url)

            // 3. Procesar resultado de Gemini
            if (geminiResult.status === 'fulfilled') {
                const r = geminiResult.value
                // Inyectar photo_url en cada item detectado
                const itemsWithPhoto = r.items.map(item => ({ ...item, photo_url: url }))
                setDetected(itemsWithPhoto)
                setChecked(itemsWithPhoto.map((_, i) => i))
                if (!itemsWithPhoto.length) showToast('No detecté alimentos')
                else showToast(url ? '📷 Foto guardada en Storage ✓' : 'Foto analizada por IA ✓')
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

    const saveManual = async () => {
        if (!name.trim()) return showToast('Escribe el nombre')
        if (!kcal || Number(kcal) < 0) return showToast('Usa el botón Calcular para obtener calorías')
        setLoading(true)
        try {
            await onSave([{
                food_name: name.trim(), emoji: '🍽️', quantity: Number(qty) || 1, unit,
                calories: Number(kcal) || 0, protein_g: Number(protein) || 0,
                carbs_g: Number(carbs) || 0, fat_g: Number(fat) || 0, source: aiDone ? 'ai-text' : 'manual'
            }], meal)
            handleClose()
        } catch { showToast('Error al guardar') } finally { setLoading(false) }
    }

    const savePhoto = async () => {
        const items = detected.filter((_, i) => checked.includes(i))
        if (!items.length) return showToast('Selecciona al menos uno')
        setLoading(true)
        try { await onSave(items, meal); handleClose() }
        catch { showToast('Error al guardar') } finally { setLoading(false) }
    }

    const MEALS = [
        { key: 'desayuno', label: 'Desayuno', Icon: SunIcon, color: '#FF9F0A' },
        { key: 'almuerzo', label: 'Almuerzo', Icon: UtensilsIcon, color: '#FF375F' },
        { key: 'cena', label: 'Cena', Icon: MoonIcon, color: '#0A84FF' },
        { key: 'snack', label: 'Snack', Icon: AppleIcon, color: '#30D158' },
    ]

    return (
        <Modal open={open} onClose={handleClose} title="Añadir Alimento">
            {/* Chips comida */}
            <div className="flex gap-2 flex-wrap mb-5">
                {MEALS.map(m => (
                    <button key={m.key} onClick={() => setMeal(m.key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
                        style={meal === m.key
                            ? { background: m.color + '20', borderColor: m.color, color: m.color }
                            : { background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: '#8E8EA0' }
                        }
                    >
                        <m.Icon size={12} /> {m.label}
                    </button>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[#0D0D11] rounded-xl p-1 mb-5 border border-[#2E2E3A]">
                {[
                    { key: 'manual', label: 'Manual', Icon: PencilIcon },
                    { key: 'photo', label: 'Foto IA', Icon: CameraIcon },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${tab === t.key ? 'bg-[#1C1C22] text-white border border-[#2E2E3A]' : 'text-[#8E8EA0]'
                            }`}
                    >
                        <t.Icon size={15} />{t.label}
                    </button>
                ))}
            </div>

            {/* ── MANUAL ── */}
            {tab === 'manual' && (
                <div className="space-y-4">

                    {/* Campo de alimento — grande y llamativo */}
                    <div>
                        <label className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest mb-1.5 block">
                            ¿Qué comiste? *
                        </label>
                        <input
                            id="fname"
                            value={name}
                            onChange={e => { setName(e.target.value); if (aiDone) setAiDone(false) }}
                            placeholder="Ej: Pechuga de pollo a la plancha"
                            className="w-full px-4 py-3.5 rounded-xl text-white text-base font-semibold
                                       placeholder-[#454558] focus:outline-none transition-all"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1.5px solid rgba(255,255,255,0.1)',
                            }}
                            onFocus={e => e.target.style.borderColor = '#FF375F'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                    </div>

                    {/* Cantidad + Unidad en una fila compacta */}
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest mb-1.5 block">Cantidad</label>
                            <input type="number" value={qty} onChange={e => setQty(e.target.value)}
                                placeholder="100"
                                className="w-full px-3 py-3 rounded-xl text-white text-sm font-bold text-center focus:outline-none"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.08)' }}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest mb-1.5 block">Unidad</label>
                            <select value={unit} onChange={e => setUnit(e.target.value)}
                                className="w-full px-3 py-3 rounded-xl text-white text-sm font-bold focus:outline-none appearance-none text-center"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.08)' }}
                            >
                                <option value="gramos">gramos</option>
                                <option value="ml">ml</option>
                                <option value="piezas">piezas</option>
                                <option value="tazas">tazas</option>
                                <option value="cucharadas">cucharadas</option>
                                <option value="porciones">porciones</option>
                            </select>
                        </div>
                    </div>

                    {/* Botón IA — GRANDE y vibrante */}
                    <button onClick={calcByText} disabled={loading}
                        className="w-full py-4 rounded-2xl text-sm font-black relative overflow-hidden
                                   transition-all active:scale-[0.98] disabled:opacity-50"
                        style={{
                            background: aiDone
                                ? 'linear-gradient(135deg,#30D158,#1a8f3f)'
                                : 'linear-gradient(135deg,#0A84FF,#BF5AF2)',
                            boxShadow: aiDone
                                ? '0 0 24px rgba(48,209,88,0.4)'
                                : '0 0 24px rgba(10,132,255,0.4)',
                        }}
                    >
                        <div className="flex items-center justify-center gap-2.5">
                            {loading
                                ? <><Spinner /><span className="text-white">Calculando con IA...</span></>
                                : aiDone
                                    ? <><CheckIcon size={17} className="text-white" /><span className="text-white">Recalcular</span></>
                                    : <><SparkIcon size={17} className="text-white" /><span className="text-white">Calcular calorías con Gemini IA</span></>
                            }
                        </div>
                    </button>

                    {/* Resultado IA — CALORÍAS HERO + macros secundarios */}
                    {aiDone && kcal && (
                        <div className="rounded-2xl p-4 relative overflow-hidden"
                            style={{
                                background: 'linear-gradient(135deg, rgba(255,55,95,0.12), rgba(255,107,26,0.08))',
                                border: '1px solid rgba(255,55,95,0.25)',
                            }}>
                            {/* Glow de fondo */}
                            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 pointer-events-none"
                                style={{ background: 'radial-gradient(circle,#FF375F,transparent)' }} />

                            <p className="text-[9px] font-black text-[#8E8EA0] uppercase tracking-widest mb-1">
                                Calorías estimadas
                            </p>

                            {/* Número hero */}
                            <div className="flex items-end gap-2 mb-3">
                                <span className="text-6xl font-black num leading-none"
                                    style={{ color: '#FF375F', textShadow: '0 0 30px rgba(255,55,95,0.5)' }}>
                                    {Math.round(Number(kcal))}
                                </span>
                                <span className="text-base text-[#8E8EA0] mb-2 font-semibold">kcal</span>
                            </div>

                            {/* Macros como chips secundarios */}
                            <div className="flex gap-2 flex-wrap">
                                {[
                                    { label: 'Proteína', val: protein, unit: 'g', color: '#0A84FF' },
                                    { label: 'Carbos', val: carbs, unit: 'g', color: '#FF9F0A' },
                                    { label: 'Grasas', val: fat, unit: 'g', color: '#BF5AF2' },
                                ].map(m => (
                                    <div key={m.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                                        style={{ background: `${m.color}15`, border: `1px solid ${m.color}30` }}>
                                        <span className="text-[10px] text-[#8E8EA0] font-semibold">{m.label}</span>
                                        <span className="text-[11px] font-black num" style={{ color: m.color }}>
                                            {m.val}{m.unit}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Botones acción */}
                    <div className="flex gap-3 pt-1">
                        <OutlineButton onClick={handleClose}>Cancelar</OutlineButton>
                        <PrimaryButton onClick={saveManual} loading={loading}>Guardar</PrimaryButton>
                    </div>
                </div>
            )}


            {/* ── FOTO ── */}
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

                    <label className={`block border-2 border-dashed rounded-2xl cursor-pointer overflow-hidden transition-all
            ${photoURL ? 'border-[#0A84FF]/40' : 'border-[#2E2E3A] hover:border-[#0A84FF]/30'}`}>
                        <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
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

                    {loading && (
                        <div className="flex items-center gap-3 justify-center py-6 text-[#8E8EA0]">
                            <Spinner /> <span className="text-sm">Analizando con IA...</span>
                        </div>
                    )}

                    {!loading && detected.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <p className="text-[9px] font-black text-[#8E8EA0] uppercase tracking-widest mb-3">
                                Alimentos detectados — selecciona los que quieres guardar
                            </p>
                            {detected.map((item, idx) => (
                                <label key={idx}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                    ${checked.includes(idx)
                                            ? 'bg-[#0A84FF]/10 border-[#0A84FF]/40'
                                            : 'bg-[#1C1C22] border-[#2E2E3A]'
                                        }`}>
                                    <input type="checkbox" checked={checked.includes(idx)}
                                        onChange={() => setChecked(p => p.includes(idx) ? p.filter(i => i !== idx) : [...p, idx])}
                                        className="w-4 h-4 accent-[#0A84FF]" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-white">{item.food_name}</p>
                                        <p className="text-[10px] text-[#8E8EA0]">
                                            {item.quantity}{item.unit} · P:{item.protein_g}g C:{item.carbs_g}g G:{item.fat_g}g
                                        </p>
                                    </div>
                                    <span className="text-sm font-black text-[#FF375F] num">{Math.round(item.calories)}</span>
                                </label>
                            ))}
                            <div className="flex gap-3 pt-2">
                                <OutlineButton onClick={handleClose}>Cancelar</OutlineButton>
                                <PrimaryButton onClick={savePhoto} loading={loading}><CheckIcon size={16} />Guardar</PrimaryButton>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD PRINCIPAL
// ════════════════════════════════════════════════════════════════
export default function Dashboard({ config, showToast, onGlassesChange }) {
    const today = todayStr()
    const [foods, setFoods] = useState([])
    const [glasses, setGlasses] = useState(0)
    const [loading, setLoading] = useState(true)   // true → spinner hasta tener datos reales
    const [modal, setModal] = useState(false)
    const [scanner, setScanner] = useState(false)

    const totals = foods.reduce(
        (acc, f) => ({
            cal: acc.cal + Number(f.calories ?? 0),
            protein: acc.protein + Number(f.protein_g ?? 0),
            carbs: acc.carbs + Number(f.carbs_g ?? 0),
            fat: acc.fat + Number(f.fat_g ?? 0),
        }),
        { cal: 0, protein: 0, carbs: 0, fat: 0 }
    )

    const loadData = useCallback(async () => {
        // Timeout de seguridad: si Supabase no responde en 10s, liberar el spinner
        const timeout = setTimeout(() => setLoading(false), 10000)
        try {
            const [f, w] = await Promise.all([getFoodByDate(today), getWaterByDate(today)])
            setFoods(f ?? [])
            const g = w?.glasses ?? 0
            setGlasses(g)
            onGlassesChange?.(g) // Actualizar ref para recordatorio de agua
        } catch (e) { console.error('loadData error:', e) }
        finally {
            clearTimeout(timeout)
            setLoading(false)
        }
    }, [today, onGlassesChange])

    useEffect(() => { loadData() }, [loadData])

    const handleSave = async (items, mealType) => {
        for (const item of items) {
            const foodPayload = { ...item, log_date: today, meal_type: mealType }
            await withOfflineFallback(
                () => addFood(foodPayload),
                'addFood',
                foodPayload,
            )
            await withOfflineFallback(
                () => logActivity('food_add', {
                    food_name: item.food_name ?? item.name,
                    calories: item.calories,
                    meal_type: mealType,
                }),
                'logActivity',
                { type: 'food_add', metadata: { food_name: item.food_name ?? item.name, calories: item.calories, meal_type: mealType } },
            )
        }
        await loadData()
        showToast(navigator.onLine
            ? `${items.length > 1 ? items.length + ' alimentos añadidos' : 'Alimento registrado'}`
            : '📦 Guardado offline — se sincronizará')
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este alimento?')) return
        try {
            // Buscar el alimento para registrar info antes de eliminarlo
            const food = foods.find(f => f.id === id)
            await deleteFood(id)
            if (food) {
                logActivity('food_delete', {
                    food_name: food.food_name,
                    calories: food.calories,
                })
            }
            await loadData()
            showToast('Eliminado')
        }
        catch { showToast('Error al eliminar') }
    }

    // Guard contra doble-tap rápido en vasos de agua
    const waterBusy = useRef(false)

    const handleWater = async (g) => {
        if (waterBusy.current) return  // Ignorar taps mientras se procesa
        waterBusy.current = true
        const prev = glasses
        setGlasses(g)
        onGlassesChange?.(g) // Actualizar ref para recordatorio
        try {
            await withOfflineFallback(
                () => setWaterGlasses(today, g),
                'setWater',
                { date: today, glasses: g },
            )
            // Si subió (no bajó), registrar el vaso individual
            if (g > prev) {
                await withOfflineFallback(
                    () => logActivity('water', { glass_number: g, total_ml: g * 250 }),
                    'logActivity',
                    { type: 'water', metadata: { glass_number: g, total_ml: g * 250 } },
                )
            }
        } catch { /* fallback ya encoló */ }
        waterBusy.current = false
        if (g >= (config?.water_goal ?? 8)) showToast('¡Meta de agua alcanzada! 💧')
    }

    const dateLabel = new Date().toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long'
    })

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Spinner />
        </div>
    )

    return (
        <div className="animate-fade-up">

            {/* Fecha */}
            <p className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest mb-1 px-0.5 capitalize">
                {dateLabel}
            </p>

            {/* Activity Rings */}
            <div className="card mb-3 flex flex-col items-center">
                <ActivityRings
                    calories={totals.cal}
                    calorieGoal={config?.calorie_goal ?? 2000}
                    protein={totals.protein}
                    water={glasses}
                    waterGoal={config?.water_goal ?? 8}
                />
            </div>

            {/* Macro Cards */}
            <MacroCards
                calories={totals.cal}
                protein={totals.protein}
                carbs={totals.carbs}
                fat={totals.fat}
                goal={config?.calorie_goal ?? 2000}
            />

            {/* Agua */}
            <WaterTracker glasses={glasses} goal={config?.water_goal ?? 8} onChange={handleWater} />

            {/* Ayuno intermitente */}
            <FastingTracker showToast={showToast} />

            {/* Lista alimentos */}
            <div className="card p-4">
                <h3 className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest mb-3">
                    Alimentos de hoy
                </h3>
                <FoodList foods={foods} onDelete={handleDelete} />
            </div>

            {/* FAB */}
            <button
                onClick={() => setModal(true)}
                className="fixed bottom-24 right-4 w-14 h-14 rounded-full z-20
                   flex items-center justify-center shadow-2xl
                   active:scale-90 transition-all"
                style={{
                    background: 'linear-gradient(135deg,#FF6B1A,#FF9F0A)',
                    boxShadow: '0 0 28px rgba(255,107,26,0.55)',
                }}
            >
                <PlusIcon size={26} className="text-white" />
            </button>

            {/* Modal añadir */}
            <AddFoodModal
                open={modal}
                onClose={() => setModal(false)}
                onSave={handleSave}
                showToast={showToast}
                onOpenScanner={() => setScanner(true)}
            />

            {/* Scanner cámara */}
            <CameraScanner
                open={scanner}
                onClose={() => setScanner(false)}
                onSave={items => handleSave(items, 'otro')}
                showToast={showToast}
            />
        </div>
    )
}
