---
description: How to build a mobile-first calorie/nutrition tracking PWA with AI food recognition using React, Supabase, and Gemini
---

# Skill: AI Food Scanner PWA

Este skill documenta el patrón completo para crear una PWA de tracking nutricional
con escáner de cámara basado en IA de visión (Gemini). Reutilizable para cualquier
app similar de salud/fitness.

---

## Prerequisitos

- Node.js 18+
- Proyecto Supabase (Auth + PostgreSQL + Storage + Edge Functions)
- API Key de Google Gemini (almacenada como secret en Supabase)

---

## 1. Inicialización del Proyecto

```bash
npx -y create-vite@latest ./ --template react
npm install @supabase/supabase-js tailwindcss @tailwindcss/vite
```

### vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,       // Accesible por IP local (probar en móvil)
    port: 5173,
    cors: true,
  },
})
```

### PWA Setup
- `public/manifest.json` con `display: standalone`, `orientation: portrait`
- `public/sw.js` con cache de assets estáticos
- Meta tags en `index.html`: `apple-mobile-web-app-capable`, `theme-color`, `viewport-fit=cover`

---

## 2. Arquitectura de Servicios

### Patrón: Proxy Seguro para IA

**NUNCA** exponer API keys de IA en el frontend. Usar Edge Function:

```
Frontend → supabase.functions.invoke('gemini-proxy') → Gemini API
```

La Edge Function:
1. Valida JWT del usuario autenticado
2. Lee GEMINI_API_KEY de secrets de Deno
3. Llama a Gemini con fallback de modelos
4. Retry automático en rate limits (429)
5. Retorna respuesta + metadata de tokens

### Patrón: Cola Offline (Store & Forward)

```
Sin internet → localStorage (enqueue)
Online event → flushQueue() → Supabase
```

Soportar: `addFood`, `setWater`, `logWeight`, `logActivity`
Con reintentos (max 5) y cleanup automático.

---

## 3. Escáner de Cámara con IA

### Pipeline

```
Tap "Escanear" → Capturar frame del video → base64 JPEG
→ POST a Edge Function → Respuesta Gemini (JSON)
→ normalizeItem() → mergeItems() → UI de revisión
```

### Prompt Engineering para Gemini Vision

El prompt debe:
1. Pedir JSON estricto con estructura definida
2. Incluir `name`, `emoji`, `calories`, `protein_g`, `carbs_g`, `fat_g`
3. Pedir `box` (bounding box normalizado 0-1000) para posición
4. Instrucciones de estimación de porciones realistas

### Normalización de Respuestas

```javascript
function normalizeItem(rawItem) {
    return {
        food_name: rawItem.name ?? 'Desconocido',
        emoji: rawItem.emoji ?? '🍽️',
        quantity: null,  // Usuario define total
        unit: 'gramos',
        calories: clampNutrient(rawItem.calories, 5000),
        protein_g: clampNutrient(rawItem.protein_g, 500),
        carbs_g: clampNutrient(rawItem.carbs_g, 500),
        fat_g: clampNutrient(rawItem.fat_g, 500),
    }
}
```

### Merge de Duplicados

```javascript
function mergeItems(items) {
    const map = new Map()
    for (const item of items) {
        const key = item.food_name
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .trim()
        if (map.has(key)) {
            const existing = map.get(key)
            existing.calories += item.calories
            existing.protein_g += item.protein_g
            existing.carbs_g += item.carbs_g
            existing.fat_g += item.fat_g
        } else {
            map.set(key, { ...item })
        }
    }
    return Array.from(map.values())
}
```

### Camera Features

- **Tap-to-focus:** `track.applyConstraints({ advanced: [{ pointOfInterest }] })`
- **Flash/Torch:** `track.applyConstraints({ advanced: [{ torch: true }] })`
- **Resolución HD:** `getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } })`
- **Captura optimizada:** Escalar a max 1280px para reducir payload de IA

### UX del Scanner

**3 fases:**
1. `camera` — Viewfinder con esquinas de escaneo + hint
2. `analyzing` — Foto circular con arco de progreso (conic-gradient) + cancelar
3. `review` — Lista de ingredientes + macros + confirmar

**Progress simulado:**
```javascript
let prog = 0
const timer = setInterval(() => {
    prog += Math.random() * 8 + 2   // 2-10% por tick
    if (prog > 90) prog = 90        // Max 90% hasta recibir respuesta
    setProgress(Math.round(prog))
}, 400)

// Al recibir respuesta:
clearInterval(timer)
setProgress(100)
```

**Cancelación:**
```javascript
const cancelledRef = useRef(false)

const cancelScan = () => {
    cancelledRef.current = true
    clearInterval(progressRef.current)
    restart()
}

// Después del await:
const result = await analyzeBase64Frame(base64)
if (cancelledRef.current) return  // Ignorar resultado
```

---

## 4. Diseño UI (Mobile-First Dark Theme)

### Paleta de Colores
| Token        | Hex      | Uso                          |
|--------------|----------|------------------------------|
| `--bg`       | #0D0D11  | Fondo principal              |
| `--surface`  | #1C1C26  | Cards, modales               |
| `--accent`   | #FF375F  | Calorías, CTAs               |
| `--orange`   | #FF6B1A  | IA, scanner                  |
| `--green`    | #30D158  | Proteína, éxito, progreso    |
| `--blue`     | #0A84FF  | Grasas, agua                 |
| `--yellow`   | #FF9F0A  | Carbohidratos                |
| `--muted`    | #7B7D94  | Texto secundario             |

### Barra de Macros Proporcional

```jsx
<div style={{ display: 'flex', height: 8, borderRadius: 4, gap: 2 }}>
    <div style={{ width: carbsPct + '%', background: '#FF9F0A' }} />
    <div style={{ width: fatPct + '%', background: '#0A84FF' }} />
    <div style={{ width: proteinPct + '%', background: '#30D158' }} />
</div>
```

### Foto Circular con Progreso

```jsx
<div style={{ position: 'relative', width: 220, height: 220 }}>
    {/* Arco de progreso */}
    <div style={{
        position: 'absolute', inset: 0,
        borderRadius: '50%',
        background: `conic-gradient(#30D158 0deg, #FF6B1A ${progress * 3.6}deg, transparent ${progress * 3.6}deg)`,
    }} />
    {/* Máscara interior */}
    <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', background: '#0D0D11' }} />
    {/* Foto */}
    <img src={snapshot} style={{ position: 'absolute', inset: 12, borderRadius: '50%', objectFit: 'cover' }} />
</div>
```

---

## 5. Base de Datos (Supabase)

### Tablas Mínimas

```sql
-- Perfil de usuario (creado por trigger on auth.users insert)
CREATE TABLE user_config (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  full_name     TEXT,
  calorie_goal  NUMERIC DEFAULT 2000,
  protein_goal  NUMERIC DEFAULT 120,
  water_goal    INT DEFAULT 8,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Registro de alimentos
CREATE TABLE food_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  log_date    DATE NOT NULL,
  meal_type   TEXT,
  food_name   TEXT NOT NULL,
  emoji       TEXT DEFAULT '🍽️',
  quantity    NUMERIC,
  unit        TEXT DEFAULT 'gramos',
  calories    NUMERIC NOT NULL,
  protein_g   NUMERIC DEFAULT 0,
  carbs_g     NUMERIC DEFAULT 0,
  fat_g       NUMERIC DEFAULT 0,
  photo_url   TEXT,
  source      TEXT DEFAULT 'manual',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Agua
CREATE TABLE water_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  log_date    DATE NOT NULL,
  glasses     INT DEFAULT 0,
  UNIQUE(user_id, log_date)
);

-- Peso
CREATE TABLE weight_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  log_date    DATE NOT NULL,
  weight_kg   NUMERIC NOT NULL,
  notes       TEXT,
  UNIQUE(user_id, log_date)
);

-- RLS en todas las tablas
ALTER TABLE user_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_log ENABLE ROW LEVEL SECURITY;

-- Políticas: cada usuario solo accede a sus datos
CREATE POLICY "own_data" ON user_config FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON food_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON water_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON weight_log FOR ALL USING (auth.uid() = user_id);
```

### Storage

```sql
-- Bucket para fotos de comida
INSERT INTO storage.buckets (id, name, public) VALUES ('food-photos', 'food-photos', false);

-- RLS: solo el dueño puede subir/leer
CREATE POLICY "user_folder" ON storage.objects
  FOR ALL USING (bucket_id = 'food-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 6. Edge Function: Proxy de Gemini

```typescript
// supabase/functions/gemini-proxy/index.ts
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-lite']

Deno.serve(async (req) => {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    const { parts, maxTokens = 1024 } = await req.json()
    
    // safeMaxTokens: Gemini 2.5-flash usa tokens para "pensar"
    const safeMax = Math.max(maxTokens, 8192)
    
    for (const model of MODELS) {
        const res = await fetch(geminiUrl(model, apiKey), {
            method: 'POST',
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { temperature: 0.1, maxOutputTokens: safeMax },
            }),
        })
        
        if (res.status === 429) continue  // Siguiente modelo
        if (!res.ok) return errorResponse(res)
        
        const data = await res.json()
        return jsonResponse({ ...data, _model: model })
    }
})
```

**Deploy:**
```bash
supabase functions deploy gemini-proxy
supabase secrets set GEMINI_API_KEY=AIza...
```

---

## 7. Lecciones Aprendidas

1. **`todayStr()` debe ser local** — `toISOString()` devuelve UTC, causando bugs
   en zonas horarias negativas después de las 6PM.

2. **Gemini 2.5-flash necesita 8192+ maxOutputTokens** — Si pones 1024, el modelo
   gasta ~980 "pensando" y la respuesta JSON se trunca.

3. **Session persistence:** Usar `sessionStorage` (no `localStorage`) para que la
   sesión se limpie al cerrar pestaña pero sobreviva refresh.

4. **Race condition auth:** `SIGNED_IN` llega antes que `INITIAL_SESSION` a veces.
   Manejar ambos eventos cuidadosamente.

5. **Rate limits de Gemini:** Implementar fallback de modelos + retry con backoff.
   El error 429 incluye `retry in Xs` en el mensaje.

6. **Duplicados de IA:** Gemini a veces reporta el mismo ingrediente múltiples veces.
   Siempre normalizar + merge post-respuesta.

7. **Fotos de cámara:** Escalar a max 1280px reduce el payload sin perder calidad
   necesaria para detección de alimentos.

---

## 8. Checklist para Nueva App Similar

- [ ] Crear proyecto Vite + React
- [ ] Configurar Supabase (Auth, DB, Storage, Edge Functions)
- [ ] Crear tablas con RLS
- [ ] Implementar servicio de auth (login, registro, sesión)
- [ ] Crear Edge Function proxy para IA
- [ ] Implementar servicio de IA (normalización, merge, prompts)
- [ ] Crear cola offline con auto-sync
- [ ] Implementar scanner de cámara (3 fases)
- [ ] Diseñar UI mobile-first (dark theme)
- [ ] Configurar PWA (manifest, SW, meta tags)
- [ ] Testing en dispositivos reales
- [ ] Deploy + verificar en producción
