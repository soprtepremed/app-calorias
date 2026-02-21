import { useState, useEffect, useRef, useCallback } from 'react'
import './index.css'
import { getConfig, getSession, onAuthChange, signOut } from './services/supabase'
import { requestNotificationPermission, startWaterReminder, stopWaterReminder } from './services/water'
import { initOfflineSync, flushQueue, hasPending } from './services/offlineQueue'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import History from './components/History'
import Weight from './components/Weight'
import Settings from './components/Settings'
import { Toast } from './components/UI'
import { HomeIcon, ChartIcon, ScaleIcon, SettingsIcon, FlameIcon } from './components/Icons'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Inicio', Icon: HomeIcon },
  { key: 'history', label: 'Historial', Icon: ChartIcon },
  { key: 'weight', label: 'Peso', Icon: ScaleIcon },
  { key: 'settings', label: 'Ajustes', Icon: SettingsIcon },
]

// ── Loading screen ──────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-[#0D0D11]">
      <div className="relative w-16 h-16 mb-5">
        <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
        <div className="absolute inset-0 border-4 border-transparent border-t-[#FF375F] rounded-full spinner" />
        <div className="absolute inset-3 flex items-center justify-center">
          <FlameIcon size={18} className="text-[#FF375F]" />
        </div>
      </div>
      <p className="text-[#8E8EA0] text-sm font-semibold tracking-widest uppercase">Cargando</p>
    </div>
  )
}

// ── Sidebar escritorio ──────────────────────────────────────────────────────
function DesktopSidebar({ page, setPage, config, onSignOut }) {
  return (
    <aside className="hidden md:flex flex-col w-64 bg-[#111116] border-r border-[#1A1A22] h-dvh sticky top-0 shrink-0">
      <div className="px-6 py-7 border-b border-[#1A1A22]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#FF375F,#FF6B1A)', boxShadow: '0 0 18px rgba(255,55,95,0.35)' }}>
            <FlameIcon size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white leading-none">K-Cal</h1>
            <p className="text-[10px] text-[#8E8EA0] font-semibold tracking-wider mt-0.5">CALCULADORA CON IA</p>
          </div>
        </div>

        {/* Avatar usuario */}
        {config && (
          <div className="mt-4 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#252530] border border-[#2E2E3A]">
            <div className="w-8 h-8 rounded-full bg-[#FF6B1A]/20 border border-[#FF6B1A]/30
                            flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" shapeRendering="geometricPrecision">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{config.name ?? 'Usuario'}</p>
              <p className="text-[10px] text-[#8E8EA0]">Activo</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV_ITEMS.map(({ key, label, Icon }) => {
          const active = page === key
          return (
            <button key={key} onClick={() => setPage(key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
                transition-all duration-200 text-left
                ${active
                  ? 'bg-[#FF375F]/12 text-[#FF375F] border border-[#FF375F]/20'
                  : 'text-[#8E8EA0] hover:bg-white/5 hover:text-white'
                }`}
            >
              <Icon size={18} />
              {label}
              {active && <div className="ml-auto w-1.5 h-1.5 bg-[#FF375F] rounded-full" />}
            </button>
          )
        })}
      </nav>

      {/* Cerrar sesión */}
      <div className="px-4 pb-6 pt-2 border-t border-[#1A1A22]">
        <button onClick={onSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                     text-[#8E8EA0] hover:text-red-400 hover:bg-red-500/8
                     text-sm font-semibold transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Cerrar sesión
        </button>
        <p className="text-[9px] text-[#8E8EA0] text-center mt-3">K-Cal v1.0 · Gemini + Supabase</p>
      </div>
    </aside>
  )
}

// ── Header escritorio ───────────────────────────────────────────────────────
function DesktopHeader({ page }) {
  const item = NAV_ITEMS.find(n => n.key === page)
  return (
    <header className="hidden md:flex items-center justify-between px-8 py-5
                       border-b border-[#1A1A22] bg-[#0D0D11] sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {item?.Icon && <item.Icon size={20} className="text-[#FF375F]" />}
        <h2 className="text-xl font-black text-white">{item?.label}</h2>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-[#8E8EA0] font-bold uppercase tracking-widest">
        <div className="w-2 h-2 bg-[#30D158] rounded-full" />
        En línea
      </div>
    </header>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Estado de sesión: undefined = cargando, null = sin sesión, object = autenticado
  // NO leemos localStorage manualmente (era frágil y dependía del formato interno de Supabase).
  // Dejamos que onAuthStateChange → INITIAL_SESSION nos diga si hay sesión o no.
  const [session, setSession] = useState(undefined)
  const [page, setPage] = useState('dashboard')
  const [config, setConfig] = useState(null)
  const [configId, setConfigId] = useState(null)
  const [toast, setToast] = useState(null)

  // Ref para pasar getter real de vasos al recordatorio de agua
  const glassesRef = useRef(0)

  /** Setter que el Dashboard llama para mantener el ref actualizado */
  const updateGlassesRef = useCallback((g) => { glassesRef.current = g }, [])

  const showToast = (msg) => {
    setToast({ msg, id: Date.now() })
    setTimeout(() => setToast(null), 2800)
  }

  // ── Inicializar offline sync al arrancar ─────────────────────────────────
  useEffect(() => {
    initOfflineSync()

    // Timeout de seguridad: si INITIAL_SESSION nunca dispara (red caída, etc.),
    // forzar session=null para no quedarse en spinner infinito
    const safetyTimer = setTimeout(() => {
      setSession(prev => prev === undefined ? null : prev)
    }, 4000)
    return () => clearTimeout(safetyTimer)
  }, [])

  // ── Navegación con History API (gesto atrás en iOS/Android) ─────────────
  // Cada cambio de página pushea al historial del navegador.
  // Al hacer swipe-back/botón atrás, vuelve a la página anterior de la app.
  const setPageWithHistory = useCallback((newPage) => {
    if (newPage === page) return
    window.history.pushState({ page: newPage }, '', '')
    setPage(newPage)
  }, [page])

  useEffect(() => {
    // Estado inicial
    window.history.replaceState({ page: 'dashboard' }, '', '')

    const handlePop = (e) => {
      const prevPage = e.state?.page ?? 'dashboard'
      setPage(prevPage)
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  // ── Verificar sesión + escuchar cambios ─────────────────────────────────
  // La sesión ya se leyó de localStorage arriba (instantánea).
  // Solo reaccionamos a SIGNED_IN / SIGNED_OUT, NO a TOKEN_REFRESHED.
  const currentUserRef = useRef(session?.user?.id ?? null)

  useEffect(() => {
    let cancelled = false
    let configLoaded = false

    const loadConfig = async () => {
      if (configLoaded) return // No recargar si ya tenemos config
      try {
        const cfg = await getConfig()
        if (!cancelled) {
          setConfig(cfg)
          setConfigId(cfg?.id)
          configLoaded = true
        }
      } catch (e) {
        console.error('Error cargando config:', e)
      }
    }

    // Si ya tenemos sesión de localStorage, cargar config inmediatamente
    if (session?.user) {
      loadConfig()
    }

    // Listener para cambios REALES (login/logout), NO refreshes de token
    const unsub = onAuthChange(async (sess, event) => {
      if (cancelled) return

      // En TOKEN_REFRESHED solo actualizar ref de sesión silenciosamente
      if (event === 'TOKEN_REFRESHED') {
        if (sess) setSession(sess)
        return
      }

      // INITIAL_SESSION: al recargar la página, Supabase confirma la sesión
      // Necesitamos cargar config si aún no la tenemos
      if (event === 'INITIAL_SESSION') {
        setSession(sess ?? null) // SIEMPRE actualizar: sess o null (→ login)
        if (sess) {
          currentUserRef.current = sess.user?.id ?? null
          if (!configLoaded) await loadConfig()
        }
        return
      }

      const newUserId = sess?.user?.id ?? null
      const prevUserId = currentUserRef.current
      currentUserRef.current = newUserId

      setSession(sess ?? null)

      if (sess && event === 'SIGNED_IN') {
        // Solo cargar config si es un usuario DIFERENTE o no la tenemos
        if (newUserId !== prevUserId || !configLoaded) {
          configLoaded = false
          await loadConfig()
        }

        // Sincronizar cola offline al autenticarse
        if (hasPending()) {
          flushQueue().then(n => {
            if (n > 0) showToast(`☁️ ${n} dato(s) sincronizado(s)`)
          })
        }

        // Iniciar recordatorios de agua con getter REAL de vasos
        requestNotificationPermission().then(granted => {
          if (granted) startWaterReminder(
            config?.water_reminder_hours ?? 2,
            config?.water_goal ?? 8,
            () => glassesRef.current
          )
        })
      } else if (!sess) {
        // SIGNED_OUT
        configLoaded = false
        setConfig(null)
        setConfigId(null)
        stopWaterReminder?.()
      }
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


  const handleSignOut = async () => {
    // 1. Limpiar estado local INMEDIATAMENTE — la UI siempre responde
    setSession(null)
    setConfig(null)
    setConfigId(null)
    setPage('dashboard')
    stopWaterReminder?.()

    // 2. Borrar localStorage de Supabase manualmente (por si la red falla)
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k))
    } catch { /* silencioso */ }

    // 3. Notificar a Supabase en segundo plano (no bloqueante)
    signOut().catch(() => { /* ignora errores de red */ })

    showToast('Sesión cerrada')
  }


  // ── Estados de carga ────────────────────────────────────────────────────
  // undefined = esperando confirmación de Supabase → mostrar loading
  if (session === undefined) return <LoadingScreen />
  // null = Supabase confirmó que NO hay sesión → mostrar login
  if (session === null) return <Auth />

  // ── Contenido por página ────────────────────────────────────────────────
  const PageContent = () => {
    switch (page) {
      case 'dashboard': return <Dashboard config={config} showToast={showToast} onGlassesChange={updateGlassesRef} />
      case 'history': return <History config={config} />
      case 'weight': return <Weight showToast={showToast} />
      case 'settings': return (
        <Settings
          config={config}
          configId={configId}
          onConfigUpdate={u => setConfig(c => ({ ...c, ...u }))}
          showToast={showToast}
        />
      )
      default: return null
    }
  }

  return (
    <div className="min-h-dvh bg-[#0D0D11] text-white">

      {/* Layout dual — sidebar en md+, nav inferior en móvil */}
      <div className="md:flex md:h-dvh md:overflow-hidden">

        {/* Sidebar escritorio */}
        <DesktopSidebar page={page} setPage={setPageWithHistory} config={config} onSignOut={handleSignOut} />

        {/* Columna principal */}
        <div className="flex-1 flex flex-col md:min-h-0 md:overflow-y-auto">

          {/* Header escritorio */}
          <DesktopHeader page={page} />

          {/* Header móvil */}
          <header className="md:hidden sticky top-0 z-10 bg-[#0D0D11]/98 backdrop-blur-md
                             border-b border-[#1A1A22] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg,#FF375F,#FF6B1A)', boxShadow: '0 0 12px rgba(255,55,95,0.4)' }}>
                <FlameIcon size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-black text-white leading-none">K-Cal</h1>
                {config?.name && (
                  <p className="text-[10px] text-[#8E8EA0] leading-none mt-0.5">
                    Hola, {config.name.split(' ')[0]}
                  </p>
                )}
              </div>
            </div>
            {/* Cerrar sesión móvil */}
            <button onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                         bg-[#252530] border border-[#2E2E3A] text-[#8E8EA0]
                         text-xs font-semibold hover:text-red-400 hover:border-red-500/30 transition-all">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Salir
            </button>
          </header>

          {/* Scroll area */}
          <main className="flex-1 px-4 pt-4 pb-28 md:overflow-y-auto md:px-8 md:pt-6 md:pb-8 md:max-w-2xl md:w-full md:mx-auto">
            <PageContent />
          </main>
        </div>
      </div>

      {/* Nav inferior (solo móvil) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0
                      bg-[#0D0D11]/98 backdrop-blur-md border-t border-[#1A1A22] flex z-10">
        {NAV_ITEMS.map(({ key, label, Icon }) => {
          const active = page === key
          return (
            <button key={key} onClick={() => setPageWithHistory(key)}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5
                transition-all duration-200 relative
                ${active ? 'text-[#FF375F]' : 'text-[#8E8EA0] active:text-white'}`}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#FF375F] rounded-b-full" />
              )}
              <Icon size={22} />
              <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">{label}</span>
            </button>
          )
        })}
      </nav>

      <Toast toast={toast} />
    </div>
  )
}
