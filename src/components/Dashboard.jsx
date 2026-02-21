import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, getFoodByDate, getWaterByDate, addFood, deleteFood, setWaterGlasses, todayStr, logActivity } from '../services/supabase'
import { withOfflineFallback } from '../services/offlineQueue'
import { EmptyState, Spinner } from './UI'
import FastingTracker from './FastingTracker'
import WaterTracker from './WaterTracker'
import AddFoodModal from './AddFoodModal'
import {
    FlameIcon, DropIcon, TrashIcon, PlusIcon,
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

// WaterTracker ahora es importado desde ./WaterTracker.jsx



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
// DASHBOARD PRINCIPAL
// ════════════════════════════════════════════════════════════════
export default function Dashboard({ config, showToast, onGlassesChange, onOpenScanner }) {
    const today = todayStr()
    const [foods, setFoods] = useState([])
    const [glasses, setGlasses] = useState(0)
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState(false)

    const totals = foods.reduce(
        (acc, f) => ({
            cal: acc.cal + Number(f.calories ?? 0),
            protein: acc.protein + Number(f.protein_g ?? 0),
            carbs: acc.carbs + Number(f.carbs_g ?? 0),
            fat: acc.fat + Number(f.fat_g ?? 0),
        }),
        { cal: 0, protein: 0, carbs: 0, fat: 0 }
    )

    // ── Función para obtener datos de Supabase ──────────────────────
    // Con persistSession:false, Dashboard solo se renderiza después del login
    // → JWT siempre está listo, no necesitamos retry
    const loadData = useCallback(async () => {
        try {
            const [f, w] = await Promise.all([getFoodByDate(today), getWaterByDate(today)])
            setFoods(f ?? [])
            const g = w?.glasses ?? 0
            setGlasses(g)
            onGlassesChange?.(g)
        } catch (e) { console.error('loadData error:', e) }
        finally { setLoading(false) }
    }, [today, onGlassesChange])

    // ── Carga inicial + Supabase Realtime para sync en vivo ───────────
    useEffect(() => {
        loadData()

        // Realtime: cuando food_log o water_log cambian → recarga automática
        const channel = supabase
            .channel('dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'food_log' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'water_log' }, () => loadData())
            .subscribe()

        return () => supabase.removeChannel(channel)
    }, [loadData])

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

    // Escuchar evento del scanner (viene de App.jsx via CustomEvent)
    useEffect(() => {
        const handler = (e) => handleSave(e.detail, 'otro')
        window.addEventListener('scanner-save', handler)
        return () => window.removeEventListener('scanner-save', handler)
    }, [handleSave])

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
        if (g >= (config?.water_goal ?? 12)) showToast('¡Meta de agua alcanzada! 💧')
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
                    waterGoal={config?.water_goal ?? 12}
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
            <WaterTracker glasses={glasses} goal={config?.water_goal ?? 12} onChange={handleWater} />

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
                onOpenScanner={onOpenScanner}
            />
        </div>
    )
}
