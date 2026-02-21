/**
 * ScanReview.jsx — Pantalla de revisión de alimentos detectados por el escáner.
 *
 * Muestra:
 * - Miniatura del snapshot capturado
 * - Resumen de macros totales de los seleccionados
 * - Lista de alimentos con checkbox para seleccionar/deseleccionar
 * - Botones "Repetir" y "Confirmar"
 *
 * Props:
 *   snapshot     — dataURL del frame capturado
 *   items        — array de alimentos detectados
 *   checked      — array de índices seleccionados
 *   onToggle     — (idx) => void
 *   onSave       — () => void
 *   onRestart    — () => void
 *   onClose      — () => void
 *   rootStyle    — estilos inline del contenedor raíz
 *   headerStyle  — estilos inline del header
 *   bottomStyle  — estilos inline del footer
 */
import { CheckIcon, XIcon } from './Icons'
import { PrimaryButton, OutlineButton } from './UI'

export default function ScanReview({
    snapshot, items, checked, onToggle, onSave, onRestart, onClose,
    rootStyle, headerStyle, bottomStyle,
}) {
    // Totales de macros de los seleccionados
    const totalCal = checked.reduce((s, i) => s + Math.round(items[i]?.calories ?? 0), 0)
    const totalP = checked.reduce((s, i) => s + Math.round(items[i]?.protein_g ?? 0), 0)
    const totalC = checked.reduce((s, i) => s + Math.round(items[i]?.carbs_g ?? 0), 0)
    const totalF = checked.reduce((s, i) => s + Math.round(items[i]?.fat_g ?? 0), 0)

    return (
        <div style={rootStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <div className="flex items-center gap-2">
                    <CheckIcon size={18} className="text-[#30D158]" />
                    <span className="text-white font-bold text-sm tracking-wide">Revisión</span>
                </div>
                <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full
                     bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                    <XIcon size={18} />
                </button>
            </div>

            {/* Contenido scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', background: '#0D0D11' }}>

                {/* Snapshot miniatura */}
                {snapshot && (
                    <div style={{ padding: '12px 16px 0' }}>
                        <div style={{
                            borderRadius: 16,
                            overflow: 'hidden',
                            height: 140,
                            position: 'relative',
                        }}>
                            <img
                                src={snapshot}
                                alt="captura"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                }}
                            />
                            <div style={{
                                position: 'absolute',
                                bottom: 8, right: 8,
                                background: 'rgba(0,0,0,0.7)',
                                backdropFilter: 'blur(4px)',
                                borderRadius: 20,
                                padding: '4px 10px',
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#30D158',
                            }}>
                                {items.length} detectado{items.length > 1 ? 's' : ''}
                            </div>
                        </div>
                    </div>
                )}

                {/* Resumen de macros */}
                <div style={{ padding: '12px 16px' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 8,
                    }}>
                        {[
                            { label: 'Calorías', value: totalCal, unit: 'kcal', color: '#FF375F' },
                            { label: 'Proteína', value: totalP, unit: 'g', color: '#0A84FF' },
                            { label: 'Carbos', value: totalC, unit: 'g', color: '#FF9F0A' },
                            { label: 'Grasa', value: totalF, unit: 'g', color: '#BF5AF2' },
                        ].map(m => (
                            <div key={m.label} style={{
                                background: `${m.color}15`,
                                border: `1px solid ${m.color}30`,
                                borderRadius: 14,
                                padding: '10px 6px',
                                textAlign: 'center',
                            }}>
                                <div style={{ color: m.color, fontSize: 18, fontWeight: 900 }}>
                                    {m.value}
                                </div>
                                <div style={{ color: `${m.color}AA`, fontSize: 9, fontWeight: 700, marginTop: 2 }}>
                                    {m.unit}
                                </div>
                                <div style={{ color: '#8E8EA0', fontSize: 9, fontWeight: 600, marginTop: 4 }}>
                                    {m.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Lista de alimentos */}
                <div style={{ padding: '0 16px 16px' }}>
                    <p style={{
                        fontSize: 10,
                        fontWeight: 900,
                        color: '#8E8EA0',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: 10,
                    }}>
                        Toca para seleccionar / deseleccionar
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {items.map((item, idx) => {
                            const sel = checked.includes(idx)
                            return (
                                <button
                                    key={idx}
                                    onClick={() => onToggle(idx)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: '12px 14px',
                                        borderRadius: 16,
                                        border: sel
                                            ? '1.5px solid rgba(48,209,88,0.4)'
                                            : '1.5px solid rgba(255,255,255,0.06)',
                                        background: sel
                                            ? 'rgba(48,209,88,0.08)'
                                            : 'rgba(255,255,255,0.03)',
                                        transition: 'all 0.2s',
                                        textAlign: 'left',
                                        width: '100%',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {/* Emoji grande */}
                                    <div style={{
                                        fontSize: 28,
                                        lineHeight: 1,
                                        width: 40,
                                        textAlign: 'center',
                                        flexShrink: 0,
                                    }}>
                                        {item.emoji}
                                    </div>

                                    {/* Info del alimento */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{
                                            color: '#fff',
                                            fontSize: 14,
                                            fontWeight: 800,
                                            lineHeight: 1.2,
                                            marginBottom: 4,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {item.food_name}
                                        </p>
                                        <p style={{
                                            color: '#8E8EA0',
                                            fontSize: 11,
                                            fontWeight: 600,
                                        }}>
                                            {item.quantity} {item.unit}
                                            {' · '}
                                            <span style={{ color: '#0A84FF' }}>P:{Math.round(item.protein_g)}g</span>
                                            {' '}
                                            <span style={{ color: '#FF9F0A' }}>C:{Math.round(item.carbs_g)}g</span>
                                            {' '}
                                            <span style={{ color: '#BF5AF2' }}>G:{Math.round(item.fat_g)}g</span>
                                        </p>
                                    </div>

                                    {/* Calorías + check */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-end',
                                        gap: 4,
                                        flexShrink: 0,
                                    }}>
                                        <span style={{
                                            color: '#FF375F',
                                            fontSize: 16,
                                            fontWeight: 900,
                                        }}>
                                            {Math.round(item.calories)}
                                        </span>
                                        <span style={{
                                            color: '#FF375F',
                                            fontSize: 9,
                                            fontWeight: 700,
                                        }}>
                                            kcal
                                        </span>
                                    </div>

                                    {/* Checkbox visual */}
                                    <div style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 8,
                                        border: sel ? '2px solid #30D158' : '2px solid rgba(255,255,255,0.15)',
                                        background: sel ? '#30D158' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        transition: 'all 0.2s',
                                    }}>
                                        {sel && <CheckIcon size={14} className="text-white" />}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Controles inferiores */}
            <div style={bottomStyle}>
                {checked.length > 0 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10,
                        padding: '0 4px',
                    }}>
                        <span style={{ color: '#8E8EA0', fontSize: 12, fontWeight: 600 }}>
                            {checked.length} de {items.length} seleccionado{checked.length > 1 ? 's' : ''}
                        </span>
                        <span style={{ color: '#FF375F', fontSize: 14, fontWeight: 900 }}>
                            {totalCal} kcal
                        </span>
                    </div>
                )}
                <div className="flex gap-3">
                    <OutlineButton onClick={onRestart} className="!border-white/20 !text-white/60">
                        Repetir
                    </OutlineButton>
                    <PrimaryButton onClick={onSave}>
                        <CheckIcon size={18} /> Confirmar
                    </PrimaryButton>
                </div>
            </div>
        </div>
    )
}
