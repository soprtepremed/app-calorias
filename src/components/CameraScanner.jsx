import { useRef, useState, useCallback, useEffect } from 'react'
import { analyzeBase64Frame } from '../services/gemini'
import { CameraIcon, SparkIcon, XIcon, CheckIcon } from './Icons'
import { Spinner, PrimaryButton, OutlineButton } from './UI'

/**
 * CameraScanner — Escáner de comida fullscreen con pantalla de revisión
 *
 * Fases:
 * 1. 'camera'    → Viewfinder fullscreen (cámara abierta)
 * 2. 'analyzing' → Overlay de progreso sobre el snapshot
 * 3. 'review'    → Lista detallada de alimentos detectados para confirmar
 *
 * IMPORTANTE: Este componente debe renderizarse en App.jsx (raíz),
 * NO dentro de Dashboard, para que el z-index cubra todo.
 */
export default function CameraScanner({ open, onClose, onSave, showToast }) {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const streamRef = useRef(null)

    const [phase, setPhase] = useState('camera')       // 'camera' | 'analyzing' | 'review'
    const [snapshot, setSnapshot] = useState(null)      // dataURL del frame capturado
    const [items, setItems] = useState([])              // alimentos detectados
    const [checked, setChecked] = useState([])          // índices seleccionados
    const [scanning, setScanning] = useState(false)     // guard contra doble-tap

    // ── Abrir / cerrar stream de cámara ─────────────────────────────────────
    useEffect(() => {
        if (open) startCamera()
        return () => stopCamera()
    }, [open])

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 720 },
                    height: { ideal: 1280 },
                },
                audio: false,
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                videoRef.current.play()
            }
            setPhase('camera')
        } catch (e) {
            console.error('Error cámara:', e)
            const msg = e.name === 'NotAllowedError'
                ? '📷 Permiso de cámara denegado. Actívalo en ajustes del navegador.'
                : e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError'
                    ? '📷 No se detectó cámara. Conecta una webcam o usa tu teléfono.'
                    : '📷 No se pudo acceder a la cámara'
            showToast(msg)
            onClose()
        }
    }

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
    }

    // ── Capturar frame y analizar ────────────────────────────────────────────
    const handleScan = useCallback(async () => {
        if (scanning) return
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return

        const vw = video.videoWidth || 720
        const vh = video.videoHeight || 1280
        const scale = Math.min(1, 1024 / Math.max(vw, vh))
        canvas.width = Math.round(vw * scale)
        canvas.height = Math.round(vh * scale)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        const dataURL = canvas.toDataURL('image/jpeg', 0.90)
        const base64 = dataURL.split(',')[1]
        setSnapshot(dataURL)

        stopCamera()
        setPhase('analyzing')
        setScanning(true)

        try {
            const result = await analyzeBase64Frame(base64)
            if (!result.items.length) {
                showToast('No detecté alimentos — intenta con otro ángulo')
                restart()
                return
            }
            setItems(result.items)
            setChecked(result.items.map((_, i) => i))
            setPhase('review')
        } catch (e) {
            console.error(e)
            const msg = !navigator.onLine
                ? '📡 Sin conexión — verifica tu internet'
                : 'No se pudo analizar — intenta de nuevo'
            showToast(msg)
            restart()
        } finally {
            setScanning(false)
        }
    }, [scanning])

    // ── Reiniciar (volver a la cámara) ───────────────────────────────────────
    const restart = () => {
        setPhase('camera')
        setSnapshot(null)
        setItems([])
        setChecked([])
        startCamera()
    }

    // ── Toggle selección de item ─────────────────────────────────────────────
    const toggleItem = (idx) => {
        setChecked(prev =>
            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
        )
    }

    // ── Guardar seleccionados ────────────────────────────────────────────────
    const handleSave = () => {
        const selected = items.filter((_, i) => checked.includes(i))
        if (!selected.length) {
            showToast('Selecciona al menos un alimento')
            return
        }
        onSave(selected)
        handleClose()
    }

    const handleClose = () => {
        stopCamera()
        setPhase('camera')
        setSnapshot(null)
        setItems([])
        setChecked([])
        onClose()
    }

    if (!open) return null

    // ═══════════════════════════════════════════════════════════════════
    // ESTILOS INLINE para garantizar fullscreen real en móvil
    // ═══════════════════════════════════════════════════════════════════
    const rootStyle = {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    }

    const headerStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        background: phase === 'review' ? '#0D0D11' : 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
        borderBottom: phase === 'review' ? '1px solid rgba(255,255,255,0.06)' : 'none',
    }

    const bottomStyle = {
        background: phase === 'review' ? '#0D0D11' : 'rgba(0,0,0,0.95)',
        padding: '16px 20px',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        flexShrink: 0,
        borderTop: '1px solid rgba(255,255,255,0.06)',
    }

    // ═══════════════════════════════════════════════════════════════════
    // FASE: REVIEW — Pantalla de confirmación de alimentos
    // ═══════════════════════════════════════════════════════════════════
    if (phase === 'review') {
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
                        onClick={handleClose}
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
                                        onClick={() => toggleItem(idx)}
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
                        <OutlineButton onClick={restart} className="!border-white/20 !text-white/60">
                            Repetir
                        </OutlineButton>
                        <PrimaryButton onClick={handleSave}>
                            <CheckIcon size={18} /> Confirmar
                        </PrimaryButton>
                    </div>
                </div>
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════════
    // FASES: CAMERA + ANALYZING — Viewfinder fullscreen
    // ═══════════════════════════════════════════════════════════════════
    return (
        <div style={rootStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <div className="flex items-center gap-2">
                    <SparkIcon size={18} className="text-[#FF6B1A]" />
                    <span className="text-white font-bold text-sm tracking-wide">Escáner IA</span>
                </div>
                <button
                    onClick={handleClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full
                     bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                    <XIcon size={18} />
                </button>
            </div>

            {/* Viewfinder fullscreen */}
            <div style={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden',
                background: '#000',
                minHeight: 0,
            }}>
                {/* Video en vivo */}
                <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{
                        position: 'absolute',
                        top: 0, left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: phase === 'camera' ? 1 : 0,
                        transition: 'opacity 0.3s',
                    }}
                />

                {/* Canvas oculto para captura */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Snapshot */}
                {snapshot && (
                    <img
                        src={snapshot}
                        alt="captura"
                        style={{
                            position: 'absolute',
                            top: 0, left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                )}

                {/* Overlay de análisis */}
                {phase === 'analyzing' && (
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 20,
                    }}>
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative w-20 h-20">
                                <div className="absolute inset-0 border-4 border-[#FF6B1A]/20 rounded-full" />
                                <div className="absolute inset-0 border-4 border-transparent border-t-[#FF6B1A] rounded-full spinner" />
                                <div className="absolute inset-4 flex items-center justify-center">
                                    <SparkIcon size={24} className="text-[#FF6B1A]" />
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-white font-black text-lg">Analizando...</p>
                                <p className="text-[#7B7D94] text-sm mt-1">Gemini IA detectando alimentos</p>
                            </div>
                            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-[#FF6B1A] rounded-full"
                                    style={{ animation: 'scan 1.5s ease-in-out infinite' }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Marco de escaneo (esquinas) — solo en fase camera */}
                {phase === 'camera' && (
                    <>
                        {[
                            { top: 16, left: 24 },
                            { top: 16, right: 24, transform: 'rotate(90deg)' },
                            { bottom: 16, left: 24, transform: 'rotate(-90deg)' },
                            { bottom: 16, right: 24, transform: 'rotate(180deg)' },
                        ].map((pos, i) => (
                            <div key={i} style={{
                                position: 'absolute',
                                width: 32, height: 32,
                                ...pos,
                            }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0,
                                    width: '100%', height: 2,
                                    background: 'rgba(255,255,255,0.8)', borderRadius: 4,
                                }} />
                                <div style={{
                                    position: 'absolute', top: 0, left: 0,
                                    height: '100%', width: 2,
                                    background: 'rgba(255,255,255,0.8)', borderRadius: 4,
                                }} />
                            </div>
                        ))}

                        {/* Hint */}
                        <div style={{
                            position: 'absolute',
                            bottom: 20, left: 0, right: 0,
                            display: 'flex', justifyContent: 'center',
                        }}>
                            <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
                                <p className="text-white/80 text-xs font-semibold text-center">
                                    Apunta al plato y toca Escanear
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Controles inferiores */}
            <div style={bottomStyle}>
                {phase === 'camera' && (
                    <button
                        onClick={handleScan}
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl
                       bg-[#FF6B1A] text-white font-black text-base tracking-wide
                       shadow-2xl shadow-[#FF6B1A]/40 active:scale-95 transition-all"
                    >
                        <SparkIcon size={20} />
                        Escanear con IA
                    </button>
                )}

                {phase === 'analyzing' && (
                    <div className="flex items-center justify-center gap-3 py-4 text-[#7B7D94]">
                        <Spinner />
                        <span className="font-semibold text-sm">Procesando imagen...</span>
                    </div>
                )}
            </div>
        </div>
    )
}
