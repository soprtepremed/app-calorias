/**
 * ConfirmStep.jsx — Paso de confirmación antes de guardar un alimento.
 *
 * Muestra:
 * - Header con tipo de comida seleccionado
 * - Card de resumen con calorías HERO y macros como chips
 * - En modo foto: input editable para ajustar la porción real
 * - En modo manual: resumen de la porción descrita
 * - Botones "Volver" y "Confirmar y Guardar"
 *
 * Props:
 *   tab             — 'manual' | 'photo'
 *   activeMeal      — { key, label, emoji, color }
 *   name            — nombre del alimento (modo manual)
 *   qty             — cantidad (modo manual)
 *   unit            — unidad (modo manual)
 *   kcal            — calorías (modo manual)
 *   protein         — proteína (modo manual)
 *   carbs           — carbohidratos (modo manual)
 *   fat             — grasa (modo manual)
 *   aiExplanation   — explicación IA (modo manual)
 *   editingItem     — item en edición (modo foto)
 *   onUpdateQty     — (value) => void (modo foto)
 *   onBack          — () => void
 *   onConfirm       — () => void
 *   loading         — boolean
 */
import { CheckIcon } from './Icons'
import { PrimaryButton, OutlineButton } from './UI'

export default function ConfirmStep({
    tab, activeMeal,
    // Props modo manual
    name, qty, unit, kcal, protein, carbs, fat, aiExplanation,
    // Props modo foto
    editingItem, onUpdateQty,
    // Acciones
    onBack, onConfirm, loading,
}) {
    // Valores según el modo activo
    const displayName = tab === 'photo' && editingItem ? editingItem.food_name : name
    const displayKcal = tab === 'photo' && editingItem ? editingItem.calories : kcal
    const displayProtein = tab === 'photo' && editingItem ? editingItem.protein_g : protein
    const displayCarbs = tab === 'photo' && editingItem ? editingItem.carbs_g : carbs
    const displayFat = tab === 'photo' && editingItem ? editingItem.fat_g : fat

    return (
        <div className="space-y-4 animate-fade-up">
            {/* Header con tipo de comida */}
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{activeMeal.emoji}</span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: activeMeal.color }}>
                    {activeMeal.label}
                </span>
            </div>

            {/* Card de resumen */}
            <div className="rounded-2xl p-5 relative overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, rgba(255,55,95,0.12), rgba(255,107,26,0.06))',
                    border: '1px solid rgba(255,55,95,0.2)',
                }}>
                {/* Glow de fondo */}
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 pointer-events-none"
                    style={{ background: 'radial-gradient(circle,#FF375F,transparent)' }} />

                {/* Nombre del alimento */}
                <p className="text-white font-bold text-base mb-1">
                    {displayName}
                </p>

                {/* Porción - editable en modo foto */}
                {tab === 'photo' && editingItem ? (
                    <div className="mb-4">
                        <p className="text-[10px] text-[#8E8EA0] mb-2">
                            La IA estimó {editingItem.originalQty}{editingItem.unit}. ¿Cuánto comiste realmente?
                        </p>
                        <div className="flex gap-3 items-center">
                            <input
                                type="number"
                                inputMode="numeric"
                                value={editingItem.quantity}
                                onChange={e => onUpdateQty(e.target.value)}
                                className="w-24 px-3 py-2 rounded-xl text-white text-sm font-bold text-center focus:outline-none"
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1.5px solid rgba(255,55,95,0.3)',
                                }}
                            />
                            <span className="text-sm text-[#8E8EA0] font-semibold">
                                {editingItem.unit}
                            </span>
                        </div>
                    </div>
                ) : (
                    <p className="text-[11px] text-[#8E8EA0] mb-4">
                        {aiExplanation || `${qty} ${unit}`}
                    </p>
                )}

                {/* Calorías HERO */}
                <p className="text-[9px] font-black text-[#8E8EA0] uppercase tracking-widest mb-1">
                    Calorías estimadas
                </p>
                <div className="flex items-end gap-2 mb-4">
                    <span className="text-5xl font-black num leading-none"
                        style={{ color: '#FF375F', textShadow: '0 0 30px rgba(255,55,95,0.5)' }}>
                        {Math.round(Number(displayKcal))}
                    </span>
                    <span className="text-base text-[#8E8EA0] mb-1.5 font-semibold">kcal</span>
                </div>

                {/* Macros como chips */}
                <div className="flex gap-2 flex-wrap">
                    {[
                        { label: 'Proteína', val: displayProtein, color: '#0A84FF' },
                        { label: 'Carbos', val: displayCarbs, color: '#FF9F0A' },
                        { label: 'Grasas', val: displayFat, color: '#BF5AF2' },
                    ].map(m => (
                        <div key={m.label}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                            style={{ background: `${m.color}15`, border: `1px solid ${m.color}30` }}>
                            <span className="text-[10px] text-[#8E8EA0] font-semibold">{m.label}</span>
                            <span className="text-[11px] font-black num" style={{ color: m.color }}>
                                {Math.round(Number(m.val) * 10) / 10}g
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-3 pt-1">
                <OutlineButton onClick={onBack}>
                    ← Volver
                </OutlineButton>
                <PrimaryButton
                    onClick={onConfirm}
                    loading={loading}
                >
                    <CheckIcon size={16} /> Confirmar y Guardar
                </PrimaryButton>
            </div>
        </div>
    )
}
