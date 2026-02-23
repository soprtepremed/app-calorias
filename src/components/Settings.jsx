import { useState } from 'react'
import { updateConfig } from '../services/supabase'
import { requestNotificationPermission, startWaterReminder, stopWaterReminder } from '../services/water'
import { Card, FormInput, SectionTitle, PrimaryButton } from './UI'
import { SettingsIcon, BellIcon, FlameIcon, DropIcon, InfoIcon, ScaleIcon, ActivityIcon, MuscleIcon } from './Icons'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Color e ícono para la categoría de IMC */
function bmiBadge(cat) {
    const MAP = {
        'Bajo peso': { color: '#5AC8FA', bg: 'rgba(90,200,250,0.12)' },
        'Normal': { color: '#30D158', bg: 'rgba(48,209,88,0.12)' },
        'Sobrepeso': { color: '#FF9F0A', bg: 'rgba(255,159,10,0.12)' },
        'Obesidad I': { color: '#FF6B1A', bg: 'rgba(255,107,26,0.12)' },
        'Obesidad II': { color: '#FF375F', bg: 'rgba(255,55,95,0.12)' },
        'Obesidad III': { color: '#FF375F', bg: 'rgba(255,55,95,0.12)' },
    }
    return MAP[cat] ?? { color: '#8E8EA0', bg: 'rgba(142,142,160,0.1)' }
}

const ACTIVITY_LABELS = {
    sedentary: 'Sedentario',
    light: 'Ligero (1-3 días/sem)',
    moderate: 'Moderado (3-5 días/sem)',
    active: 'Activo (6-7 días/sem)',
    very_active: 'Muy activo (2x/día)',
}

const SEX_LABELS = { male: 'Masculino', female: 'Femenino', other: 'Otro / No especificado' }

// ── Fila de dato de solo-lectura ─────────────────────────────────────────────
function ProfileRow({ label, value, unit, accent = '#8E8EA0' }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-[#1E1E28] last:border-0">
            <span className="text-[11px] text-[#8E8EA0] font-semibold">{label}</span>
            <span className="text-sm font-black num" style={{ color: accent }}>
                {value ?? '—'}{unit && value != null ? <span className="text-[10px] font-normal text-[#8E8EA0] ml-0.5">{unit}</span> : ''}
            </span>
        </div>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function Settings({ config, configId, onConfigUpdate, showToast }) {
    const [name, setName] = useState(config?.name ?? 'Usuario')
    const [calGoal, setCalGoal] = useState(String(config?.calorie_goal ?? 2000))
    const [waterGoal, setWaterGoal] = useState(String(config?.water_goal ?? 8))
    const [waterInt, setWaterInt] = useState(String(config?.water_reminder_hours ?? 2))
    const [notifOn, setNotifOn] = useState(config?.notifications_enabled ?? true)
    const [saving, setSaving] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    // ── Estado editable para datos biométricos ──────────────────────────
    const [weightKg, setWeightKg] = useState(String(config?.weight_kg ?? ''))
    const [heightCm, setHeightCm] = useState(String(config?.height_cm ?? ''))
    const [age, setAge] = useState(String(config?.age ?? ''))
    const [sex, setSex] = useState(config?.sex ?? '')
    const [activityLevel, setActivityLevel] = useState(config?.activity_level ?? 'moderate')

    // ── BMI calculado en tiempo real ────────────────────────────────────
    const w = parseFloat(weightKg)
    const h = parseFloat(heightCm)
    const liveBmi = (w > 0 && h > 0) ? (w / ((h / 100) ** 2)).toFixed(1) : null
    const liveBmiCat = liveBmi
        ? liveBmi < 18.5 ? 'Bajo peso'
            : liveBmi < 25 ? 'Normal'
                : liveBmi < 30 ? 'Sobrepeso'
                    : liveBmi < 35 ? 'Obesidad I'
                        : liveBmi < 40 ? 'Obesidad II'
                            : 'Obesidad III'
        : null
    const badge = bmiBadge(liveBmiCat)
    const initial = (config?.name ?? 'U')[0].toUpperCase()

    const handleSave = async () => {
        setSaving(true)
        try {
            const bmiVal = (w > 0 && h > 0) ? parseFloat((w / ((h / 100) ** 2)).toFixed(2)) : null
            const payload = {
                name: name.trim() || 'Usuario',
                calorie_goal: parseInt(calGoal) || 2000,
                water_goal: parseInt(waterGoal) || 8,
                water_reminder_hours: parseInt(waterInt) || 2,
                notifications_enabled: notifOn,
                weight_kg: w > 0 ? w : null,
                height_cm: h > 0 ? h : null,
                age: parseInt(age) > 0 ? parseInt(age) : null,
                sex: sex || null,
                activity_level: activityLevel || 'moderate',
                bmi: bmiVal,
            }
            await updateConfig(configId, payload)
            onConfigUpdate(payload)

            if (notifOn) {
                const granted = await requestNotificationPermission()
                if (granted) startWaterReminder(parseInt(waterInt), parseInt(waterGoal), () => 0)
            } else {
                stopWaterReminder()
            }
            showToast('Ajustes guardados ✓')
        } catch (e) {
            console.error(e)
            showToast('Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    // ── Estilo compartido para inputs biométricos ────────────────────────
    const bioInputStyle = (color) => ({
        background: '#1C1D27',
        border: '1px solid #2A2B38',
        color: color,
    })
    const bioInputClass = 'w-20 rounded-lg px-2 py-1.5 text-right text-sm font-bold focus:outline-none num'

    return (
        <div className="animate-fade-up space-y-4">

            {/* ── TARJETA DE PERFIL ─────────────────────────────────── */}
            <Card>
                {/* Avatar + nombre */}
                <div className="flex items-center gap-4 pb-4 mb-4 border-b border-[#1E1E28]">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-black text-white"
                        style={{ background: 'linear-gradient(135deg,#FF375F,#FF6B1A)', boxShadow: '0 0 20px rgba(255,55,95,0.3)' }}>
                        {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-lg font-black text-white leading-tight truncate">{name || 'Usuario'}</p>
                        {liveBmiCat && (
                            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ color: badge.color, background: badge.bg }}>
                                {liveBmiCat}
                            </span>
                        )}
                    </div>
                </div>

                {/* Editar nombre */}
                <FormInput label="Nombre" id="cfg-name" value={name}
                    onChange={e => setName(e.target.value)} placeholder="Tu nombre" />
            </Card>

            {/* ── DATOS BIOMÉTRICOS (EDITABLES) ─────────────────────── */}
            <Card>
                <SectionTitle>Composición corporal</SectionTitle>

                {/* IMC calculado en vivo */}
                {liveBmi && (
                    <div className="flex items-center gap-4 p-3 rounded-xl mb-3"
                        style={{ background: badge.bg, border: `1px solid ${badge.color}30` }}>
                        <div className="text-4xl font-black num" style={{ color: badge.color }}>{liveBmi}</div>
                        <div>
                            <p className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest">IMC</p>
                            <p className="text-sm font-bold text-white">{liveBmiCat}</p>
                            <p className="text-[10px] text-[#8E8EA0]">Índice de Masa Corporal</p>
                        </div>
                    </div>
                )}

                {/* Peso */}
                <div className="flex items-center justify-between py-2.5 border-b border-[#1E1E28]">
                    <span className="text-[11px] text-[#8E8EA0] font-semibold">Peso</span>
                    <div className="flex items-center gap-1">
                        <input type="number" inputMode="decimal" value={weightKg}
                            onChange={e => setWeightKg(e.target.value)}
                            placeholder="—" min="20" max="300" step="0.1"
                            className={bioInputClass} style={bioInputStyle('#5AC8FA')}
                            onFocus={e => e.target.style.borderColor = '#5AC8FA'}
                            onBlur={e => e.target.style.borderColor = '#2A2B38'} />
                        <span className="text-[10px] text-[#8E8EA0]">kg</span>
                    </div>
                </div>

                {/* Talla */}
                <div className="flex items-center justify-between py-2.5 border-b border-[#1E1E28]">
                    <span className="text-[11px] text-[#8E8EA0] font-semibold">Talla</span>
                    <div className="flex items-center gap-1">
                        <input type="number" inputMode="decimal" value={heightCm}
                            onChange={e => setHeightCm(e.target.value)}
                            placeholder="—" min="50" max="250" step="1"
                            className={bioInputClass} style={bioInputStyle('#5AC8FA')}
                            onFocus={e => e.target.style.borderColor = '#5AC8FA'}
                            onBlur={e => e.target.style.borderColor = '#2A2B38'} />
                        <span className="text-[10px] text-[#8E8EA0]">cm</span>
                    </div>
                </div>

                {/* Edad */}
                <div className="flex items-center justify-between py-2.5 border-b border-[#1E1E28]">
                    <span className="text-[11px] text-[#8E8EA0] font-semibold">Edad</span>
                    <div className="flex items-center gap-1">
                        <input type="number" inputMode="numeric" value={age}
                            onChange={e => setAge(e.target.value)}
                            placeholder="—" min="10" max="120"
                            className={bioInputClass} style={bioInputStyle('#FF9F0A')}
                            onFocus={e => e.target.style.borderColor = '#FF9F0A'}
                            onBlur={e => e.target.style.borderColor = '#2A2B38'} />
                        <span className="text-[10px] text-[#8E8EA0]">años</span>
                    </div>
                </div>

                {/* Sexo */}
                <div className="flex items-center justify-between py-2.5 border-b border-[#1E1E28]">
                    <span className="text-[11px] text-[#8E8EA0] font-semibold">Sexo</span>
                    <select value={sex} onChange={e => setSex(e.target.value)}
                        className="bg-[#1C1D27] border border-[#2A2B38] rounded-lg px-2 py-1.5 text-sm font-bold text-[#BF5AF2] focus:outline-none appearance-none cursor-pointer"
                        style={{ minWidth: 120 }}
                        onFocus={e => e.target.style.borderColor = '#BF5AF2'}
                        onBlur={e => e.target.style.borderColor = '#2A2B38'}>
                        <option value="">— Seleccionar</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="otro">Otro</option>
                    </select>
                </div>

                {/* Actividad */}
                <div className="flex items-center justify-between py-2.5">
                    <span className="text-[11px] text-[#8E8EA0] font-semibold">Actividad</span>
                    <select value={activityLevel} onChange={e => setActivityLevel(e.target.value)}
                        className="bg-[#1C1D27] border border-[#2A2B38] rounded-lg px-2 py-1.5 text-sm font-bold text-[#30D158] focus:outline-none appearance-none cursor-pointer"
                        style={{ minWidth: 160 }}
                        onFocus={e => e.target.style.borderColor = '#30D158'}
                        onBlur={e => e.target.style.borderColor = '#2A2B38'}>
                        <option value="sedentary">Sedentario</option>
                        <option value="light">Ligero (1-3 días/sem)</option>
                        <option value="moderate">Moderado (3-5 días/sem)</option>
                        <option value="active">Activo (6-7 días/sem)</option>
                        <option value="very_active">Muy activo (2x/día)</option>
                    </select>
                </div>
            </Card>

            {/* ── METAS CALCULADAS (solo lectura) ──────────────────── */}
            <Card>
                <SectionTitle>Metas calculadas por IA</SectionTitle>
                <p className="text-[10px] text-[#8E8EA0] mb-3">Basadas en tu perfil y nivel de actividad. Ajustables abajo.</p>

                <div className="grid grid-cols-3 gap-2">
                    {[
                        { label: 'Calorías', value: config?.calorie_goal, unit: 'kcal', color: '#FF375F', icon: FlameIcon },
                        { label: 'Proteína', value: config?.protein_goal ?? config?.protein_goal_g, unit: 'g/día', color: '#0A84FF', icon: MuscleIcon },
                        { label: 'Agua', value: config?.water_goal, unit: 'vasos', color: '#5AC8FA', icon: DropIcon },
                    ].map(({ label, value, unit, color, icon: Icon }) => (
                        <div key={label} className="rounded-xl p-3 flex flex-col gap-1"
                            style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                            <Icon size={14} style={{ color }} />
                            <p className="text-lg font-black num leading-none" style={{ color }}>{value ?? '—'}</p>
                            <p className="text-[9px] text-[#8E8EA0] font-semibold leading-none">{unit}</p>
                            <p className="text-[10px] text-white font-bold">{label}</p>
                        </div>
                    ))}
                </div>

                {config?.ai_recommendations && (
                    <div className="mt-3 p-3 rounded-xl bg-white/3 border border-white/6">
                        <p className="text-[9px] font-black text-[#8E8EA0] uppercase tracking-widest mb-1">Recomendaciones IA</p>
                        <p className="text-xs text-[#C0C0D0] leading-relaxed">{config.ai_recommendations}</p>
                    </div>
                )}
            </Card>

            {/* ── METAS EDITABLES ──────────────────────────────────── */}
            <Card>
                <SectionTitle>Ajustar metas</SectionTitle>

                {[
                    {
                        label: 'Calorías diarias', sub: 'Meta en kcal', icon: FlameIcon, iconColor: '#FF6B1A', bg: '#FF6B1A',
                        val: calGoal, set: setCalGoal, focus: '#FF6B1A', type: 'number', width: 'w-20'
                    },
                    {
                        label: 'Vasos de agua', sub: 'Meta diaria (250ml c/u)', icon: DropIcon, iconColor: '#5AC8FA', bg: '#5AC8FA',
                        val: waterGoal, set: setWaterGoal, focus: '#5AC8FA', type: 'number', width: 'w-16', min: 1, max: 20
                    },
                    {
                        label: 'Recordatorio agua', sub: 'Cada cuántas horas', icon: BellIcon, iconColor: '#0A84FF', bg: '#0A84FF',
                        val: waterInt, set: setWaterInt, focus: '#0A84FF', type: 'number', width: 'w-16', min: 1, max: 12
                    },
                ].map(({ label, sub, icon: Icon, iconColor, bg, val, set, focus, width, min, max }, i, arr) => (
                    <div key={label}
                        className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? 'border-b border-[#1E1E28]' : ''}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: `${bg}18` }}>
                                <Icon size={16} style={{ color: iconColor }} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">{label}</p>
                                <p className="text-[10px] text-[#7B7D94]">{sub}</p>
                            </div>
                        </div>
                        <input type="number" value={val} min={min} max={max}
                            onChange={e => set(e.target.value)}
                            className={`${width} bg-[#1C1D27] border border-[#2A2B38] rounded-lg px-2 py-1.5
                                        text-white text-center text-sm font-bold focus:outline-none`}
                            style={{ '--focus-color': focus }}
                            onFocus={e => e.target.style.borderColor = focus}
                            onBlur={e => e.target.style.borderColor = '#2A2B38'}
                        />
                    </div>
                ))}
            </Card>

            {/* ── NOTIFICACIONES ───────────────────────────────────── */}
            <Card>
                <SectionTitle>Notificaciones</SectionTitle>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#7B7D94]/10 rounded-lg flex items-center justify-center">
                            <BellIcon size={16} className="text-[#7B7D94]" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Alertas de agua</p>
                            <p className="text-[10px] text-[#7B7D94]">Notificaciones periódicas</p>
                        </div>
                    </div>
                    <button onClick={() => setNotifOn(v => !v)}
                        className={`relative w-12 h-6 rounded-full transition-all duration-300
                            ${notifOn ? 'bg-[#FF6B1A]' : 'bg-[#2A2B38]'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300
                            ${notifOn ? 'left-6' : 'left-0.5'}`} />
                    </button>
                </div>
            </Card>

            {/* ── GUARDAR ──────────────────────────────────────────── */}
            <PrimaryButton onClick={() => setShowConfirm(true)} loading={saving}>
                Guardar Ajustes
            </PrimaryButton>

            {/* ── MODAL DE CONFIRMACIÓN ──────────────────────────────── */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
                    style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
                    <div className="w-full max-w-sm rounded-2xl p-5 animate-fade-up"
                        style={{ background: '#1C1D27', border: '1px solid #2A2B38' }}>
                        <h3 className="text-base font-black text-white mb-3">¿Confirmar cambios?</h3>
                        <p className="text-xs text-[#8E8EA0] mb-4">Se actualizarán los siguientes datos:</p>

                        <div className="space-y-1.5 mb-5 p-3 rounded-xl bg-white/3 border border-white/6">
                            {name !== (config?.name ?? 'Usuario') && (
                                <p className="text-xs text-white">📝 Nombre: <span className="font-bold text-[#FF9F0A]">{name}</span></p>
                            )}
                            {weightKg && String(weightKg) !== String(config?.weight_kg ?? '') && (
                                <p className="text-xs text-white">⚖️ Peso: <span className="font-bold text-[#5AC8FA]">{weightKg} kg</span></p>
                            )}
                            {heightCm && String(heightCm) !== String(config?.height_cm ?? '') && (
                                <p className="text-xs text-white">📏 Talla: <span className="font-bold text-[#5AC8FA]">{heightCm} cm</span></p>
                            )}
                            {age && String(age) !== String(config?.age ?? '') && (
                                <p className="text-xs text-white">🎂 Edad: <span className="font-bold text-[#FF9F0A]">{age} años</span></p>
                            )}
                            {sex !== (config?.sex ?? '') && (
                                <p className="text-xs text-white">👤 Sexo: <span className="font-bold text-[#BF5AF2]">{sex === 'M' ? 'Masculino' : sex === 'F' ? 'Femenino' : 'Otro'}</span></p>
                            )}
                            {activityLevel !== (config?.activity_level ?? 'moderate') && (
                                <p className="text-xs text-white">🏃 Actividad: <span className="font-bold text-[#30D158]">{ACTIVITY_LABELS[activityLevel]}</span></p>
                            )}
                            {String(calGoal) !== String(config?.calorie_goal ?? 2000) && (
                                <p className="text-xs text-white">🔥 Meta calorías: <span className="font-bold text-[#FF375F]">{calGoal} kcal</span></p>
                            )}
                            {String(waterGoal) !== String(config?.water_goal ?? 8) && (
                                <p className="text-xs text-white">💧 Meta agua: <span className="font-bold text-[#5AC8FA]">{waterGoal} vasos</span></p>
                            )}
                            {liveBmi && (
                                <p className="text-xs text-white">📊 IMC: <span className="font-bold" style={{ color: badge.color }}>{liveBmi} ({liveBmiCat})</span></p>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setShowConfirm(false)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#8E8EA0] bg-white/5 border border-white/10 active:scale-95 transition-all">
                                Cancelar
                            </button>
                            <button onClick={() => { setShowConfirm(false); handleSave() }}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white active:scale-95 transition-all"
                                style={{ background: 'linear-gradient(135deg,#FF375F,#FF6B1A)', boxShadow: '0 0 16px rgba(255,55,95,0.35)' }}>
                                ✓ Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ACERCA DE ─────────────────────────────────────────── */}
            <Card>
                <div className="flex items-center gap-3">
                    <InfoIcon size={16} className="text-[#7B7D94]" />
                    <div>
                        <p className="text-sm font-bold text-white">KCal v1.0</p>
                        <p className="text-xs text-[#7B7D94]">Powered by Gemini Vision + Supabase · React + Tailwind</p>
                    </div>
                </div>
            </Card>

        </div>
    )
}
