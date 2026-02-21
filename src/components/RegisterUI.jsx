/**
 * RegisterUI.jsx — Sub-componentes reutilizables para el wizard de registro.
 *
 * Extraídos de Register.jsx para mantener el componente principal
 * enfocado en lógica de negocio y flujo de pasos.
 */

// ── Indicador de progreso ────────────────────────────────────────────────────

export function StepIndicator({ step, total }) {
    return (
        <div className="flex items-center gap-1.5 mb-8">
            {Array.from({ length: total }).map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-500
                    ${i < step ? 'bg-[#FF375F]' : i === step ? 'bg-[#FF375F]/60' : 'bg-[#2E2E3A]'}
                    ${i === step ? 'flex-[2]' : 'flex-1'}`}
                />
            ))}
            <span className="text-[9px] font-black text-[#8E8EA0] ml-2 whitespace-nowrap">
                {step + 1} / {total}
            </span>
        </div>
    )
}

// ── Label de campo ───────────────────────────────────────────────────────────

export function FieldLabel({ children }) {
    return (
        <label className="text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest block mb-2">
            {children}
        </label>
    )
}

// ── Input de texto genérico ──────────────────────────────────────────────────

export function TextInput({ id, type = 'text', value, onChange, placeholder, autoComplete, className = '' }) {
    return (
        <input id={id} type={type} value={value} onChange={onChange}
            placeholder={placeholder} autoComplete={autoComplete}
            className={`w-full px-4 py-3 bg-[#252530] border border-[#2E2E3A] rounded-xl
                text-white placeholder-[#8E8EA0] focus:outline-none
                focus:border-[#FF375F]/60 focus:ring-2 focus:ring-[#FF375F]/10
                transition-all text-sm ${className}`}
        />
    )
}

// ── Botón principal (gradient con sombra) ────────────────────────────────────

export function NextButton({ onClick, disabled, loading, children }) {
    return (
        <button onClick={onClick} disabled={disabled || loading}
            className="w-full py-4 rounded-2xl font-black text-white text-sm
                       disabled:opacity-40 disabled:cursor-not-allowed
                       active:scale-95 transition-all flex items-center justify-center gap-3 mt-5"
            style={{
                background: 'linear-gradient(135deg,#FF375F,#FF6B1A)',
                boxShadow: '0 4px 20px rgba(255,55,95,0.4)',
            }}>
            {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full spinner" />
                : children
            }
        </button>
    )
}
