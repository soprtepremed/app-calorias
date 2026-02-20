/**
 * Icons.jsx — Íconos SVG personalizados estilo deportivo
 * Todos los íconos son SVG inline para mayor control de estilo.
 * Basados en el estilo de Lucide Icons pero con trazo más grueso.
 */

const defaults = { width: 24, height: 24, stroke: 'currentColor', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

const Svg = ({ size = 24, className = '', children, ...props }) => (
    <svg
        width={size} height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
    >
        {children}
    </svg>
)

/** 🏠 Home — Dashboard */
export const HomeIcon = (p) => (
    <Svg {...p}>
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
    </Svg>
)

/** 🔥 Fuego — Calorías */
export const FlameIcon = (p) => (
    <Svg {...p}>
        <path d="M8.5 14.5A3.5 3.5 0 0 0 12 18a3.5 3.5 0 0 0 3.5-3.5c0-1.5-1-2.5-1.5-3.5-.5 1-1.5 1.5-2 2-.5-.5-1.5-2-1.5-3a5 5 0 0 1 5-5c0 4 3 5 3 8a6 6 0 0 1-12 0c0-2 1-4 2-5 0 2 .5 3.5 1.5 4.5z" />
    </Svg>
)

/** 📊 Gráfica — Historial */
export const ChartIcon = (p) => (
    <Svg {...p}>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
    </Svg>
)

/** ⚖️ Báscula — Peso */
export const ScaleIcon = (p) => (
    <Svg {...p}>
        <path d="M12 3a1 1 0 0 0-1 1v.5H5a1 1 0 0 0-1 1L3 17a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3l-1-11.5a1 1 0 0 0-1-1h-6V4a1 1 0 0 0-1-1z" />
        <path d="M8 17l1.5-4.5M16 17l-1.5-4.5M9.5 12.5h5" />
    </Svg>
)

/** ⚙️ Engrane — Ajustes */
export const SettingsIcon = (p) => (
    <Svg {...p}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
)

/** ➕ Plus — Añadir */
export const PlusIcon = (p) => (
    <Svg {...p}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
)

/** 💧 Gota — Agua */
export const DropIcon = (p) => (
    <Svg {...p}>
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </Svg>
)

/** 🗑️ Basura — Eliminar */
export const TrashIcon = (p) => (
    <Svg {...p}>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
)

/** 📷 Cámara — Foto */
export const CameraIcon = (p) => (
    <Svg {...p}>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
    </Svg>
)

/** ✏️ Lápiz — Manual */
export const PencilIcon = (p) => (
    <Svg {...p}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
)

/** ✓ Check */
export const CheckIcon = (p) => (
    <Svg {...p}>
        <polyline points="20 6 9 17 4 12" />
    </Svg>
)

/** ✕ X — Cerrar */
export const XIcon = (p) => (
    <Svg {...p}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
)

/** 🤖 Chispa — IA */
export const SparkIcon = (p) => (
    <Svg {...p}>
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </Svg>
)

/** 📅 Calendario */
export const CalendarIcon = (p) => (
    <Svg {...p}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
)

/** ↑ Flecha arriba — Peso subió */
export const ArrowUpIcon = (p) => (
    <Svg {...p}>
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
    </Svg>
)

/** ↓ Flecha abajo — Peso bajó */
export const ArrowDownIcon = (p) => (
    <Svg {...p}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
    </Svg>
)

/** 🥩 Proteína */
export const ProteinIcon = (p) => (
    <Svg {...p}>
        <path d="M6.5 6.5c3.5-3.5 9-2.5 10 2s-3 7.5-7 8-7-3-6-7" />
        <path d="M6.5 6.5L4 4M17.5 17.5L20 20" />
    </Svg>
)

/** 🌾 Carbos */
export const CarbsIcon = (p) => (
    <Svg {...p}>
        <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" />
        <circle cx="12" cy="9" r="2.5" />
    </Svg>
)

/** 🫒 Grasa */
export const FatIcon = (p) => (
    <Svg {...p}>
        <ellipse cx="12" cy="12" rx="7" ry="5" />
        <path d="M12 7V5M12 19v-2" />
        <path d="M5 12H3M21 12h-2" />
    </Svg>
)

/** 🔑 Llave — API Key */
export const KeyIcon = (p) => (
    <Svg {...p}>
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </Svg>
)

/** ℹ️ Info */
export const InfoIcon = (p) => (
    <Svg {...p}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </Svg>
)

/** 💪 Músculo — Fuerza / Fitness */
export const MuscleIcon = (p) => (
    <Svg {...p}>
        <path d="M6.5 6.5c-.5-1.5.5-3 2-3s2.5 1 2.5 2.5L9 8.5c1 .5 2 1.5 2 3 0 2-1.5 3.5-3.5 3.5S4 13.5 4 11.5c0-1 .5-2 1-2.5" />
        <path d="M14 6h6M17 3v6" />
        <path d="M14 18h6M17 15v6" />
    </Svg>
)

/** Bell — Notificación */
export const BellIcon = (p) => (
    <Svg {...p}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
)

/** 🏃 Corredor — Activity */
export const ActivityIcon = (p) => (
    <Svg {...p}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </Svg>
)

/** Sol — Mañana (desayuno) */
export const SunIcon = (p) => (
    <Svg {...p}>
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </Svg>
)

/** Luna — Noche (cena) */
export const MoonIcon = (p) => (
    <Svg {...p}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Svg>
)

/** Utensilio — Almuerzo */
export const UtensilsIcon = (p) => (
    <Svg {...p}>
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <line x1="7" y1="2" x2="7" y2="11" />
        <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </Svg>
)

/** Apple — Snack */
export const AppleIcon = (p) => (
    <Svg {...p}>
        <path d="M12 17c-2.8 0-5-2.8-5-6 0-3.5 2-5.5 5-5.5s5 2 5 5.5c0 3.2-2.2 6-5 6z" />
        <path d="M12 6V4M12 4c0 0 1-2 3-2" />
    </Svg>
)

/** Mapa de emojis de comida a iconos (fallback) */
export const MEAL_ICONS = {
    desayuno: SunIcon,
    almuerzo: UtensilsIcon,
    cena: MoonIcon,
    snack: AppleIcon,
    otro: UtensilsIcon,
}

export const MEAL_LABELS = {
    desayuno: 'Desayuno',
    almuerzo: 'Almuerzo',
    cena: 'Cena',
    snack: 'Snack',
    otro: 'Otro',
}
