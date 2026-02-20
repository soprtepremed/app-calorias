import { useEffect, useRef } from 'react'
import { XIcon } from './Icons'

/**
 * Toast — Notificación flotante, tema oscuro deportivo
 */
export function Toast({ toast }) {
    if (!toast) return null
    return (
        <div key={toast.id}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                 bg-[#FF6B1A] text-white text-sm font-semibold
                 px-5 py-2.5 rounded-full shadow-2xl
                 animate-fade-up whitespace-nowrap tracking-wide"
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
        <div className={`${cls} border-white/20 border-t-[#FF6B1A] rounded-full spinner`} />
    )
}

/**
 * Modal — Bottom Sheet con tema oscuro
 */
export function Modal({ open, onClose, title, children }) {
    const overlayRef = useRef(null)

    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [open])

    if (!open) return null

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 bg-black/70 z-30 flex items-end justify-center backdrop-blur-sm"
            onClick={e => { if (e.target === overlayRef.current) onClose() }}
        >
            <div className="bg-[#14151C] border border-[#2A2B38] rounded-t-3xl
                      w-full max-w-lg pb-10 max-h-[94vh] overflow-y-auto
                      animate-slide-up">

                {/* Handle bar */}
                <div className="sticky top-0 bg-[#14151C] pt-4 pb-3 px-5 border-b border-[#2A2B38] z-10">
                    <div className="w-10 h-1 bg-[#2A2B38] rounded-full mx-auto mb-3" />
                    {title && (
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-lg text-white tracking-tight">{title}</h2>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-full
                           bg-[#1C1D27] text-[#7B7D94] hover:text-white transition-colors"
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
 * Card — Contenedor con bordes oscuros
 */
export function Card({ children, className = '' }) {
    return (
        <div className={`bg-[#14151C] border border-[#2A2B38] rounded-2xl p-4 ${className}`}>
            {children}
        </div>
    )
}

/**
 * ProgressBar — Barra de progreso deportiva
 */
export function ProgressBar({ value, max, className = '', accent = '#FF6B1A' }) {
    const pct = Math.min((value / Math.max(max, 1)) * 100, 100)
    const color = pct >= 100 ? '#EF4444' : pct >= 85 ? '#F97316' : accent
    return (
        <div className={`bg-white/10 rounded-full h-2 overflow-hidden ${className}`}>
            <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: color }}
            />
        </div>
    )
}

/**
 * EmptyState — Estado vacío
 */
export function EmptyState({ icon: Icon, text }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-[#7B7D94]">
            {Icon && <Icon size={40} className="mb-3 opacity-40" />}
            <p className="text-sm text-center">{text}</p>
        </div>
    )
}

/**
 * FormInput — Campo de formulario con tema oscuro
 */
export function FormInput({ label, id, icon: Icon, ...props }) {
    return (
        <div className="mb-4">
            {label && (
                <label htmlFor={id}
                    className="block text-[10px] font-bold text-[#7B7D94] uppercase tracking-widest mb-2"
                >
                    {label}
                </label>
            )}
            <div className="relative">
                {Icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B7D94]">
                        <Icon size={16} />
                    </div>
                )}
                <input
                    id={id}
                    className={`
            w-full py-3 border border-[#2A2B38] rounded-xl
            bg-[#1C1D27] text-white text-base placeholder-[#7B7D94]
            focus:outline-none focus:border-[#FF6B1A] focus:ring-1 focus:ring-[#FF6B1A]/30
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
 * Chip — Botón pill seleccionable
 */
export function Chip({ selected, onClick, icon: Icon, children }) {
    return (
        <button
            onClick={onClick}
            className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
        border transition-all duration-200
        ${selected
                    ? 'bg-[#FF6B1A] border-[#FF6B1A] text-white shadow-lg shadow-[#FF6B1A]/30'
                    : 'bg-transparent border-[#2A2B38] text-[#7B7D94] hover:border-[#FF6B1A]/50'
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
export function StatBadge({ value, label, color = '#FF6B1A' }) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-xl font-black tracking-tight" style={{ color }}>{value}</span>
            <span className="text-[10px] font-semibold text-[#7B7D94] uppercase tracking-widest mt-0.5">{label}</span>
        </div>
    )
}

/**
 * SectionTitle — Título de sección estilo deportivo
 */
export function SectionTitle({ children, className = '' }) {
    return (
        <h3 className={`text-[10px] font-black text-[#7B7D94] uppercase tracking-widest mb-3 ${className}`}>
            {children}
        </h3>
    )
}

/**
 * PrimaryButton — Botón CTA con naranja
 */
export function PrimaryButton({ children, onClick, loading = false, className = '', disabled = false }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className={`
        flex items-center justify-center gap-2 w-full py-3.5 rounded-xl
        font-bold text-white tracking-wide text-sm
        bg-[#FF6B1A] hover:bg-[#E55A0A] active:scale-95
        transition-all duration-150 shadow-lg shadow-[#FF6B1A]/30
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
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
        font-bold text-[#7B7D94] tracking-wide text-sm
        border border-[#2A2B38] bg-transparent
        hover:border-[#FF6B1A]/40 hover:text-white
        active:scale-95 transition-all duration-150
        ${className}
      `}
        >
            {children}
        </button>
    )
}
