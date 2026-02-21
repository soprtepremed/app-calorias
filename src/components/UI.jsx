import { useRef } from 'react'
import { XIcon } from './Icons'

/**
 * Toast — Notificación flotante, estilo Apple
 */
export function Toast({ toast }) {
    if (!toast) return null
    return (
        <div key={toast.id}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50
                 bg-[#1C1C22] border border-[#2E2E3A] text-white text-sm font-semibold
                 px-5 py-3 rounded-2xl shadow-2xl
                 animate-fade-up whitespace-nowrap"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
        >
            {toast.msg}
        </div>
    )
}

/**
 * Spinner — Loader circular
 */
export function Spinner({ size = 'md' }) {
    const cls = size === 'sm' ? 'w-4 h-4 border-2' : 'w-6 h-6 border-[3px]'
    return (
        <div className={`${cls} border-white/10 border-t-[#FF375F] rounded-full spinner`} />
    )
}

/**
 * Modal — Bottom Sheet adaptado a móvil.
 * Usa overlay scrolleable con overscroll-behavior:contain
 * para evitar que el scroll del fondo se filtre.
 */
export function Modal({ open, onClose, title, children }) {
    const overlayRef = useRef(null)

    if (!open) return null

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 bg-black/75 z-30 flex items-end justify-center"
            style={{
                backdropFilter: 'blur(8px)',
                overscrollBehavior: 'contain',
            }}
            onClick={e => { if (e.target === overlayRef.current) onClose() }}
        >
            <div className="bg-[#1C1C22] border border-[#2E2E3A] rounded-t-3xl
                      w-full max-w-lg pb-10 overflow-y-auto
                      animate-slide-up"
                style={{ maxHeight: '92dvh' }}
            >

                {/* Handle */}
                <div className="sticky top-0 bg-[#1C1C22] pt-4 pb-3 px-5 border-b border-[#2E2E3A] z-10 rounded-t-3xl">
                    <div className="w-10 h-1 bg-[#3A3A48] rounded-full mx-auto mb-3" />
                    {title && (
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-lg text-white tracking-tight">{title}</h2>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-full
                           bg-[#252530] text-[#8E8EA0] hover:text-white transition-colors"
                            >
                                <XIcon size={16} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="px-5 pt-4">{children}</div>
            </div>
        </div>
    )
}

/**
 * Card — Superficie charcoal. Usa la clase .card del CSS global.
 */
export function Card({ children, className = '' }) {
    return (
        <div className={`card p-4 mb-3 ${className}`}>
            {children}
        </div>
    )
}

/**
 * ProgressBar — Barra de progreso delgada
 */
export function ProgressBar({ value, max, className = '', accent = '#FF375F' }) {
    const pct = Math.min((value / Math.max(max, 1)) * 100, 100)
    const color = pct >= 100 ? '#EF4444' : pct >= 90 ? '#FF9F0A' : accent
    return (
        <div className={`bg-white/8 rounded-full h-1.5 overflow-hidden ${className}`}>
            <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: color }}
            />
        </div>
    )
}

/**
 * EmptyState — Estado vacío con ícono
 */
export function EmptyState({ icon: Icon, text }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 text-[#8E8EA0]">
            {Icon && <Icon size={38} className="mb-3 opacity-30" />}
            <p className="text-sm text-center leading-relaxed">{text}</p>
        </div>
    )
}

/**
 * FormInput — Campo de formulario estilo Apple dark
 */
export function FormInput({ label, id, icon: Icon, ...props }) {
    return (
        <div className="mb-4">
            {label && (
                <label htmlFor={id}
                    className="block text-[10px] font-bold text-[#8E8EA0] uppercase tracking-widest mb-2"
                >
                    {label}
                </label>
            )}
            <div className="relative">
                {Icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8EA0]">
                        <Icon size={16} />
                    </div>
                )}
                <input
                    id={id}
                    className={`
            w-full py-3 border border-[#2E2E3A] rounded-xl
            bg-[#252530] text-white text-base placeholder-[#8E8EA0]
            focus:outline-none focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF]/20
            transition-all
            ${Icon ? 'pl-10 pr-4' : 'px-4'}
          `}
                    {...props}
                />
            </div>
        </div>
    )
}

/**
 * Chip — Botón seleccionable
 */
export function Chip({ selected, onClick, icon: Icon, children }) {
    return (
        <button
            onClick={onClick}
            className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
        border transition-all duration-200
        ${selected
                    ? 'bg-[#FF375F]/20 border-[#FF375F]/60 text-[#FF375F]'
                    : 'bg-transparent border-[#2E2E3A] text-[#8E8EA0] hover:border-[#FF375F]/30'
                }
      `}
        >
            {Icon && <Icon size={13} />}
            {children}
        </button>
    )
}

/**
 * StatBadge — Número destacado con label
 */
export function StatBadge({ value, label, color = '#FF375F' }) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-xl font-black tracking-tight num" style={{ color }}>{value}</span>
            <span className="text-[10px] font-semibold text-[#8E8EA0] uppercase tracking-widest mt-0.5">{label}</span>
        </div>
    )
}

/**
 * SectionTitle — Título de sección
 */
export function SectionTitle({ children, className = '' }) {
    return (
        <h3 className={`text-[10px] font-black text-[#8E8EA0] uppercase tracking-widest mb-3 ${className}`}>
            {children}
        </h3>
    )
}

/**
 * PrimaryButton — Botón primario rojo Apple
 */
export function PrimaryButton({ children, onClick, loading = false, className = '', disabled = false }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className={`
        flex items-center justify-center gap-2 w-full py-3.5 rounded-xl
        font-bold text-white tracking-wide text-sm
        bg-[#FF375F] hover:bg-[#E0304F] active:scale-95
        transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
            style={{ boxShadow: '0 4px 20px rgba(255,55,95,0.35)' }}
        >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full spinner" />}
            {children}
        </button>
    )
}

/**
 * OutlineButton — Botón secundario
 */
export function OutlineButton({ children, onClick, className = '' }) {
    return (
        <button
            onClick={onClick}
            className={`
        flex items-center justify-center gap-2 w-full py-3.5 rounded-xl
        font-bold text-[#8E8EA0] tracking-wide text-sm
        border border-[#2E2E3A] bg-transparent
        hover:border-white/20 hover:text-white
        active:scale-95 transition-all duration-150
        ${className}
      `}
        >
            {children}
        </button>
    )
}
