import { useRef, useState, useCallback, useEffect } from 'react'
import { analyzeBase64Frame } from '../services/gemini'
import { CameraIcon, SparkIcon, XIcon, CheckIcon } from './Icons'
import { Spinner, PrimaryButton, OutlineButton } from './UI'

/**
 * CameraScanner — Escáner de comida con overlay visual tipo AR
 *
 * Flujo:
 * 1. Abre la cámara trasera con getUserMedia
 * 2. Muestra el viewfinder con animación de escaneo
 * 3. Al tocar "Escanear", captura un frame del video → canvas → base64
 * 4. Envía a Gemini y recibe items con posición (cx, cy en %)
 * 5. Muestra los chips flotantes encima de la foto resultado
 * 6. El usuario selecciona los que quiere guardar
 */
export default function CameraScanner({ open, onClose, onSave, showToast }) {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const streamRef = useRef(null)

    const [phase, setPhase] = useState('camera')   // 'camera' | 'analyzing' | 'result'
    const [snapshot, setSnapshot] = useState(null)        // dataURL del frame capturado
    const [items, setItems] = useState([])          // alimentos detectados con cx/cy
    const [checked, setChecked] = useState([])          // índices seleccionados
    const [scanning, setScanning] = useState(false)       // animación de barrido activa

    // ── Abrir / cerrar stream de cámara ─────────────────────────────────────
    useEffect(() => {
        if (open) startCamera()
        return () => stopCamera()
    }, [open])

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',   // cámara trasera
                    width: { ideal: 720 },
                    height: { ideal: 960 },
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
        const vh = video.videoHeight || 960
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
            setPhase('result')
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
    }, [])

    // ── Reiniciar (volver a la cámara) ───────────────────────────────────────
    const restart = () => {
        setPhase('camera')
        setSnapshot(null)
        setItems([])
        setChecked([])
        startCamera()
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

    return (
        /* z-[999] para cubrir TODO: header de la app + nav inferior */
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 999,
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>

            {/* ── Header del escáner ──────────────────────────────────────────── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                paddingTop: 'max(12px, env(safe-area-inset-top))',
                background: 'rgba(0,0,0,0.9)',
                flexShrink: 0,
            }}>
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

            {/* ── Viewfinder: ocupa TODO el espacio entre header y controles ── */}
            <div style={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden',
                background: '#000',
                minHeight: 0,
            }}>

                {/* Video en vivo — llena el contenedor */}
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

                {/* Snapshot con overlay */}
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

                {/* ── Chips de alimentos encima de la imagen ────────────── */}
                {phase === 'result' && items.map((item, idx) => {
                    const sel = checked.includes(idx)
                    return (
                        <button
                            key={idx}
                            onClick={() =>
                                setChecked(prev =>
                                    prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                )
                            }
                            className="absolute transform -translate-x-1/2 -translate-y-1/2
                                transition-all duration-300"
                            style={{
                                left: `${Math.min(Math.max(item.cx, 10), 90)}%`,
                                top: `${Math.min(Math.max(item.cy, 10), 90)}%`,
                                zIndex: 20,
                            }}
                        >
                            <div className={`
                                flex items-center gap-2 px-3 py-2 rounded-2xl
                                font-bold shadow-2xl select-none
                                transition-all duration-200 animate-fade-up
                                ${sel
                                    ? 'bg-[#1C1A14]/90 backdrop-blur-md border border-[#FF6B1A]/60 scale-100'
                                    : 'bg-white/10 backdrop-blur-md border border-white/20 scale-95 opacity-60'
                                }
                            `}
                                style={{
                                    animationDelay: `${idx * 80}ms`,
                                    animationFillMode: 'backwards',
                                }}
                            >
                                <span className="text-xl leading-none">{item.emoji}</span>
                                <div className="text-left">
                                    <p className="text-white text-xs font-black leading-none whitespace-nowrap">
                                        {item.food_name}
                                    </p>
                                    <p className="text-[#FF6B1A] text-xs font-bold leading-tight">
                                        {Math.round(item.calories)} kcal
                                    </p>
                                </div>
                                {sel && (
                                    <div className="w-4 h-4 bg-[#FF375F] rounded-full flex items-center justify-center shrink-0">
                                        <CheckIcon size={10} className="text-white" />
                                    </div>
                                )}
                            </div>
                        </button>
                    )
                })}

                {/* ── Overlay de análisis ──────────────────────────────── */}
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

                {/* ── Marco de escaneo (esquinas) ──────────────────────── */}
                {phase === 'camera' && (
                    <>
                        {/* Esquinas — posicionadas con margen del borde */}
                        {[
                            { top: 16, left: 24 },
                            { top: 16, right: 24, transform: 'rotate(90deg)' },
                            { bottom: 16, left: 24, transform: 'rotate(-90deg)' },
                            { bottom: 16, right: 24, transform: 'rotate(180deg)' },
                        ].map((pos, i) => (
                            <div key={i} style={{
                                position: 'absolute',
                                width: 32,
                                height: 32,
                                ...pos,
                            }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0,
                                    width: '100%', height: 2,
                                    background: 'rgba(255,255,255,0.8)',
                                    borderRadius: 4,
                                }} />
                                <div style={{
                                    position: 'absolute', top: 0, left: 0,
                                    height: '100%', width: 2,
                                    background: 'rgba(255,255,255,0.8)',
                                    borderRadius: 4,
                                }} />
                            </div>
                        ))}

                        {/* Hint centrado abajo */}
                        <div style={{
                            position: 'absolute',
                            bottom: 20,
                            left: 0, right: 0,
                            display: 'flex',
                            justifyContent: 'center',
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

            {/* ── Controles inferiores (siempre visibles, nunca se van) ─────── */}
            <div style={{
                background: 'rgba(0,0,0,0.95)',
                padding: '16px 20px',
                paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                flexShrink: 0,
            }}>

                {/* Fase: cámara → botón escanear */}
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

                {/* Fase: analizando */}
                {phase === 'analyzing' && (
                    <div className="flex items-center justify-center gap-3 py-4 text-[#7B7D94]">
                        <Spinner />
                        <span className="font-semibold text-sm">Procesando imagen...</span>
                    </div>
                )}

                {/* Fase: resultado → guardar o repetir */}
                {phase === 'result' && (
                    <div className="space-y-3">
                        {checked.length > 0 && (
                            <div className="flex items-center justify-between px-1 pb-1">
                                <span className="text-[#7B7D94] text-xs font-semibold">
                                    {checked.length} alimento{checked.length > 1 ? 's' : ''} seleccionado{checked.length > 1 ? 's' : ''}
                                </span>
                                <span className="text-[#FF6B1A] font-black text-sm">
                                    {checked.reduce((s, i) => s + Math.round(items[i]?.calories ?? 0), 0)} kcal total
                                </span>
                            </div>
                        )}
                        <div className="flex gap-3">
                            <OutlineButton onClick={restart} className="!border-white/20 !text-white/60">
                                Repetir
                            </OutlineButton>
                            <PrimaryButton onClick={handleSave}>
                                <CheckIcon size={18} /> Guardar
                            </PrimaryButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
