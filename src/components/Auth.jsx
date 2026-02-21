import { useState, useRef } from 'react'
import { signIn } from '../services/supabase'
import { FlameIcon, DropIcon, SparkIcon } from './Icons'
import Register from './Register'

/**
 * Auth.jsx — Pantalla de ingreso + gateway a registro
 * Diseño premium con color naranja unificado (#FF6B1A)
 */
export default function Auth() {
    const [showRegister, setShowRegister] = useState(false)
    const [showPass, setShowPass] = useState(false)
    const [email, setEmail] = useState('')
    const [pass, setPass] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // IMPORTANTE: TODOS los hooks deben declararse ANTES de cualquier return condicional
    // (Regla de Hooks de React — mismo orden en cada render)
    const busy = useRef(false)

    if (showRegister) {
        return <Register onBack={() => setShowRegister(false)} />
    }

    const handleLogin = async (e) => {
        e.preventDefault()
        if (busy.current) return
        busy.current = true
        setError(null)
        setLoading(true)
        try {
            await signIn(email.trim(), pass)
        } catch (err) {
            const msg = err.message ?? ''
            if (msg.includes('Invalid login')) setError('Email o contraseña incorrectos')
            else if (msg.includes('Email not confirmed')) setError('Confirma tu email antes de ingresar')
            else setError(msg || 'Error al ingresar')
        } finally {
            setLoading(false)
            busy.current = false
        }
    }

    return (
        <div className="min-h-dvh bg-[#0D0D11] flex flex-col">

            {/* Fondo decorativo — naranja unificado */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle,#FF6B1A,transparent 70%)' }} />
                <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-12"
                    style={{ background: 'radial-gradient(circle,#FF9F0A,transparent 70%)' }} />
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-5 py-12 relative">

                {/* Logo */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
                        style={{
                            background: 'linear-gradient(135deg,#FF6B1A,#FF9F0A)',
                            boxShadow: '0 0 50px rgba(255,107,26,0.45), 0 8px 32px rgba(0,0,0,0.4)',
                        }}>
                        <FlameIcon size={38} className="text-white" />
                    </div>
                    <h1 className="text-4xl text-white tracking-tight"
                        style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, letterSpacing: '-0.03em' }}>
                        K-Cal
                    </h1>
                    <p className="text-[#8E8EA0] text-sm mt-1.5"
                        style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: '0.02em' }}>
                        Calculadora de calorías con IA
                    </p>
                </div>

                {/* Card login */}
                <div className="w-full max-w-sm">
                    <div className="bg-[#1C1C22] border border-[#2E2E3A] rounded-3xl p-6"
                        style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>

                        <h2 className="text-xl text-white mb-1"
                            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800 }}>
                            Ingresar
                        </h2>
                        <p className="text-[11px] text-[#8E8EA0] mb-5"
                            style={{ fontFamily: "'Inter', sans-serif" }}>
                            Accede a tu perfil personalizado
                        </p>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest block mb-2"
                                    style={{ fontFamily: "'Inter', sans-serif" }}>
                                    Email
                                </label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="correo@ejemplo.com" autoComplete="email"
                                    className="w-full px-4 py-3 bg-[#252530] border border-[#2E2E3A] rounded-xl
                                               text-white placeholder-[#8E8EA0] focus:outline-none
                                               focus:border-[#FF6B1A]/60 focus:ring-2 focus:ring-[#FF6B1A]/15
                                               transition-all text-sm" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest block mb-2"
                                    style={{ fontFamily: "'Inter', sans-serif" }}>
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <input type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)}
                                        placeholder="Tu contraseña" autoComplete="current-password"
                                        className="w-full px-4 py-3 pr-12 bg-[#252530] border border-[#2E2E3A] rounded-xl
                                                   text-white placeholder-[#8E8EA0] focus:outline-none
                                                   focus:border-[#FF6B1A]/60 focus:ring-2 focus:ring-[#FF6B1A]/15
                                                   transition-all text-sm" />
                                    <button type="button" onClick={() => setShowPass(p => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8EA0] hover:text-white transition-colors p-1">
                                        {showPass
                                            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                        }
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="py-3 px-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                    <p className="text-red-400 text-xs font-semibold">{error}</p>
                                </div>
                            )}

                            <button type="submit" disabled={loading}
                                className="w-full py-4 rounded-2xl text-white text-base
                                           disabled:opacity-60 disabled:cursor-not-allowed
                                           active:scale-95 transition-all flex items-center justify-center gap-3"
                                style={{
                                    fontFamily: "'Inter', sans-serif",
                                    fontWeight: 800,
                                    background: loading ? '#333' : 'linear-gradient(135deg,#FF6B1A,#FF9F0A)',
                                    boxShadow: loading ? 'none' : '0 6px 28px rgba(255,107,26,0.45)',
                                }}>
                                {loading
                                    ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full spinner" />
                                    : <FlameIcon size={18} />
                                }
                                {loading ? 'Ingresando...' : 'Ingresar'}
                            </button>
                        </form>
                    </div>

                    {/* CTA Registro — MUCHO más llamativo */}
                    <button onClick={() => setShowRegister(true)}
                        className="mt-4 w-full p-4 rounded-2xl flex items-center justify-between gap-3
                                   active:scale-[0.98] transition-all group"
                        style={{
                            background: 'linear-gradient(135deg, rgba(255,107,26,0.12), rgba(255,159,10,0.08))',
                            border: '1.5px solid rgba(255,107,26,0.35)',
                            boxShadow: '0 0 20px rgba(255,107,26,0.1)',
                        }}>
                        <div className="text-left">
                            <p className="text-white text-sm leading-none"
                                style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800 }}>
                                ¿Primera vez?
                            </p>
                            <p className="text-[10px] text-[#FF9F0A] mt-1 font-semibold">
                                Crea tu perfil personalizado con IA ✨
                            </p>
                        </div>
                        <div className="shrink-0 px-5 py-2.5 rounded-xl text-sm text-white
                                        group-hover:scale-105 transition-all"
                            style={{
                                fontFamily: "'Inter', sans-serif",
                                fontWeight: 800,
                                background: 'linear-gradient(135deg,#FF6B1A,#FF9F0A)',
                                boxShadow: '0 4px 16px rgba(255,107,26,0.4)',
                            }}>
                            Registrarte →
                        </div>
                    </button>

                    {/* Features */}
                    <div className="flex items-center justify-center gap-5 mt-5 text-[#8E8EA0]">
                        {[
                            { Icon: FlameIcon, label: 'Calorías' },
                            { Icon: SparkIcon, label: 'Gemini IA' },
                            { Icon: DropIcon, label: 'Hidratación' },
                        ].map(({ Icon, label }) => (
                            <div key={label} className="flex flex-col items-center gap-1">
                                <Icon size={16} />
                                <span className="text-[9px] font-semibold uppercase tracking-widest"
                                    style={{ fontFamily: "'Inter', sans-serif" }}>
                                    {label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
