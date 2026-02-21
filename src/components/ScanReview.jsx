/**
 * ScanReview.jsx — Pantalla de revisión post-escaneo.
 *
 * Diseño inspirado en apps tipo Foodvisor:
 * - Snapshot circular con badge de confianza
 * - Calorías en tipografía grande + barra de macros proporcional
 * - Lista de ingredientes con nombre y kcal
 * - Campo de cantidad total (gramos)
 * - Botón "Confirmar" negro estilo premium
 *
 * Props:
 *   snapshot         — dataURL del frame capturado
 *   items            — array de alimentos detectados
 *   checked          — array de índices seleccionados
 *   totalQty         — string con la cantidad total ingresada
 *   onTotalQtyChange — (value: string) => void
 *   onToggle         — (idx) => void
 *   onSave           — () => void
 *   onRestart        — () => void
 *   onClose          — () => void
 *   rootStyle        — estilos inline del contenedor raíz
 *   headerStyle      — estilos inline del header
 *   bottomStyle      — estilos inline del footer
 */
import { CheckIcon, XIcon } from './Icons'

export default function ScanReview({
    snapshot, items, checked, totalQty, onTotalQtyChange,
    onToggle, onSave, onRestart, onClose,
    rootStyle, headerStyle, bottomStyle,
}) {
    // ── Totales de macros de los seleccionados ────────────────────────────
    const totalCal = checked.reduce((s, i) => s + Math.round(items[i]?.calories ?? 0), 0)
    const totalP = checked.reduce((s, i) => s + Math.round(items[i]?.protein_g ?? 0), 0)
    const totalC = checked.reduce((s, i) => s + Math.round(items[i]?.carbs_g ?? 0), 0)
    const totalF = checked.reduce((s, i) => s + Math.round(items[i]?.fat_g ?? 0), 0)

    // Porcentajes para la barra proporcional (evitar div/0)
    const macroTotal = totalP + totalC + totalF || 1
    const pPct = Math.round((totalP / macroTotal) * 100)
    const cPct = Math.round((totalC / macroTotal) * 100)
    const fPct = 100 - pPct - cPct

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

                {/* ── Snapshot circular ── */}
                {snapshot && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '20px 16px 8px',
                    }}>
                        <div style={{
                            position: 'relative',
                            width: 160,
                            height: 160,
                        }}>
                            {/* Borde gradient */}
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #30D158, #FF6B1A)',
                                padding: 3,
                            }}>
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
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
                                </div>
                            </div>
                            {/* Badge detectados */}
                            <div style={{
                                position: 'absolute',
                                bottom: -4,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: '#1C1C26',
                                border: '2px solid #0D0D11',
                                borderRadius: 16,
                                padding: '3px 12px',
                                fontSize: 11,
                                fontWeight: 800,
                                color: '#30D158',
                                whiteSpace: 'nowrap',
                            }}>
                                ✅ {items.length} detectado{items.length > 1 ? 's' : ''}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Calorías grandes + barra de macros ── */}
                <div style={{ padding: '16px 20px 8px', textAlign: 'center' }}>
                    {/* Calorías */}
                    <div style={{
                        fontSize: 48,
                        fontWeight: 900,
                        color: '#FF375F',
                        lineHeight: 1,
                        letterSpacing: '-0.02em',
                    }}>
                        {totalCal}
                    </div>
                    <div style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#FF375F80',
                        marginTop: 2,
                    }}>
                        Calorías
                    </div>

                    {/* Barra proporcional de macros */}
                    <div style={{
                        display: 'flex',
                        height: 8,
                        borderRadius: 4,
                        overflow: 'hidden',
                        margin: '14px 0 8px',
                        gap: 2,
                    }}>
                        <div style={{
                            width: cPct + '%',
                            background: '#FF9F0A',
                            borderRadius: '4px 0 0 4px',
                            transition: 'width 0.3s',
                        }} />
                        <div style={{
                            width: fPct + '%',
                            background: '#0A84FF',
                            transition: 'width 0.3s',
                        }} />
                        <div style={{
                            width: pPct + '%',
                            background: '#30D158',
                            borderRadius: '0 4px 4px 0',
                            transition: 'width 0.3s',
                        }} />
                    </div>

                    {/* Leyenda de macros */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 20,
                        fontSize: 12,
                        fontWeight: 700,
                    }}>
                        <span>
                            <span style={{
                                display: 'inline-block',
                                width: 8, height: 8,
                                borderRadius: '50%',
                                background: '#FF9F0A',
                                marginRight: 5,
                                verticalAlign: 'middle',
                            }} />
                            <span style={{ color: '#FF9F0A' }}>Carbos {totalC}g</span>
                        </span>
                        <span>
                            <span style={{
                                display: 'inline-block',
                                width: 8, height: 8,
                                borderRadius: '50%',
                                background: '#0A84FF',
                                marginRight: 5,
                                verticalAlign: 'middle',
                            }} />
                            <span style={{ color: '#0A84FF' }}>Grasas {totalF}g</span>
                        </span>
                        <span>
                            <span style={{
                                display: 'inline-block',
                                width: 8, height: 8,
                                borderRadius: '50%',
                                background: '#30D158',
                                marginRight: 5,
                                verticalAlign: 'middle',
                            }} />
                            <span style={{ color: '#30D158' }}>Proteína {totalP}g</span>
                        </span>
                    </div>
                </div>

                {/* ── Separador ── */}
                <div style={{
                    height: 1,
                    background: 'rgba(255,255,255,0.06)',
                    margin: '8px 20px',
                }} />

                {/* ── Campo de cantidad total ── */}
                <div style={{ padding: '8px 20px' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1.5px solid rgba(255,255,255,0.08)',
                        borderRadius: 14,
                        padding: '10px 14px',
                    }}>
                        <span style={{ fontSize: 18 }}>⚖️</span>
                        <div style={{ flex: 1 }}>
                            <label style={{
                                fontSize: 9,
                                fontWeight: 800,
                                color: '#8E8EA0',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                            }}>
                                Cantidad total
                            </label>
                            <input
                                type="number"
                                inputMode="numeric"
                                placeholder="Ej: 300"
                                value={totalQty}
                                onChange={e => onTotalQtyChange(e.target.value)}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    color: '#fff',
                                    fontSize: 18,
                                    fontWeight: 900,
                                    padding: '2px 0 0',
                                }}
                            />
                        </div>
                        <span style={{
                            color: '#8E8EA0',
                            fontSize: 14,
                            fontWeight: 700,
                        }}>
                            gramos
                        </span>
                    </div>
                </div>

                {/* ── Separador ── */}
                <div style={{
                    height: 1,
                    background: 'rgba(255,255,255,0.06)',
                    margin: '8px 20px',
                }} />

                {/* ── Ingredientes detectados ── */}
                <div style={{ padding: '8px 20px 20px' }}>
                    <p style={{
                        fontSize: 10,
                        fontWeight: 900,
                        color: '#8E8EA0',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: 10,
                    }}>
                        Ingredientes detectados por IA
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                                        borderRadius: 14,
                                        border: sel
                                            ? '1.5px solid rgba(48,209,88,0.3)'
                                            : '1.5px solid rgba(255,255,255,0.04)',
                                        background: sel
                                            ? 'rgba(48,209,88,0.06)'
                                            : 'transparent',
                                        transition: 'all 0.2s',
                                        textAlign: 'left',
                                        width: '100%',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {/* Emoji */}
                                    <span style={{ fontSize: 24, flexShrink: 0 }}>
                                        {item.emoji}
                                    </span>

                                    {/* Nombre */}
                                    <span style={{
                                        flex: 1,
                                        color: '#fff',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {item.food_name}
                                    </span>

                                    {/* Calorías */}
                                    <span style={{
                                        color: '#8E8EA0',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        flexShrink: 0,
                                    }}>
                                        {Math.round(item.calories)} kcal
                                    </span>

                                    {/* Checkbox */}
                                    <div style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: 7,
                                        border: sel ? '2px solid #30D158' : '2px solid rgba(255,255,255,0.12)',
                                        background: sel ? '#30D158' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        transition: 'all 0.2s',
                                    }}>
                                        {sel && <CheckIcon size={13} className="text-white" />}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* ── Controles inferiores ── */}
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
                <div style={{ display: 'flex', gap: 10 }}>
                    {/* Botón Repetir */}
                    <button
                        onClick={onRestart}
                        style={{
                            flex: '0 0 auto',
                            padding: '14px 20px',
                            borderRadius: 16,
                            border: '1.5px solid rgba(255,255,255,0.1)',
                            background: 'transparent',
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        ↺ Repetir
                    </button>
                    {/* Botón Confirmar — estilo premium oscuro */}
                    <button
                        onClick={onSave}
                        style={{
                            flex: 1,
                            padding: '14px 24px',
                            borderRadius: 16,
                            border: 'none',
                            background: '#fff',
                            color: '#000',
                            fontSize: 15,
                            fontWeight: 900,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            transition: 'all 0.2s',
                            letterSpacing: '0.02em',
                        }}
                    >
                        Confirmar <span style={{ fontSize: 16 }}>→</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
