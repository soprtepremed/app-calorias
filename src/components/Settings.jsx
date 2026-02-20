import { useState, useEffect } from 'react'
import { updateConfig } from '../services/supabase'
import { requestNotificationPermission, startWaterReminder, stopWaterReminder } from '../services/water'
import { Card, FormInput, SectionTitle, PrimaryButton } from './UI'
import { SettingsIcon, BellIcon, FlameIcon, DropIcon, KeyIcon, InfoIcon } from './Icons'

export default function Settings({ config, configId, onConfigUpdate, showToast }) {
    const [name, setName] = useState(config?.name ?? 'Usuario')
    const [calGoal, setCalGoal] = useState(String(config?.calorie_goal ?? 2000))
    const [waterGoal, setWaterGoal] = useState(String(config?.water_goal ?? 8))
    const [waterInt, setWaterInt] = useState(String(config?.water_reminder_hours ?? 2))
    const [notifOn, setNotifOn] = useState(config?.notifications_enabled ?? true)
    const [saving, setSaving] = useState(false)

    // Gemini API Key (solo se guarda localmente)
    const [geminiKey, setGeminiKey] = useState('')

    useEffect(() => {
        setGeminiKey(localStorage.getItem('gemini_key_override') ?? '')
    }, [])

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

            // Reiniciar recordatorio agua
            if (notifOn) {
                const granted = await requestNotificationPermission()
                if (granted) {
                    startWaterReminder(parseInt(waterInt), parseInt(waterGoal), () => 0)
                }
            } else {
                stopWaterReminder()
            }

            showToast('Ajustes guardados')
        } catch (e) {
            console.error(e)
            showToast('Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    const saveGeminiKey = () => {
        if (geminiKey.trim()) {
            localStorage.setItem('gemini_key_override', geminiKey.trim())
            showToast('API Key de Gemini guardada')
        }
    }

    return (
        <div className="animate-fade-up space-y-4">

            {/* Perfil */}
            <Card>
                <SectionTitle>Perfil</SectionTitle>
                <FormInput label="Tu nombre" id="cfg-name" value={name}
                    onChange={e => setName(e.target.value)} placeholder="Usuario" />
            </Card>

            {/* Metas */}
            <Card>
                <SectionTitle>Metas diarias</SectionTitle>

                <div className="flex items-center justify-between py-3 border-b border-[#2A2B38]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#FF6B1A]/15 rounded-lg flex items-center justify-center">
                            <FlameIcon size={16} className="text-[#FF6B1A]" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Calorías</p>
                            <p className="text-[10px] text-[#7B7D94]">Meta diaria en kcal</p>
                        </div>
                    </div>
                    <input
                        type="number" value={calGoal}
                        onChange={e => setCalGoal(e.target.value)}
                        className="w-20 bg-[#1C1D27] border border-[#2A2B38] rounded-lg px-2 py-1.5
                       text-white text-center text-sm font-bold
                       focus:outline-none focus:border-[#FF6B1A]"
                    />
                </div>

                <div className="flex items-center justify-between py-3 border-b border-[#2A2B38]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#00E5A0]/15 rounded-lg flex items-center justify-center">
                            <DropIcon size={16} className="text-[#00E5A0]" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Vasos de agua</p>
                            <p className="text-[10px] text-[#7B7D94]">Meta diaria (250ml c/u)</p>
                        </div>
                    </div>
                    <input
                        type="number" value={waterGoal} min="1" max="20"
                        onChange={e => setWaterGoal(e.target.value)}
                        className="w-16 bg-[#1C1D27] border border-[#2A2B38] rounded-lg px-2 py-1.5
                       text-white text-center text-sm font-bold
                       focus:outline-none focus:border-[#00E5A0]"
                    />
                </div>

                <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#3B82F6]/15 rounded-lg flex items-center justify-center">
                            <BellIcon size={16} className="text-[#3B82F6]" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Recordatorio agua</p>
                            <p className="text-[10px] text-[#7B7D94]">Cada cuántas horas</p>
                        </div>
                    </div>
                    <input
                        type="number" value={waterInt} min="1" max="12"
                        onChange={e => setWaterInt(e.target.value)}
                        className="w-16 bg-[#1C1D27] border border-[#2A2B38] rounded-lg px-2 py-1.5
                       text-white text-center text-sm font-bold
                       focus:outline-none focus:border-[#3B82F6]"
                    />
                </div>
            </Card>

            {/* Notificaciones toggle */}
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
                    {/* Toggle */}
                    <button
                        onClick={() => setNotifOn(v => !v)}
                        className={`
              relative w-12 h-6 rounded-full transition-all duration-300
              ${notifOn ? 'bg-[#FF6B1A]' : 'bg-[#2A2B38]'}
            `}
                    >
                        <div className={`
              absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300
              ${notifOn ? 'left-6' : 'left-0.5'}
            `} />
                    </button>
                </div>
            </Card>

            {/* Botón guardar */}
            <PrimaryButton onClick={handleSave} loading={saving}>
                Guardar Ajustes
            </PrimaryButton>

            {/* API Keys info */}
            <Card>
                <SectionTitle>API Keys</SectionTitle>
                <div className="flex items-start gap-3 mb-4">
                    <KeyIcon size={16} className="text-[#7B7D94] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#7B7D94] leading-relaxed">
                        Las claves de Supabase y Gemini se configuran en el archivo{' '}
                        <code className="text-[#FF6B1A]">.env.local</code> del proyecto
                        y en las variables de entorno de Vercel.
                    </p>
                </div>
                <FormInput
                    label="Gemini API Key (override local)"
                    id="cfg-gemini-key"
                    value={geminiKey}
                    onChange={e => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                />
                <button
                    onClick={saveGeminiKey}
                    className="w-full py-2.5 rounded-xl border border-[#2A2B38] text-[#7B7D94]
                     text-sm font-bold hover:border-[#FF6B1A]/40 hover:text-white transition-all"
                >
                    Guardar Key
                </button>
            </Card>

            {/* Acerca de */}
            <Card>
                <div className="flex items-center gap-3">
                    <InfoIcon size={16} className="text-[#7B7D94]" />
                    <div>
                        <p className="text-sm font-bold text-white">KCal v1.0</p>
                        <p className="text-xs text-[#7B7D94]">
                            Powered by Gemini Vision + Supabase · React + Tailwind
                        </p>
                    </div>
                </div>
            </Card>

        </div>
    )
}
