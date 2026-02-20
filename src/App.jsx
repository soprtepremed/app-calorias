import { useState, useEffect } from 'react'
import './index.css'
import { getConfig } from './services/supabase'
import { requestNotificationPermission, startWaterReminder } from './services/water'
import Dashboard from './components/Dashboard'
import History from './components/History'
import Weight from './components/Weight'
import Settings from './components/Settings'
import { Toast } from './components/UI'
import { HomeIcon, ChartIcon, ScaleIcon, SettingsIcon } from './components/Icons'

// ── Navegación inferior ───────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Inicio', Icon: HomeIcon },
  { key: 'history', label: 'Historial', Icon: ChartIcon },
  { key: 'weight', label: 'Peso', Icon: ScaleIcon },
  { key: 'settings', label: 'Ajustes', Icon: SettingsIcon },
]

// ── App principal ─────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('dashboard')
  const [config, setConfig] = useState(null)
  const [configId, setConfigId] = useState(null)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)

  /** Muestra un toast temporal */
  const showToast = (msg) => {
    setToast({ msg, id: Date.now() })
    setTimeout(() => setToast(null), 2800)
  }

  /** Carga la configuración del usuario desde Supabase */
  useEffect(() => {
    getConfig()
      .then(cfg => {
        setConfig(cfg)
        setConfigId(cfg?.id)
      })
      .catch(e => {
        console.error('Error cargando config:', e)
        setConfig({ calorie_goal: 2000, water_goal: 8, water_reminder_hours: 2, name: 'Usuario', notifications_enabled: true })
      })
      .finally(() => setLoading(false))
  }, [])

  /** Inicia recordatorios de agua al cargar config */
  useEffect(() => {
    if (!config?.notifications_enabled) return
    requestNotificationPermission().then(granted => {
      if (granted) {
        startWaterReminder(
          config.water_reminder_hours ?? 2,
          config.water_goal ?? 8,
          () => 0    // getCurrentGlasses — simplificado
        )
      }
    })
  }, [config])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0B0C10]">
        {/* Logo loader */}
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 border-4 border-[#FF6B1A]/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-transparent border-t-[#FF6B1A] rounded-full spinner" />
        </div>
        <p className="text-[#7B7D94] text-sm font-semibold tracking-widest uppercase">Cargando KCal</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white max-w-lg mx-auto">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-[#0B0C10]/90 backdrop-blur-md
                         border-b border-[#2A2B38] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Logo */}
          <div className="w-8 h-8 bg-[#FF6B1A] rounded-lg flex items-center justify-center
                          shadow-lg shadow-[#FF6B1A]/30">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M8.5 14.5A3.5 3.5 0 0 0 12 18a3.5 3.5 0 0 0 3.5-3.5c0-1.5-1-2.5-1.5-3.5-.5 1-1.5 1.5-2 2-.5-.5-1.5-2-1.5-3a5 5 0 0 1 5-5c0 4 3 5 3 8a6 6 0 0 1-12 0c0-2 1-4 2-5 0 2 .5 3.5 1.5 4.5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-black text-white tracking-tight leading-none">KCal</h1>
            {config?.name && config.name !== 'Usuario' && (
              <p className="text-[10px] text-[#7B7D94] font-semibold leading-none mt-0.5">
                Hola, {config.name}
              </p>
            )}
          </div>
        </div>

        {/* Indicador activo */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-[#00E5A0] rounded-full" />
          <span className="text-[10px] font-bold text-[#7B7D94] uppercase tracking-widest">
            {NAV_ITEMS.find(n => n.key === page)?.label}
          </span>
        </div>
      </header>

      {/* ── Contenido ───────────────────────────────────────────────── */}
      <main className="px-4 pt-4 pb-28 min-h-[calc(100vh-120px)]">
        {page === 'dashboard' && <Dashboard config={config} showToast={showToast} />}
        {page === 'history' && <History config={config} />}
        {page === 'weight' && <Weight showToast={showToast} />}
        {page === 'settings' && (
          <Settings
            config={config}
            configId={configId}
            onConfigUpdate={updated => setConfig(c => ({ ...c, ...updated }))}
            showToast={showToast}
          />
        )}
      </main>

      {/* ── Nav inferior ────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg
                      bg-[#0B0C10]/95 backdrop-blur-md border-t border-[#2A2B38]
                      flex z-10 safe-area-bottom">
        {NAV_ITEMS.map(({ key, label, Icon }) => {
          const active = page === key
          return (
            <button
              key={key}
              onClick={() => setPage(key)}
              className={`
                flex-1 flex flex-col items-center justify-center py-3 gap-1
                transition-all duration-200 relative
                ${active ? 'text-[#FF6B1A]' : 'text-[#7B7D94] hover:text-white'}
              `}
            >
              {/* Dot activo */}
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5
                                bg-[#FF6B1A] rounded-b-full" />
              )}
              <Icon size={22} />
              <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Toast */}
      <Toast toast={toast} />
    </div>
  )
}
