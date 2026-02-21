---
description: Reusable UI patterns and design system for dark-theme mobile-first health/fitness apps
---

# Skill: Dark Theme Health App UI Patterns

Patrones de UI reutilizables para apps de salud/fitness con tema oscuro. 
Probados en producción en la app K-Cal.

---

## Paleta de Colores

```css
:root {
  --bg-primary:    #0D0D11;  /* Fondo de la app */
  --bg-surface:    #1C1C26;  /* Cards, modales */
  --bg-elevated:   #2A2A3A;  /* Elementos elevados */
  --accent-red:    #FF375F;  /* Calorías, CTAs principales */
  --accent-orange: #FF6B1A;  /* IA, scanner, warnings */
  --accent-green:  #30D158;  /* Proteína, éxito, progreso */
  --accent-blue:   #0A84FF;  /* Grasas, agua */
  --accent-yellow: #FF9F0A;  /* Carbohidratos */
  --text-primary:  #FFFFFF;
  --text-secondary:#8E8EA0;
  --text-muted:    #7B7D94;
  --border-subtle: rgba(255,255,255,0.06);
}
```

---

## Activity Rings (Estilo Apple Fitness)

```jsx
function Ring({ pct, color, size = 120, stroke = 8 }) {
    const r = (size - stroke) / 2
    const C = 2 * Math.PI * r
    const offset = C * (1 - Math.min(pct, 1))
    return (
        <svg width={size} height={size}>
            <circle cx={size/2} cy={size/2} r={r}
                fill="none" stroke="rgba(255,255,255,0.06)"
                strokeWidth={stroke} />
            <circle cx={size/2} cy={size/2} r={r}
                fill="none" stroke={color}
                strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={offset}
                transform={`rotate(-90 ${size/2} ${size/2})`}
                style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
    )
}
```

---

## Macro Cards

```jsx
const cards = [
    { label: 'Calorías', value: cal, color: '#FF375F', icon: '🔥' },
    { label: 'Proteína', value: `${prot}g`, color: '#30D158', icon: '💪' },
    { label: 'Carbos',   value: `${carbs}g`, color: '#FF9F0A', icon: '🌾' },
    { label: 'Grasas',   value: `${fat}g`, color: '#0A84FF', icon: '💧' },
]

{cards.map(c => (
    <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16, padding: '14px 16px',
    }}>
        <span style={{ fontSize: 24 }}>{c.icon}</span>
        <p style={{ color: c.color, fontSize: 24, fontWeight: 900 }}>{c.value}</p>
        <p style={{ color: '#8E8EA0', fontSize: 11, fontWeight: 700 }}>{c.label}</p>
    </div>
))}
```

---

## Barra de Macros Proporcional

```jsx
function MacroBar({ protein, carbs, fat }) {
    const total = protein + carbs + fat || 1
    return (
        <div style={{ display: 'flex', height: 8, borderRadius: 4, gap: 2in }}>
            <div style={{ width: `${(carbs/total)*100}%`, background: '#FF9F0A' }} />
            <div style={{ width: `${(fat/total)*100}%`, background: '#0A84FF' }} />
            <div style={{ width: `${(protein/total)*100}%`, background: '#30D158' }} />
        </div>
    )
}
```

---

## Foto Circular con Arco de Progreso

```jsx
function CircularProgress({ src, progress }) {
    return (
        <div style={{ position: 'relative', width: 220, height: 220 }}>
            {/* Fondo del arco */}
            <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
            }} />
            {/* Arco de progreso */}
            <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: `conic-gradient(#30D158 0deg, #FF6B1A ${progress * 3.6}deg, transparent ${progress * 3.6}deg)`,
                transition: 'all 0.4s ease',
            }} />
            {/* Máscara interior */}
            <div style={{
                position: 'absolute', inset: 8, borderRadius: '50%',
                background: '#0D0D11',
            }} />
            {/* Foto */}
            <img src={src} style={{
                position: 'absolute', inset: 12, borderRadius: '50%',
                objectFit: 'cover', width: 'calc(100% - 24px)', height: 'calc(100% - 24px)',
            }} />
            {/* Badge de porcentaje */}
            <div style={{
                position: 'absolute', bottom: 4, right: 4,
                background: '#1C1C26', border: '3px solid #0D0D11',
                borderRadius: 20, padding: '3px 10px',
                fontSize: 13, fontWeight: 900, color: '#30D158',
            }}>
                {progress}%
            </div>
        </div>
    )
}
```

---

## Checkbox Toggle Item (Lista de ingredientes)

```jsx
<button style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 14, width: '100%',
    border: sel ? '1.5px solid rgba(48,209,88,0.3)' : '1.5px solid rgba(255,255,255,0.04)',
    background: sel ? 'rgba(48,209,88,0.06)' : 'transparent',
}}>
    <span style={{ fontSize: 24 }}>{emoji}</span>
    <span style={{ flex: 1, color: '#fff', fontWeight: 700 }}>{name}</span>
    <span style={{ color: '#8E8EA0', fontSize: 13 }}>{kcal} kcal</span>
    <div style={{
        width: 22, height: 22, borderRadius: 7,
        border: sel ? '2px solid #30D158' : '2px solid rgba(255,255,255,0.12)',
        background: sel ? '#30D158' : 'transparent',
    }}>
        {sel && <CheckIcon size={13} />}
    </div>
</button>
```

---

## Botón Premium (Confirmar)

```jsx
<button style={{
    flex: 1, padding: '14px 24px',
    borderRadius: 16, border: 'none',
    background: '#fff', color: '#000',
    fontSize: 15, fontWeight: 900,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}}>
    Confirmar <span style={{ fontSize: 16 }}>→</span>
</button>
```

---

## Toast Notification

```jsx
function Toast({ msg, visible }) {
    return (
        <div style={{
            position: 'fixed', bottom: 100, left: '50%',
            transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
            opacity: visible ? 1 : 0,
            background: '#1C1C26', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '12px 20px',
            color: '#fff', fontSize: 14, fontWeight: 700,
            transition: 'all 0.3s ease',
            zIndex: 99999, pointerEvents: 'none',
        }}>
            {msg}
        </div>
    )
}
```

---

## Tipografía

Google Fonts: **Inter** (400, 500, 600, 700, 800, 900)

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

Regla: usar `fontWeight: 900` (Black) para números grandes y títulos. 
`fontWeight: 700` para labels. `fontWeight: 600` para texto secundario.
