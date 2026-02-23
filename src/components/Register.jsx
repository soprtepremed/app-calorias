/**
 * Register.jsx — Wizard de registro de 4 pasos.
 *
 * Módulos extraídos:
 *   RegisterHelpers.js — Funciones de cálculo (BMI, TDEE, metas)
 *   RegisterUI.jsx     — Sub-componentes de UI (StepIndicator, FieldLabel, etc.)
 *
 * Pasos:
 *   0. Datos personales + credenciales
 *   1. Perfil físico (peso, talla, edad, sexo)
 *   2. Metas y nivel de actividad
 *   3. Recomendaciones IA + crear cuenta
 */
import { useState, useEffect } from 'react'
import { signUp, updateConfig, getConfig } from '../services/supabase'
import { generateOnboardingRecommendations } from '../services/gemini'
import { FlameIcon, SparkIcon, DropIcon, ScaleIcon, CheckIcon } from './Icons'
import { calcBMI, bmiCategory, calcTDEE, calcWaterGoal, calcProteinGoal, ACTIVITY_OPTIONS } from './RegisterHelpers'
import { StepIndicator, FieldLabel, TextInput, NextButton } from './RegisterUI'

// ════════════════════════════════════════════════════════════════════════════
// REGISTER WIZARD — 4 pasos
// ════════════════════════════════════════════════════════════════════════════
export default function Register({ onBack }) {
    const TOTAL_STEPS = 4

    // ── Estado global del formulario ────────────────────────────────────────
    const [step, setStep] = useState(0)
    const [showPass, setShowPass] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Paso 1 — Credenciales
    const [firstName, setFirstName] = useState('')
    const [secondName, setSecondName] = useState('')
    const [firstLastname, setFirstLastname] = useState('')
    const [secondLastname, setSecondLastname] = useState('')
    const [email, setEmail] = useState('')
    const [pass, setPass] = useState('')
    const [passConfirm, setPassConfirm] = useState('')

    // Paso 2 — Perfil físico
    const [weight, setWeight] = useState('')
    const [height, setHeight] = useState('')
    const [age, setAge] = useState('')
    const [sex, setSex] = useState('M')

    // Paso 3 — Metas (calculadas, editables)
    const [activity, setActivity] = useState('moderado')
    const [calorieGoal, setCalorieGoal] = useState(2000)
    const [waterGoal, setWaterGoal] = useState(8)
    const [proteinGoal, setProteinGoal] = useState(120)

    // Paso 4 — Recomendaciones IA
    const [recommendations, setRecommendations] = useState([])
    const [aiLoading, setAiLoading] = useState(false)

    // IMC calculado
    const bmi = weight && height ? calcBMI(Number(weight), Number(height)) : null
    const bmiCat = bmi ? bmiCategory(bmi) : null

    // Recalcular metas cuando cambia el perfil
    useEffect(() => {
        if (weight && height && age && sex && activity) {
            const tdee = calcTDEE(Number(weight), Number(height), Number(age), sex, activity)
            const water = calcWaterGoal(Number(weight))
            const protein = calcProteinGoal(Number(weight), activity)
            setCalorieGoal(tdee)
            setWaterGoal(water)
            setProteinGoal(protein)
        }
    }, [weight, height, age, sex, activity])

    // ── Validaciones por paso ────────────────────────────────────────────────
    const validate = () => {
        setError(null)
        if (step === 0) {
            if (!firstName.trim()) return setError('Escribe tu primer nombre') || false
            if (!firstLastname.trim()) return setError('Escribe tu primer apellido') || false
            if (!email.includes('@')) return setError('Email inválido') || false
            if (pass.length < 6) return setError('La contraseña debe tener al menos 6 caracteres') || false
            if (pass !== passConfirm) return setError('Las contraseñas no coinciden') || false
        }
        if (step === 1) {
            if (!weight || Number(weight) < 20 || Number(weight) > 300)
                return setError('Ingresa un peso válido (20-300 kg)') || false
            if (!height || Number(height) < 100 || Number(height) > 250)
                return setError('Ingresa una talla válida (100-250 cm)') || false
            if (!age || Number(age) < 10 || Number(age) > 100)
                return setError('Ingresa una edad válida (10-100 años)') || false
        }
        return true
    }

    // ── Avanzar paso ─────────────────────────────────────────────────────────
    const nextStep = async () => {
        if (!validate()) return

        if (step === 2) {
            // Ir a paso 4 y generar recomendaciones IA simultáneamente
            setStep(3)
            generateRecommendations()
            return
        }
        setStep(s => s + 1)
    }

    // ── Generar recomendaciones IA ───────────────────────────────────────────
    const generateRecommendations = async () => {
        setAiLoading(true)
        try {
            const recs = await generateOnboardingRecommendations({
                firstName,
                weight: Number(weight),
                height: Number(height),
                bmi,
                bmiCategory: bmiCat?.label ?? 'Normal',
                age: Number(age),
                sex,
                activity,
                calorieGoal,
                waterGoal,
            })
            setRecommendations(recs)
        } catch { /* usa el fallback de la función */ }
        finally { setAiLoading(false) }
    }

    // ── Crear cuenta y guardar perfil ─────────────────────────────────────────
    const handleCreate = async () => {
        setLoading(true)
        setError(null)
        try {
            const fullName = [firstName, secondName, firstLastname, secondLastname]
                .filter(Boolean).join(' ')

            // 1. Crear cuenta en Supabase Auth
            const result = await signUp(email.trim(), pass, fullName, calorieGoal)

            // 2. Esperar brevemente para que el trigger cree user_config
            await new Promise(r => setTimeout(r, 800))

            // 3. Obtener config recién creada y actualizarla con el perfil completo
            const cfg = await getConfig()
            if (cfg?.id) {
                await updateConfig(cfg.id, {
                    first_name: firstName.trim(),
                    second_name: secondName.trim() || null,
                    first_lastname: firstLastname.trim(),
                    second_lastname: secondLastname.trim() || null,
                    name: fullName,
                    weight_kg: Number(weight),
                    height_cm: Number(height),
                    bmi: bmi,
                    age: Number(age),
                    sex,
                    activity_level: activity,
                    calorie_goal: calorieGoal,
                    water_goal: waterGoal,
                    protein_goal_g: proteinGoal,
                    ai_recommendations: recommendations.join('\n'),
                    onboarding_done: true,
                })
            }
            // onAuthChange en App.jsx detecta la sesión automáticamente
        } catch (err) {
            console.error('Error en handleCreate:', err)
            const msg = err.message ?? ''
            if (msg.includes('already registered')) setError('Este email ya está registrado')
            else setError(msg || 'Error al crear la cuenta')
            setStep(0) // Volver al primer paso
        } finally {
            setLoading(false)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-dvh bg-[#0D0D11] flex flex-col">

            {/* Fondo decorativo */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle,#FF375F,transparent 70%)' }} />
                <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle,#0A84FF,transparent 70%)' }} />
                <div className="absolute inset-0 opacity-[0.025]"
                    style={{ backgroundImage: 'radial-gradient(1px 1px at 1px 1px, white, transparent)', backgroundSize: '28px 28px' }} />
            </div>

            <div className="flex-1 flex flex-col px-5 py-8 relative max-w-sm mx-auto w-full">

                {/* Logo + título */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg,#FF375F,#FF6B1A)', boxShadow: '0 0 18px rgba(255,55,95,0.4)' }}>
                        <FlameIcon size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white leading-none">Crear cuenta</h1>
                        <p className="text-[10px] text-[#8E8EA0] mt-0.5">K-Cal · Calculadora de calorías con IA</p>
                    </div>
                </div>

                <StepIndicator step={step} total={TOTAL_STEPS} />

                {/* ══ PASO 0 — Datos personales y credenciales ══ */}
                {step === 0 && (
                    <div className="animate-fade-up space-y-4">
                        <h2 className="text-lg font-black text-white mb-1">¿Cómo te llamas?</h2>
                        <p className="text-[11px] text-[#8E8EA0] mb-4">
                            Usaremos tu nombre para personalizar tus recomendaciones.
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <FieldLabel>Primer nombre *</FieldLabel>
                                <TextInput id="r-fn" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="María" />
                            </div>
                            <div>
                                <FieldLabel>Segundo nombre</FieldLabel>
                                <TextInput id="r-sn" value={secondName} onChange={e => setSecondName(e.target.value)} placeholder="Elena" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <FieldLabel>Primer apellido *</FieldLabel>
                                <TextInput id="r-fl" value={firstLastname} onChange={e => setFirstLastname(e.target.value)} placeholder="García" />
                            </div>
                            <div>
                                <FieldLabel>Segundo apellido</FieldLabel>
                                <TextInput id="r-sl" value={secondLastname} onChange={e => setSecondLastname(e.target.value)} placeholder="López" />
                            </div>
                        </div>

                        <div className="h-px bg-[#2E2E3A] my-1" />

                        <div>
                            <FieldLabel>Email *</FieldLabel>
                            <TextInput id="r-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="correo@ejemplo.com" autoComplete="email" />
                        </div>
                        <div>
                            <FieldLabel>Contraseña *</FieldLabel>
                            <div className="relative">
                                <TextInput id="r-pass" type={showPass ? 'text' : 'password'} value={pass}
                                    onChange={e => setPass(e.target.value)}
                                    placeholder="Mínimo 6 caracteres" autoComplete="new-password"
                                    className="pr-12" />
                                <button type="button" onClick={() => setShowPass(p => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8EA0] hover:text-white transition-colors p-1">
                                    {showPass
                                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                    }
                                </button>
                            </div>
                        </div>
                        <div>
                            <FieldLabel>Confirmar contraseña *</FieldLabel>
                            <div className="relative">
                                <TextInput id="r-pass2" type={showPass ? 'text' : 'password'} value={passConfirm}
                                    onChange={e => setPassConfirm(e.target.value)}
                                    placeholder="Repite tu contraseña" autoComplete="new-password"
                                    className="pr-12" />
                                <button type="button" onClick={() => setShowPass(p => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8EA0] hover:text-white transition-colors p-1">
                                    {showPass
                                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                    }
                                </button>
                            </div>
                        </div>

                        {error && <p className="text-red-400 text-xs font-semibold">{error}</p>}

                        <NextButton onClick={nextStep}>Continuar →</NextButton>

                        <button onClick={onBack}
                            className="w-full py-3 text-[#8E8EA0] text-sm font-semibold hover:text-white transition-colors">
                            ← Ya tengo cuenta — Ingresar
                        </button>
                    </div>
                )}

                {/* ══ PASO 1 — Perfil físico ══ */}
                {step === 1 && (
                    <div className="animate-fade-up space-y-4">
                        <h2 className="text-lg font-black text-white mb-1">Tu perfil físico</h2>
                        <p className="text-[11px] text-[#8E8EA0] mb-4">
                            Con estos datos calculamos tu IMC y tus metas personalizadas.
                        </p>

                        {/* Sexo */}
                        <div>
                            <FieldLabel>Sexo biológico</FieldLabel>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { key: 'M', label: 'Hombre', emoji: '♂️' },
                                    { key: 'F', label: 'Mujer', emoji: '♀️' },
                                    { key: 'otro', label: 'Otro', emoji: '⚧️' },
                                ].map(s => (
                                    <button key={s.key} type="button" onClick={() => setSex(s.key)}
                                        className={`py-2.5 rounded-xl text-sm font-black border transition-all
                                            ${sex === s.key
                                                ? 'bg-[#FF375F]/15 border-[#FF375F]/50 text-white'
                                                : 'bg-transparent border-[#2E2E3A] text-[#8E8EA0]'}`}>
                                        {s.emoji}<br />
                                        <span className="text-[10px]">{s.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <FieldLabel>Edad (años) *</FieldLabel>
                                <TextInput id="r-age" type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="25" />
                            </div>
                            <div>
                                <FieldLabel>Peso (kg) *</FieldLabel>
                                <TextInput id="r-weight" type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="70" />
                            </div>
                        </div>
                        <div>
                            <FieldLabel>Talla (cm) *</FieldLabel>
                            <TextInput id="r-height" type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="170" />
                            {height && (
                                <p className="text-[10px] text-[#8E8EA0] mt-1">
                                    = {(Number(height) / 100).toFixed(2)} m
                                </p>
                            )}
                        </div>

                        {/* IMC calculado en tiempo real */}
                        {bmi && bmiCat && (
                            <div className="rounded-2xl p-4 border animate-fade-up"
                                style={{ background: `${bmiCat.color}12`, borderColor: `${bmiCat.color}40` }}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-black text-[#8E8EA0] uppercase tracking-widest mb-1">
                                            Índice de Masa Corporal
                                        </p>
                                        <p className="text-2xl font-black" style={{ color: bmiCat.color }}>
                                            {bmi}
                                        </p>
                                        <p className="text-xs font-bold" style={{ color: bmiCat.color }}>
                                            {bmiCat.emoji} {bmiCat.label}
                                        </p>
                                    </div>
                                    <div className="text-4xl opacity-60">{bmiCat.emoji}</div>
                                </div>
                                {/* Barra IMC visual */}
                                <div className="mt-3 h-2 rounded-full bg-[#2E2E3A] overflow-hidden">
                                    <div className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${Math.min(100, ((bmi - 15) / 25) * 100)}%`,
                                            background: bmiCat.color,
                                        }} />
                                </div>
                                <div className="flex justify-between text-[8px] text-[#8E8EA0] mt-1">
                                    <span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
                                </div>
                            </div>
                        )}

                        {error && <p className="text-red-400 text-xs font-semibold">{error}</p>}
                        <NextButton onClick={nextStep}>Continuar →</NextButton>
                        <button onClick={() => setStep(0)}
                            className="w-full py-2 text-[#8E8EA0] text-sm font-semibold hover:text-white transition-colors">
                            ← Regresar
                        </button>
                    </div>
                )}

                {/* ══ PASO 2 — Metas y actividad ══ */}
                {step === 2 && (
                    <div className="animate-fade-up space-y-4">
                        <h2 className="text-lg font-black text-white mb-1">Tus metas diarias</h2>
                        <p className="text-[11px] text-[#8E8EA0] mb-4">
                            Calculadas automáticamente para ti — puedes ajustarlas.
                        </p>

                        {/* Actividad física */}
                        <div>
                            <FieldLabel>Nivel de actividad física</FieldLabel>
                            <div className="space-y-2">
                                {ACTIVITY_OPTIONS.map(a => (
                                    <button key={a.key} type="button" onClick={() => setActivity(a.key)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all
                                            ${activity === a.key
                                                ? 'bg-[#FF375F]/12 border-[#FF375F]/40 text-white'
                                                : 'bg-transparent border-[#2E2E3A] text-[#8E8EA0] hover:border-[#FF375F]/20'}`}>
                                        <span className="text-xl">{a.emoji}</span>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold leading-none">{a.label}</p>
                                            <p className="text-[10px] opacity-70 mt-0.5">{a.sub}</p>
                                        </div>
                                        {activity === a.key &&
                                            <CheckIcon size={14} className="text-[#FF375F] shrink-0" />
                                        }
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Calorías — Stepper + Slider */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <FieldLabel>Meta de calorías (kcal)</FieldLabel>
                            </div>
                            {/* Botones +/- con valor central */}
                            <div className="flex items-center justify-center gap-3 mb-3">
                                <button type="button"
                                    onClick={() => setCalorieGoal(g => Math.max(1000, Math.round((g - 100) / 100) * 100))}
                                    className="w-12 h-12 rounded-xl text-xl font-black flex items-center justify-center active:scale-90 transition-all"
                                    style={{ background: 'rgba(255,55,95,0.12)', border: '1px solid rgba(255,55,95,0.3)', color: '#FF375F' }}>
                                    −
                                </button>
                                <div className="flex-1 text-center">
                                    <span className="text-3xl font-black num" style={{ color: '#FF375F' }}>
                                        {Math.round(calorieGoal / 100) * 100}
                                    </span>
                                    <p className="text-[10px] text-[#8E8EA0] font-semibold">kcal / día</p>
                                </div>
                                <button type="button"
                                    onClick={() => setCalorieGoal(g => Math.min(5000, Math.round((g + 100) / 100) * 100))}
                                    className="w-12 h-12 rounded-xl text-xl font-black flex items-center justify-center active:scale-90 transition-all"
                                    style={{ background: 'rgba(255,55,95,0.12)', border: '1px solid rgba(255,55,95,0.3)', color: '#FF375F' }}>
                                    +
                                </button>
                            </div>
                            {/* Slider como ajuste secundario */}
                            <input type="range" min="1000" max="5000" step="100"
                                value={Math.round(calorieGoal / 100) * 100}
                                onChange={e => setCalorieGoal(Number(e.target.value))}
                                className="w-full accent-[#FF375F]" />
                            <div className="flex justify-between text-[9px] text-[#8E8EA0] mt-1">
                                <span>1000</span><span>Recomendado: {calcTDEE(Number(weight) || 70, Number(height) || 170, Number(age) || 25, sex, activity)}</span><span>5000</span>
                            </div>
                        </div>

                        {/* Agua — Stepper + Slider */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <FieldLabel>Meta de agua (vasos de 250ml)</FieldLabel>
                            </div>
                            <div className="flex items-center justify-center gap-3 mb-3">
                                <button type="button"
                                    onClick={() => setWaterGoal(g => Math.max(1, g - 1))}
                                    className="w-12 h-12 rounded-xl text-xl font-black flex items-center justify-center active:scale-90 transition-all"
                                    style={{ background: 'rgba(90,200,250,0.12)', border: '1px solid rgba(90,200,250,0.3)', color: '#5AC8FA' }}>
                                    −
                                </button>
                                <div className="flex-1 text-center">
                                    <span className="text-3xl font-black num" style={{ color: '#5AC8FA' }}>
                                        {waterGoal} 💧
                                    </span>
                                    <p className="text-[10px] text-[#8E8EA0] font-semibold">{waterGoal * 250}ml / día</p>
                                </div>
                                <button type="button"
                                    onClick={() => setWaterGoal(g => Math.min(20, g + 1))}
                                    className="w-12 h-12 rounded-xl text-xl font-black flex items-center justify-center active:scale-90 transition-all"
                                    style={{ background: 'rgba(90,200,250,0.12)', border: '1px solid rgba(90,200,250,0.3)', color: '#5AC8FA' }}>
                                    +
                                </button>
                            </div>
                            <input type="range" min="1" max="20" step="1"
                                value={waterGoal} onChange={e => setWaterGoal(Number(e.target.value))}
                                className="w-full accent-[#5AC8FA]" />
                            <p className="text-[9px] text-[#8E8EA0] mt-1">
                                Recomendado: {calcWaterGoal(Number(weight) || 70)} vasos
                            </p>
                        </div>

                        {/* Proteína */}
                        <div className="rounded-xl p-3 bg-[#0A84FF]/10 border border-[#0A84FF]/25 flex items-center gap-3">
                            <ScaleIcon size={16} className="text-[#0A84FF] shrink-0" />
                            <p className="text-xs text-[#8E8EA0]">
                                Meta proteína calculada: <span className="text-white font-black">{proteinGoal}g/día</span>
                            </p>
                        </div>

                        <NextButton onClick={nextStep}>
                            <SparkIcon size={18} /> Generar mis recomendaciones
                        </NextButton>
                        <button onClick={() => setStep(1)}
                            className="w-full py-2 text-[#8E8EA0] text-sm font-semibold hover:text-white transition-colors">
                            ← Regresar
                        </button>
                    </div>
                )}

                {/* ══ PASO 3 — Recomendaciones IA + Finalizar ══ */}
                {step === 3 && (
                    <div className="animate-fade-up space-y-4">
                        <div className="flex items-center gap-3 mb-1">
                            <SparkIcon size={20} className="text-[#FF375F]" />
                            <h2 className="text-lg font-black text-white">
                                {aiLoading ? 'Analizando tu perfil...' : `¡Hola, ${firstName}!`}
                            </h2>
                        </div>
                        <p className="text-[11px] text-[#8E8EA0] mb-4">
                            Gemini analizó tu perfil y preparó estos consejos para ti:
                        </p>

                        {/* Resumen del perfil */}
                        <div className="grid grid-cols-3 gap-2 mb-2">
                            {[
                                { label: 'IMC', value: bmi ?? '—', unit: '', color: bmiCat?.color ?? '#8E8EA0' },
                                { label: 'Meta', value: calorieGoal, unit: 'kcal', color: '#FF375F' },
                                { label: 'Agua', value: waterGoal, unit: 'vasos', color: '#5AC8FA' },
                            ].map(s => (
                                <div key={s.label} className="rounded-2xl p-3 text-center"
                                    style={{ background: `${s.color}12`, border: `1px solid ${s.color}30` }}>
                                    <p className="text-base font-black" style={{ color: s.color }}>{s.value}</p>
                                    <p className="text-[8px] text-[#8E8EA0]">{s.unit || ''}</p>
                                    <p className="text-[8px] text-[#8E8EA0] font-bold uppercase">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Recomendaciones */}
                        {aiLoading ? (
                            <div className="space-y-2">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="h-14 rounded-xl bg-[#252530] animate-pulse" />
                                ))}
                                <p className="text-center text-[11px] text-[#8E8EA0] pt-2">
                                    <span className="spinner inline-block w-3 h-3 border-2 border-[#FF375F]/30 border-t-[#FF375F] rounded-full mr-2" />
                                    Gemini está personalizando tus consejos...
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recommendations.map((rec, i) => (
                                    <div key={i}
                                        className="flex items-start gap-3 p-3.5 rounded-xl border border-[#2E2E3A] bg-[#1C1C22] animate-fade-up"
                                        style={{ animationDelay: `${i * 80}ms` }}>
                                        <span className="text-base shrink-0">{rec.match(/^\S+/)?.[0] ?? '💡'}</span>
                                        <p className="text-xs text-[#C8C8D0] leading-relaxed">
                                            {rec.replace(/^\S+\s?/, '')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {error && (
                            <p className="text-red-400 text-xs font-semibold">{error}</p>
                        )}

                        <NextButton onClick={handleCreate} loading={loading}>
                            <CheckIcon size={18} /> Crear mi cuenta
                        </NextButton>
                        <button onClick={() => setStep(2)}
                            className="w-full py-2 text-[#8E8EA0] text-sm font-semibold hover:text-white transition-colors">
                            ← Editar metas
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
