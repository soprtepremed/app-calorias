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

    // Datos de solo lectura del perfil biométrico
    const bmi = config?.bmi ? Number(config.bmi).toFixed(1) : null
    const bmiCat = config?.bmi_category ?? null
    const badge = bmiBadge(bmiCat)
    const initial = (config?.name ?? 'U')[0].toUpperCase()

    const handleSave = async () => {
        setSaving(true)
        try {
            const payload = {
                name: name.trim() || 'Usuario',
                calorie_goal: parseInt(calGoal) || 2000,
                water_goal: parseInt(waterGoal) || 8,
                water_reminder_hours: parseInt(waterInt) || 2,
                notifications_enabled: notifOn,
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
                        <p className="text-lg font-black text-white leading-tight truncate">{config?.name ?? 'Usuario'}</p>
                        {bmiCat && (
                            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ color: badge.color, background: badge.bg }}>
                                {bmiCat}
                            </span>
                        )}
                    </div>
                </div>

                {/* Editar nombre */}
                <FormInput label="Nombre" id="cfg-name" value={name}
                    onChange={e => setName(e.target.value)} placeholder="Tu nombre" />
            </Card>

            {/* ── DATOS BIOMÉTRICOS ─────────────────────────────────── */}
            <Card>
                <SectionTitle>Composición corporal</SectionTitle>

                {/* IMC grande */}
                {bmi && (
                    <div className="flex items-center gap-4 p-3 rounded-xl mb-3"
                        style={{ background: badge.bg, border: `1px solid ${badge.color}30` }}>
                        <div className="text-4xl font-black num" style={{ color: badge.color }}>{bmi}</div>
                        <div>
                            <p className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest">IMC</p>
                            <p className="text-sm font-bold text-white">{bmiCat}</p>
                            <p className="text-[10px] text-[#8E8EA0]">Índice de Masa Corporal</p>
                        </div>
                    </div>
                )}

                <ProfileRow label="Peso" value={config?.weight_kg} unit=" kg" accent="#5AC8FA" />
                <ProfileRow label="Talla" value={config?.height_cm} unit=" cm" accent="#5AC8FA" />
                <ProfileRow label="Edad" value={config?.age} unit=" años" accent="#FF9F0A" />
                <ProfileRow label="Sexo" value={SEX_LABELS[config?.sex] ?? config?.sex} accent="#BF5AF2" />
                <ProfileRow label="Actividad" value={ACTIVITY_LABELS[config?.activity_level] ?? config?.activity_level} accent="#30D158" />
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
            <PrimaryButton onClick={handleSave} loading={saving}>
                Guardar Ajustes
            </PrimaryButton>

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
