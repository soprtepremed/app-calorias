import { useEffect, useState, useCallback } from 'react'
import { getFoodByDate, getWaterByDate, addFood, deleteFood, setWaterGlasses, todayStr } from '../services/supabase'
import { analyzeFoodPhoto, analyzeFoodByText } from '../services/gemini'
import { Card, Modal, FormInput, Chip, EmptyState, SectionTitle, PrimaryButton, OutlineButton, StatBadge, Spinner } from './UI'
import {
    FlameIcon, DropIcon, TrashIcon, CameraIcon, PencilIcon,
    SparkIcon, CheckIcon, MEAL_ICONS, MEAL_LABELS,
    SunIcon, UtensilsIcon, MoonIcon, AppleIcon, PlusIcon
} from './Icons'

// ── Círculo SVG de calorías ───────────────────────────────────────────────
function CalorieRing({ consumed, goal }) {
    const R = 70
    const CIRCUM = 2 * Math.PI * R
    const pct = Math.min(consumed / Math.max(goal, 1), 1)
    const offset = CIRCUM - pct * CIRCUM
    const color = pct >= 1 ? '#EF4444' : pct >= 0.85 ? '#F97316' : '#FF6B1A'
    const remaining = Math.max(goal - consumed, 0)

    return (
        <div className="flex flex-col items-center py-6">
            <div className="relative w-44 h-44">
                <svg width="176" height="176" viewBox="0 0 176 176">
                    {/* Track */}
                    <circle cx="88" cy="88" r={R} fill="none" stroke="#2A2B38" strokeWidth={12} />
                    {/* Progress */}
                    <circle
                        cx="88" cy="88" r={R}
                        fill="none"
                        stroke={color}
                        strokeWidth={12}
                        strokeLinecap="round"
                        strokeDasharray={CIRCUM}
                        strokeDashoffset={offset}
                        className="progress-ring"
                        style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
                    />
                </svg>
                {/* Centro */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-white leading-none tracking-tight">
                        {Math.round(consumed).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold text-[#7B7D94] uppercase tracking-widest mt-1">kcal</span>
                </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-8 mt-4">
                <StatBadge value={goal.toLocaleString()} label="Meta" color="#7B7D94" />
                <div className="w-px h-8 bg-[#2A2B38]" />
                <StatBadge
                    value={consumed > goal ? `+${Math.round(consumed - goal)}` : Math.round(remaining).toLocaleString()}
                    label={consumed > goal ? 'Exceso' : 'Restantes'}
                    color={consumed > goal ? '#EF4444' : '#00E5A0'}
                />
            </div>
        </div>
    )
}

// ── Macros Row ────────────────────────────────────────────────────────────
function MacrosRow({ protein, carbs, fat }) {
    const macros = [
        { label: 'Proteína', value: protein, color: '#3B82F6', unit: 'g' },
        { label: 'Carbos', value: carbs, color: '#F97316', unit: 'g' },
        { label: 'Grasa', value: fat, color: '#A855F7', unit: 'g' },
    ]
    return (
        <div className="grid grid-cols-3 gap-2 mb-3">
            {macros.map(m => (
                <div key={m.label} className="bg-[#1C1D27] rounded-xl p-3 text-center border border-[#2A2B38]">
                    <div className="text-lg font-black leading-none" style={{ color: m.color }}>
                        {Math.round(m.value)}<span className="text-xs font-semibold text-[#7B7D94]">g</span>
                    </div>
                    <div className="text-[9px] font-bold text-[#7B7D94] uppercase tracking-widest mt-1">{m.label}</div>
                </div>
            ))}
        </div>
    )
}

// ── Water Tracker ─────────────────────────────────────────────────────────
function WaterTracker({ glasses, goal, onChange }) {
    return (
        <Card className="mb-3">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <DropIcon size={16} className="text-[#00E5A0]" />
                    <SectionTitle className="mb-0">Agua</SectionTitle>
                </div>
                <span className="text-xs text-[#7B7D94] font-semibold">{glasses * 250} / {goal * 250} ml</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: goal }).map((_, i) => (
                    <button
                        key={i}
                        onClick={() => onChange(i + 1 === glasses ? i : i + 1)}
                        className={`
              flex-1 min-w-7 h-8 rounded-lg border transition-all duration-200 flex items-center justify-center
              ${i < glasses
                                ? 'bg-[#00E5A0]/20 border-[#00E5A0] shadow-sm shadow-[#00E5A0]/20'
                                : 'bg-[#1C1D27] border-[#2A2B38]'
                            }
            `}
                    >
                        <DropIcon
                            size={14}
                            className={i < glasses ? 'text-[#00E5A0]' : 'text-[#2A2B38]'}
                        />
                    </button>
                ))}
            </div>
            {glasses >= goal && (
                <div className="flex items-center gap-1.5 mt-2 text-[#00E5A0] text-xs font-bold">
                    <CheckIcon size={13} /> Meta de agua alcanzada
                </div>
            )}
        </Card>
    )
}

// ── Food List ─────────────────────────────────────────────────────────────
function FoodList({ foods, onDelete }) {
    if (foods.length === 0) {
        return (
            <EmptyState
                icon={FlameIcon}
                text={`Sin registros hoy.\nToca + para añadir un alimento.`}
            />
        )
    }

    // Agrupar por meal_type
    const grouped = {}
    foods.forEach(f => {
        const k = f.meal_type ?? 'otro'
        if (!grouped[k]) grouped[k] = []
        grouped[k].push(f)
    })

    const order = ['desayuno', 'almuerzo', 'cena', 'snack', 'otro']

    return (
        <div className="space-y-4">
            {order.map(meal => {
                const items = grouped[meal]
                if (!items?.length) return null
                const MealIcon = MEAL_ICONS[meal] ?? UtensilsIcon
                const totalKcal = items.reduce((s, f) => s + Number(f.calories ?? 0), 0)

                return (
                    <div key={meal}>
                        {/* Meal header */}
                        <div className="flex items-center gap-2 mb-2">
                            <MealIcon size={14} className="text-[#FF6B1A]" />
                            <span className="text-xs font-black text-[#7B7D94] uppercase tracking-widest">
                                {MEAL_LABELS[meal]}
                            </span>
                            <div className="flex-1 h-px bg-[#2A2B38]" />
                            <span className="text-xs font-bold text-[#FF6B1A]">{Math.round(totalKcal)} kcal</span>
                        </div>

                        {/* Items */}
                        <div className="space-y-1.5">
                            {items.map(food => (
                                <div key={food.id}
                                    className="flex items-center gap-3 bg-[#1C1D27] rounded-xl px-3 py-2.5
                             border border-[#2A2B38] group hover:border-[#FF6B1A]/30 transition-colors"
                                >
                                    {/* Nombre + detalle */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{food.food_name}</p>
                                        <p className="text-[10px] text-[#7B7D94] font-medium mt-0.5">
                                            {food.quantity} {food.unit}
                                            {' · '}P:{Math.round(food.protein_g ?? 0)}g
                                            {' '}C:{Math.round(food.carbs_g ?? 0)}g
                                            {' '}G:{Math.round(food.fat_g ?? 0)}g
                                        </p>
                                    </div>
                                    {/* Kcal */}
                                    <span className="text-sm font-black text-[#FF6B1A] shrink-0">
                                        {Math.round(food.calories)}
                                    </span>
                                    {/* Eliminar */}
                                    <button
                                        onClick={() => onDelete(food.id)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg
                               text-[#2A2B38] hover:bg-red-500/20 hover:text-red-400
                               opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <TrashIcon size={14} />
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

// ── Modal Añadir Alimento ──────────────────────────────────────────────────
function AddFoodModal({ open, onClose, onSave, showToast }) {
    const [meal, setMeal] = useState('desayuno')
    const [tab, setTab] = useState('manual')   // 'manual' | 'photo'
    const [loading, setLoading] = useState(false)
    const [photoURL, setPhotoURL] = useState(null)
    const [detected, setDetected] = useState([])         // items de Gemini
    const [checked, setChecked] = useState([])         // índices seleccionados

    // Form manual
    const [name, setName] = useState('')
    const [qty, setQty] = useState('100')
    const [unit, setUnit] = useState('gramos')
    const [kcal, setKcal] = useState('')
    const [protein, setProtein] = useState('')
    const [carbs, setCarbs] = useState('')
    const [fat, setFat] = useState('')
    const [aiDone, setAiDone] = useState(false)

    const reset = () => {
        setTab('manual'); setMeal('desayuno'); setPhotoURL(null)
        setDetected([]); setChecked([]); setName(''); setQty('100'); setUnit('gramos')
        setKcal(''); setProtein(''); setCarbs(''); setFat(''); setLoading(false); setAiDone(false)
    }

    const handleClose = () => { reset(); onClose() }

    // ── Calcular macros automáticamente por texto ─────────────────────────
    const calcByText = async () => {
        if (!name.trim()) return showToast('Escribe el nombre del alimento')
        setLoading(true)
        try {
            const r = await analyzeFoodByText(name.trim(), Number(qty) || 100, unit)
            setKcal(String(Math.round(r.calories)))
            setProtein(String(r.protein_g))
            setCarbs(String(r.carbs_g))
            setFat(String(r.fat_g))
            setAiDone(true)
            showToast('Macros calculados con IA')
        } catch (e) {
            showToast('Error al calcular — verifica tu conexión')
        } finally {
            setLoading(false)
        }
    }

    // ── Foto → Gemini ─────────────────────────────────────────────────────
    const onPhotoChange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setPhotoURL(URL.createObjectURL(file))
        setLoading(true)
        setDetected([])
        try {
            const r = await analyzeFoodPhoto(file)
            setDetected(r.items)
            setChecked(r.items.map((_, i) => i))   // todos seleccionados por defecto
            if (r.items.length === 0) showToast('No detecté alimentos — sube otra foto')
        } catch (e) {
            showToast('Error al analizar la foto')
        } finally {
            setLoading(false)
            e.target.value = ''
        }
    }

    // ── Guardar ───────────────────────────────────────────────────────────
    const saveManual = async () => {
        if (!name.trim()) return showToast('Escribe el nombre')
        if (!kcal || Number(kcal) < 0) return showToast('Ingresa las calorías o usa calcular')
        setLoading(true)
        try {
            await onSave([{
                food_name: name.trim(), emoji: '🍽️',
                quantity: Number(qty) || 1, unit,
                calories: Number(kcal) || 0, protein_g: Number(protein) || 0,
                carbs_g: Number(carbs) || 0, fat_g: Number(fat) || 0,
                source: aiDone ? 'ai-text' : 'manual',
            }], meal)
            handleClose()
        } catch { showToast('Error al guardar') }
        finally { setLoading(false) }
    }

    const savePhoto = async () => {
        const items = detected.filter((_, i) => checked.includes(i))
        if (!items.length) return showToast('Selecciona al menos un alimento')
        setLoading(true)
        try {
            await onSave(items, meal)
            handleClose()
        } catch { showToast('Error al guardar') }
        finally { setLoading(false) }
    }

    const MEALS = [
        { key: 'desayuno', label: 'Desayuno', Icon: SunIcon },
        { key: 'almuerzo', label: 'Almuerzo', Icon: UtensilsIcon },
        { key: 'cena', label: 'Cena', Icon: MoonIcon },
        { key: 'snack', label: 'Snack', Icon: AppleIcon },
    ]

    return (
        <Modal open={open} onClose={handleClose} title="Añadir Alimento">

            {/* Chips comida */}
            <div className="mb-5">
                <p className="text-[10px] font-bold text-[#7B7D94] uppercase tracking-widest mb-2">Tipo de comida</p>
                <div className="flex gap-2 flex-wrap">
                    {MEALS.map(m => (
                        <Chip key={m.key} selected={meal === m.key} onClick={() => setMeal(m.key)} icon={m.Icon}>
                            {m.label}
                        </Chip>
                    ))}
                </div>
            </div>

            {/* Tabs Manual / Foto */}
            <div className="flex gap-1 bg-[#1C1D27] rounded-xl p-1 mb-5">
                {[
                    { key: 'manual', label: 'Manual', Icon: PencilIcon },
                    { key: 'photo', label: 'Foto IA', Icon: CameraIcon },
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`
              flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
              text-sm font-bold transition-all
              ${tab === t.key
                                ? 'bg-[#FF6B1A] text-white shadow-lg shadow-[#FF6B1A]/30'
                                : 'text-[#7B7D94] hover:text-white'
                            }
            `}
                    >
                        <t.Icon size={15} /> {t.label}
                    </button>
                ))}
            </div>

            {/* ── TAB MANUAL ── */}
            {tab === 'manual' && (
                <div>
                    <FormInput label="Nombre del alimento *" id="food-name"
                        value={name} onChange={e => { setName(e.target.value); setAiDone(false) }}
                        placeholder="Ej: Pechuga de pollo a la plancha"
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <FormInput label="Cantidad" id="food-qty" type="number" value={qty}
                            onChange={e => { setQty(e.target.value); setAiDone(false) }} placeholder="100" />
                        <FormInput label="Unidad" id="food-unit" value={unit}
                            onChange={e => { setUnit(e.target.value) }} placeholder="gramos" />
                    </div>

                    {/* Botón calcular IA */}
                    <button
                        onClick={calcByText}
                        disabled={loading}
                        className={`
              w-full flex items-center justify-center gap-2 py-3 rounded-xl mb-4
              text-sm font-bold border transition-all
              ${aiDone
                                ? 'bg-[#00E5A0]/10 border-[#00E5A0] text-[#00E5A0]'
                                : 'bg-[#FF6B1A]/10 border-[#FF6B1A]/50 text-[#FF6B1A] hover:bg-[#FF6B1A]/20'
                            }
              disabled:opacity-50
            `}
                    >
                        {loading ? <Spinner size="sm" /> : <SparkIcon size={15} />}
                        {aiDone ? 'Macros calculados — edita si quieres' : 'Calcular con IA (Gemini)'}
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                        <FormInput label="Calorías (kcal) *" id="food-kcal" type="number"
                            value={kcal} onChange={e => setKcal(e.target.value)} placeholder="0" />
                        <FormInput label="Proteína (g)" id="food-protein" type="number"
                            value={protein} onChange={e => setProtein(e.target.value)} placeholder="0" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <FormInput label="Carbos (g)" id="food-carbs" type="number"
                            value={carbs} onChange={e => setCarbs(e.target.value)} placeholder="0" />
                        <FormInput label="Grasa (g)" id="food-fat" type="number"
                            value={fat} onChange={e => setFat(e.target.value)} placeholder="0" />
                    </div>

                    <div className="flex gap-3 mt-2">
                        <OutlineButton onClick={handleClose}>Cancelar</OutlineButton>
                        <PrimaryButton onClick={saveManual} loading={loading}>Guardar</PrimaryButton>
                    </div>
                </div>
            )}

            {/* ── TAB FOTO ── */}
            {tab === 'photo' && (
                <div>
                    {/* Zona de foto */}
                    <label
                        className={`
              block border-2 border-dashed rounded-2xl cursor-pointer
              transition-all duration-200 overflow-hidden
              ${photoURL ? 'border-[#FF6B1A]/60' : 'border-[#2A2B38] hover:border-[#FF6B1A]/40'}
            `}
                    >
                        <input type="file" accept="image/*" capture="environment"
                            className="hidden" onChange={onPhotoChange} />
                        {photoURL ? (
                            <img src={photoURL} alt="preview"
                                className="w-full max-h-52 object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-[#7B7D94]">
                                <CameraIcon size={36} className="mb-3 opacity-50" />
                                <p className="text-sm font-semibold">Toca para tomar foto o elegir de galería</p>
                                <p className="text-xs mt-1 opacity-60">Gemini detecta automáticamente</p>
                            </div>
                        )}
                    </label>

                    {/* Spinner análisis */}
                    {loading && (
                        <div className="flex items-center gap-3 justify-center py-6 text-[#7B7D94]">
                            <Spinner /> <span className="text-sm font-semibold">Analizando con IA...</span>
                        </div>
                    )}

                    {/* Lista detectados */}
                    {!loading && detected.length > 0 && (
                        <div className="mt-4">
                            <p className="text-[10px] font-bold text-[#7B7D94] uppercase tracking-widest mb-3">
                                Alimentos detectados — selecciona los que quieres guardar
                            </p>
                            <div className="space-y-2">
                                {detected.map((item, idx) => (
                                    <label key={idx}
                                        className={`
                      flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                      ${checked.includes(idx)
                                                ? 'bg-[#FF6B1A]/10 border-[#FF6B1A]/50'
                                                : 'bg-[#1C1D27] border-[#2A2B38]'
                                            }
                    `}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked.includes(idx)}
                                            onChange={() =>
                                                setChecked(prev =>
                                                    prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                                )
                                            }
                                            className="w-4 h-4 accent-[#FF6B1A]"
                                        />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-white">{item.food_name}</p>
                                            <p className="text-[10px] text-[#7B7D94]">
                                                {item.quantity} {item.unit}
                                                · P:{item.protein_g}g C:{item.carbs_g}g G:{item.fat_g}g
                                            </p>
                                        </div>
                                        <span className="text-sm font-black text-[#FF6B1A]">
                                            {Math.round(item.calories)} kcal
                                        </span>
                                    </label>
                                ))}
                            </div>
                            <div className="flex gap-3 mt-4">
                                <OutlineButton onClick={handleClose}>Cancelar</OutlineButton>
                                <PrimaryButton onClick={savePhoto} loading={loading}>
                                    <CheckIcon size={16} /> Guardar
                                </PrimaryButton>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}

// ── Dashboard principal ───────────────────────────────────────────────────
export default function Dashboard({ config, showToast }) {
    const today = todayStr()
    const [foods, setFoods] = useState([])
    const [glasses, setGlasses] = useState(0)
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState(false)

    // Totales calculados del día
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
        try {
            const [f, w] = await Promise.all([
                getFoodByDate(today),
                getWaterByDate(today),
            ])
            setFoods(f ?? [])
            setGlasses(w?.glasses ?? 0)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [today])

    useEffect(() => { loadData() }, [loadData])

    // Guardar alimento(s)
    const handleSave = async (items, mealType) => {
        for (const item of items) {
            await addFood({ ...item, log_date: today, meal_type: mealType })
        }
        await loadData()
        showToast(`${items.length > 1 ? items.length + ' alimentos' : 'Alimento'} registrado`)
    }

    // Eliminar alimento
    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este alimento?')) return
        try {
            await deleteFood(id)
            await loadData()
            showToast('Alimento eliminado')
        } catch { showToast('Error al eliminar') }
    }

    // Actualizar agua
    const handleWater = async (g) => {
        setGlasses(g)
        try { await setWaterGlasses(today, g) } catch { }
        if (g >= (config?.water_goal ?? 8)) showToast('¡Meta de agua alcanzada!')
    }

    // Fecha legible
    const dateLabel = new Date().toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long'
    })

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        )
    }

    return (
        <div className="animate-fade-up">

            {/* Fecha */}
            <p className="text-[11px] font-bold text-[#7B7D94] uppercase tracking-widest px-1 mb-1 capitalize">
                {dateLabel}
            </p>

            {/* Círculo calorías */}
            <Card className="mb-3 flex flex-col items-center">
                <CalorieRing consumed={totals.cal} goal={config?.calorie_goal ?? 2000} />
            </Card>

            {/* Macros */}
            <MacrosRow protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />

            {/* Agua */}
            <WaterTracker
                glasses={glasses}
                goal={config?.water_goal ?? 8}
                onChange={handleWater}
            />

            {/* Lista alimentos */}
            <Card>
                <SectionTitle>Alimentos de hoy</SectionTitle>
                <FoodList foods={foods} onDelete={handleDelete} />
            </Card>

            {/* FAB */}
            <button
                onClick={() => setModal(true)}
                className="fixed bottom-24 right-4 w-14 h-14 rounded-full
                   bg-[#FF6B1A] text-white shadow-2xl shadow-[#FF6B1A]/40
                   flex items-center justify-center z-20
                   hover:bg-[#E55A0A] active:scale-90 transition-all"
            >
                <PlusIcon size={26} />
            </button>

            {/* Modal añadir */}
            <AddFoodModal
                open={modal}
                onClose={() => setModal(false)}
                onSave={handleSave}
                showToast={showToast}
            />
        </div>
    )
}
