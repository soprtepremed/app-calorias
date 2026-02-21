/**
 * CameraScanner.jsx — Escáner de comida fullscreen con IA.
 *
 * Features:
 *   - Tap-to-focus: toca la pantalla para enfocar en un punto específico
 *   - Flash/Torch: botón para encender/apagar la linterna de la cámara
 *   - Resolución HD: solicita 1080p para mejor detección de IA
 *   - Autofocus continuo como fallback
 *
 * Fases:
 *   1. 'camera'    → Viewfinder fullscreen (cámara abierta)
 *   2. 'analyzing' → Overlay de progreso sobre el snapshot
 *   3. 'review'    → Lista detallada de alimentos (delegada a ScanReview)
 *
 * Módulos extraídos:
 *   ScanReview.jsx — Pantalla de revisión con lista seleccionable
 *
 * IMPORTANTE: Este componente debe renderizarse en App.jsx (raíz),
 * NO dentro de Dashboard, para que el z-index cubra todo.
 */
import { useRef, useState, useCallback, useEffect } from 'react'
import { analyzeBase64Frame } from '../services/gemini'
import { SparkIcon, XIcon } from './Icons'
import ScanReview from './ScanReview'

export default function CameraScanner({ open, onClose, onSave, showToast }) {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const streamRef = useRef(null)
    const trackRef = useRef(null) // Referencia al track de video para controlar flash/focus

    const [phase, setPhase] = useState('camera')       // 'camera' | 'analyzing' | 'review'
    const [snapshot, setSnapshot] = useState(null)      // dataURL del frame capturado
    const [items, setItems] = useState([])              // alimentos detectados
    const [checked, setChecked] = useState([])          // índices seleccionados
    const [scanning, setScanning] = useState(false)     // guard contra doble-tap
    const [totalQty, setTotalQty] = useState('')        // cantidad total en gramos (usuario)
    const [progress, setProgress] = useState(0)         // 0-100 para barra de progreso
    const cancelledRef = useRef(false)                  // para abortar análisis
    const progressRef = useRef(null)                    // timer de progreso

    // ── Flash y Focus ────────────────────────────────────────────────────────
    const [flashOn, setFlashOn] = useState(false)
    const [flashSupported, setFlashSupported] = useState(false)
    const [focusPoint, setFocusPoint] = useState(null)  // { x, y } para la animación
    const focusTimerRef = useRef(null)

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
                    // Solicitar alta resolución para mejor enfoque y detección IA
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false,
            })
            streamRef.current = stream

            // Obtener el track de video para acceder a capabilities (flash, focus)
            const track = stream.getVideoTracks()[0]
            trackRef.current = track

            // Detectar si el dispositivo soporta torch (flash)
            if (track) {
                try {
                    const capabilities = track.getCapabilities?.()
                    if (capabilities?.torch) {
                        setFlashSupported(true)
                    }
                } catch { /* getCapabilities no soportado en algunos navegadores */ }
            }

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                videoRef.current.play()
            }
            setPhase('camera')
            setFlashOn(false)
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
        trackRef.current = null
        setFlashOn(false)
        setFlashSupported(false)
    }

    // ── Toggle Flash / Linterna ──────────────────────────────────────────────
    const toggleFlash = async () => {
        const track = trackRef.current
        if (!track) return
        try {
            const newState = !flashOn
            await track.applyConstraints({
                advanced: [{ torch: newState }],
            })
            setFlashOn(newState)
        } catch (e) {
            console.warn('Flash no disponible:', e)
            showToast('📸 Flash no disponible en este dispositivo')
        }
    }

    // ── Tap-to-Focus ─────────────────────────────────────────────────────────
    /**
     * Al tocar la pantalla, calcula el punto de enfoque relativo al video
     * y lo aplica como "pointOfInterest" en los constraints del track.
     * Muestra una animación visual en el punto tocado.
     */
    const handleTapToFocus = useCallback((e) => {
        if (phase !== 'camera') return
        const track = trackRef.current
        if (!track) return

        // Obtener coordenadas relativas al contenedor del video
        const rect = e.currentTarget.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width
        const y = (e.clientY - rect.top) / rect.height

        // Mostrar animación del reticle de enfoque
        setFocusPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top })
        clearTimeout(focusTimerRef.current)
        focusTimerRef.current = setTimeout(() => setFocusPoint(null), 1200)

        // Intentar aplicar focus al track
        try {
            const capabilities = track.getCapabilities?.()
            // Verificar si el dispositivo soporta focusMode manual o 'single-shot'
            if (capabilities?.focusMode?.includes('manual') || capabilities?.focusMode?.includes('single-shot')) {
                track.applyConstraints({
                    advanced: [{
                        focusMode: 'manual',
                        pointOfInterest: { x, y },
                    }],
                }).catch(() => {
                    // Fallback: intentar solo con single-shot (Android Chrome)
                    track.applyConstraints({
                        advanced: [{ focusMode: 'single-shot' }],
                    }).catch(() => { /* Sin soporte de focus manual */ })
                })
            } else if (capabilities?.focusMode?.includes('continuous')) {
                // Si solo hay continuous, forzar un re-focus
                track.applyConstraints({
                    advanced: [{ focusMode: 'continuous' }],
                }).catch(() => { })
            }
        } catch { /* getCapabilities no soportado */ }
    }, [phase])

    // ── Capturar frame y analizar ────────────────────────────────────────────
    const handleScan = useCallback(async () => {
        if (scanning) return
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return

        const vw = video.videoWidth || 1920
        const vh = video.videoHeight || 1080
        const scale = Math.min(1, 1280 / Math.max(vw, vh))
        canvas.width = Math.round(vw * scale)
        canvas.height = Math.round(vh * scale)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        const dataURL = canvas.toDataURL('image/jpeg', 0.92)
        const base64 = dataURL.split(',')[1]
        setSnapshot(dataURL)

        // Apagar flash antes de detener la cámara
        if (flashOn) {
            try {
                await trackRef.current?.applyConstraints({ advanced: [{ torch: false }] })
            } catch { /* ignore */ }
        }

        stopCamera()
        setPhase('analyzing')
        setScanning(true)
        cancelledRef.current = false
        setProgress(0)

        // Barra de progreso simulada: sube gradualmente hasta 90%
        // (el 100% se pone al recibir respuesta)
        let prog = 0
        progressRef.current = setInterval(() => {
            prog += Math.random() * 8 + 2  // incremento aleatorio 2-10%
            if (prog > 90) prog = 90
            setProgress(Math.round(prog))
        }, 400)

        try {
            const result = await analyzeBase64Frame(base64)

            // Si el usuario canceló mientras esperaba, ignorar resultado
            if (cancelledRef.current) return

            clearInterval(progressRef.current)
            setProgress(100)

            if (!result.items.length) {
                showToast('No detecté alimentos — intenta con otro ángulo')
                restart()
                return
            }
            setItems(result.items)
            setChecked(result.items.map((_, i) => i))
            setTotalQty('')  // vacío para que el usuario ingrese
            setPhase('review')
        } catch (e) {
            if (cancelledRef.current) return
            console.error(e)
            const msg = !navigator.onLine
                ? '📡 Sin conexión — verifica tu internet'
                : 'No se pudo analizar — intenta de nuevo'
            showToast(msg)
            restart()
        } finally {
            clearInterval(progressRef.current)
            setScanning(false)
        }
    }, [scanning, flashOn])

    // ── Cancelar análisis en curso ────────────────────────────────────────────
    const cancelScan = () => {
        cancelledRef.current = true
        clearInterval(progressRef.current)
        setScanning(false)
        setProgress(0)
        restart()
        showToast('Escaneo cancelado')
    }

    // ── Reiniciar (volver a la cámara) ───────────────────────────────────────
    const restart = () => {
        setPhase('camera')
        setSnapshot(null)
        setItems([])
        setChecked([])
        setTotalQty('')
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
        cancelledRef.current = true
        clearInterval(progressRef.current)
        stopCamera()
        setPhase('camera')
        setSnapshot(null)
        setItems([])
        setChecked([])
        setTotalQty('')
        setFocusPoint(null)
        setProgress(0)
        onClose()
    }

    // Limpiar timers al desmontar
    useEffect(() => {
        return () => {
            clearTimeout(focusTimerRef.current)
            clearInterval(progressRef.current)
        }
    }, [])

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
    // FASE: REVIEW — Delegada a ScanReview
    // ═══════════════════════════════════════════════════════════════════
    if (phase === 'review') {
        return (
            <ScanReview
                snapshot={snapshot}
                items={items}
                checked={checked}
                totalQty={totalQty}
                onTotalQtyChange={setTotalQty}
                onToggle={toggleItem}
                onSave={handleSave}
                onRestart={restart}
                onClose={handleClose}
                rootStyle={rootStyle}
                headerStyle={headerStyle}
                bottomStyle={bottomStyle}
            />
        )
    }

    // ═══════════════════════════════════════════════════════════════════
    // FASES: CAMERA + ANALYZING — Viewfinder fullscreen
    // ═══════════════════════════════════════════════════════════════════
    return (
        <div style={rootStyle}>
            {/* Header con título + flash + cerrar */}
            <div style={headerStyle}>
                <div className="flex items-center gap-2">
                    <SparkIcon size={18} className="text-[#FF6B1A]" />
                    <span className="text-white font-bold text-sm tracking-wide">Escáner IA</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Botón Flash — solo visible si el dispositivo lo soporta */}
                    {flashSupported && phase === 'camera' && (
                        <button
                            onClick={toggleFlash}
                            className="w-9 h-9 flex items-center justify-center rounded-full transition-all"
                            style={{
                                background: flashOn
                                    ? 'rgba(255,214,10,0.25)'
                                    : 'rgba(255,255,255,0.1)',
                                border: flashOn
                                    ? '1.5px solid rgba(255,214,10,0.5)'
                                    : '1.5px solid transparent',
                            }}
                            aria-label={flashOn ? 'Apagar flash' : 'Encender flash'}
                        >
                            {/* Icono de rayo/flash */}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                stroke={flashOn ? '#FFD60A' : '#ffffff80'}
                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                        </button>
                    )}
                    {/* Botón cerrar */}
                    <button
                        onClick={handleClose}
                        className="w-9 h-9 flex items-center justify-center rounded-full
                         bg-white/10 text-white hover:bg-white/20 transition-colors"
                    >
                        <XIcon size={18} />
                    </button>
                </div>
            </div>

            {/* Viewfinder fullscreen — TOCA PARA ENFOCAR */}
            <div
                onClick={handleTapToFocus}
                style={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#000',
                    minHeight: 0,
                    cursor: phase === 'camera' ? 'crosshair' : 'default',
                }}
            >
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

                {/* ── Animación de enfoque (reticle) ── */}
                {focusPoint && phase === 'camera' && (
                    <div style={{
                        position: 'absolute',
                        left: focusPoint.x - 30,
                        top: focusPoint.y - 30,
                        width: 60,
                        height: 60,
                        pointerEvents: 'none',
                        zIndex: 30,
                    }}>
                        {/* Cuadro de enfoque con animación */}
                        <div style={{
                            width: '100%',
                            height: '100%',
                            border: '2px solid rgba(255,214,10,0.9)',
                            borderRadius: 8,
                            animation: 'focusPulse 0.8s ease-out',
                            boxShadow: '0 0 20px rgba(255,214,10,0.3)',
                        }} />
                        {/* Cruz central */}
                        <div style={{
                            position: 'absolute',
                            top: '50%', left: '50%',
                            transform: 'translate(-50%,-50%)',
                            width: 12, height: 12,
                        }}>
                            <div style={{
                                position: 'absolute', top: '50%', left: 0,
                                width: '100%', height: 1,
                                background: 'rgba(255,214,10,0.7)',
                            }} />
                            <div style={{
                                position: 'absolute', left: '50%', top: 0,
                                height: '100%', width: 1,
                                background: 'rgba(255,214,10,0.7)',
                            }} />
                        </div>
                    </div>
                )}

                {/* Overlay de análisis — Foto circular con arco de progreso */}
                {phase === 'analyzing' && (
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#0D0D11',
                        zIndex: 20,
                    }}>
                        <div className="flex flex-col items-center gap-6">
                            {/* Foto circular con arco de progreso */}
                            <div style={{
                                position: 'relative',
                                width: 220,
                                height: 220,
                            }}>
                                {/* Arco de progreso (fondo gris) */}
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    borderRadius: '50%',
                                    background: 'conic-gradient(rgba(255,255,255,0.06) 0deg, rgba(255,255,255,0.06) 360deg)',
                                }} />
                                {/* Arco de progreso (relleno gradient) */}
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    borderRadius: '50%',
                                    background: `conic-gradient(#30D158 0deg, #FF6B1A ${progress * 3.6}deg, transparent ${progress * 3.6}deg)`,
                                    transition: 'all 0.4s ease',
                                }} />
                                {/* Máscara interior para crear el anillo */}
                                <div style={{
                                    position: 'absolute',
                                    inset: 8,
                                    borderRadius: '50%',
                                    background: '#0D0D11',
                                }} />
                                {/* Foto dentro del círculo */}
                                {snapshot && (
                                    <img
                                        src={snapshot}
                                        alt="captura"
                                        style={{
                                            position: 'absolute',
                                            inset: 12,
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            width: 'calc(100% - 24px)',
                                            height: 'calc(100% - 24px)',
                                        }}
                                    />
                                )}
                                {/* Percentage badge */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: 4,
                                    right: 4,
                                    background: '#1C1C26',
                                    border: '3px solid #0D0D11',
                                    borderRadius: 20,
                                    padding: '3px 10px',
                                    fontSize: 13,
                                    fontWeight: 900,
                                    color: '#30D158',
                                }}>
                                    {progress}%
                                </div>
                            </div>

                            {/* Texto */}
                            <div className="text-center">
                                <p style={{
                                    color: '#fff',
                                    fontSize: 18,
                                    fontWeight: 900,
                                    marginBottom: 6,
                                }}>
                                    Analizando tu comida...
                                </p>
                                <p style={{
                                    color: '#7B7D94',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }}>
                                    🤖 Gemini IA detectando ingredientes
                                </p>
                            </div>

                            {/* Barra de progreso horizontal */}
                            <div style={{
                                width: 200,
                                height: 4,
                                borderRadius: 2,
                                background: 'rgba(255,255,255,0.06)',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: progress + '%',
                                    borderRadius: 2,
                                    background: 'linear-gradient(90deg, #30D158, #FF6B1A)',
                                    transition: 'width 0.4s ease',
                                    boxShadow: '0 0 8px rgba(48,209,88,0.4)',
                                }} />
                            </div>

                            {/* Botón cancelar */}
                            <button
                                onClick={cancelScan}
                                style={{
                                    marginTop: 4,
                                    padding: '10px 28px',
                                    borderRadius: 14,
                                    border: '1.5px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.04)',
                                    color: 'rgba(255,255,255,0.5)',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                            >
                                ✕ Cancelar
                            </button>
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

                        {/* Hint actualizado */}
                        <div style={{
                            position: 'absolute',
                            bottom: 20, left: 0, right: 0,
                            display: 'flex', justifyContent: 'center',
                        }}>
                            <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
                                <p className="text-white/80 text-xs font-semibold text-center">
                                    Toca para enfocar · Luego presiona Escanear
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

                {/* En fase analyzing, los controles inferiores están vacíos
                    (el botón cancelar está en el overlay central) */}
            </div>

            {/* Animación CSS para el reticle de enfoque */}
            <style>{`
                @keyframes focusPulse {
                    0% { transform: scale(1.5); opacity: 0; }
                    30% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.6; }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </div>
    )
}
