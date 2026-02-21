# K-Cal — Arquitectura Técnica

> **Última actualización:** 2026-02-21  
> **Versión:** 1.0.0  
> **Stack:** React 19 + Vite 7 + Supabase + Gemini AI + TailwindCSS 4

---

## TL;DR

K-Cal es una PWA mobile-first de tracking de calorías que usa IA (Google Gemini) para
detectar alimentos desde fotos de la cámara. Corre sobre React 19 con Vite 7, backend
en Supabase (Auth + PostgreSQL + Storage + Edge Functions), y un proxy seguro para 
la API de Gemini. Inclue trackers de agua, peso corporal y ayuno intermitente.

---

## 1. Stack Tecnológico

| Capa          | Tecnología                | Versión | Motivo                                              |
|---------------|---------------------------|---------|-----------------------------------------------------|
| **Frontend**  | React                     | 19.2    | Hooks modernos, lazy loading, Suspense              |
| **Build**     | Vite                      | 7.3     | HMR ultrarrápido, tree-shaking, code-splitting auto |
| **CSS**       | TailwindCSS + Inline      | 4.2     | Utility-first + estilos inline para scanner         |
| **Backend**   | Supabase                  | 2.97    | Auth, PostgreSQL, Storage, Edge Functions, RLS       |
| **IA**        | Google Gemini             | 2.5-flash / 2.0-flash-lite | Vision API para fotos, texto para macros |
| **PWA**       | Service Worker manual     | —       | Cache offline, instalable en homescreen             |
| **Tipografía**| Inter (Google Fonts)      | —       | Legibilidad premium en móvil                        |

---

## 2. Estructura del Proyecto

```
kcal-app/
├── index.html                # SPA entry point (PWA meta tags)
├── vite.config.js            # Config: React plugin, Tailwind, host:true (LAN)
├── package.json              # Dependencies
├── public/
│   ├── favicon.png           # Icono de la app
│   ├── manifest.json         # PWA manifest (standalone, portrait)
│   └── sw.js                 # Service Worker (cache offline)
├── src/
│   ├── main.jsx              # Entry: monta <App /> + registra SW
│   ├── App.jsx               # Router principal + Auth + Layout
│   ├── index.css             # Design system global
│   ├── App.css               # Estilos de animaciones
│   ├── components/
│   │   ├── Auth.jsx           # Login (email/password)
│   │   ├── Register.jsx       # Onboarding wizard (5 pasos)
│   │   ├── RegisterHelpers.js # Helpers del registro
│   │   ├── RegisterUI.jsx     # UI reutilizable del registro
│   │   ├── Dashboard.jsx      # Pantalla principal (anillos, macros, comidas)
│   │   ├── CameraScanner.jsx  # Escáner de cámara fullscreen con IA
│   │   ├── ScanReview.jsx     # Revisión post-escaneo (foto, macros, ingredientes)
│   │   ├── AddFoodModal.jsx   # Modal para agregar comida (foto/texto/scanner)
│   │   ├── ConfirmStep.jsx    # Diálogo de confirmación pre-guardado
│   │   ├── History.jsx        # Historial + timeline de actividad
│   │   ├── WaterTracker.jsx   # Tracker de agua (vasos)
│   │   ├── FastingTracker.jsx # Tracker de ayuno intermitente
│   │   ├── Weight.jsx         # Gráfica de peso corporal
│   │   ├── Settings.jsx       # Configuración del usuario
│   │   ├── TokenDashboard.jsx # Panel admin: consumo de tokens IA
│   │   ├── Icons.jsx          # Biblioteca de iconos SVG
│   │   └── UI.jsx             # Componentes UI reutilizables
│   ├── services/
│   │   ├── supabase.js        # Cliente Supabase + CRUD completo
│   │   ├── gemini.js          # Servicio Gemini (foto, texto, onboarding)
│   │   ├── offlineQueue.js    # Cola offline con auto-sync
│   │   ├── tokenLogger.js     # Logger de consumo de tokens IA
│   │   └── water.js           # Recordatorios de agua (Web Notifications)
│   ├── hooks/
│   │   └── (custom hooks)
│   └── assets/
│       └── (imágenes estáticas)
└── supabase/
    └── functions/
        └── gemini-proxy/
            ├── index.ts       # Edge Function: proxy seguro a Gemini API
            ├── deno.json      # Config Deno
            └── .npmrc         # Config npm
```

---

## 3. Flujo de Datos General

```
┌──────────────┐     POST { parts }      ┌─────────────────────┐
│              │ ──────────────────────►  │  Supabase Edge Fn   │
│   React App  │                          │  "gemini-proxy"     │
│   (PWA)      │ ◄──────────────────────  │                     │
│              │    { items, macros }      │   GEMINI_API_KEY    │
└──────┬───────┘                          │   (secret, server)  │
       │                                  └─────────┬───────────┘
       │ CRUD via SDK                               │
       │ (JWT auto-inject)                          │ fetch()
       ▼                                            ▼
┌──────────────┐                          ┌─────────────────────┐
│   Supabase   │                          │  Google Gemini API  │
│  PostgreSQL  │                          │  (Vision + Text)    │
│  (RLS)       │                          └─────────────────────┘
│  + Storage   │
│  + Auth      │
└──────────────┘
```

---

## 4. Servicios (src/services/)

### 4.1 `supabase.js` — Cliente y CRUD

**Responsabilidad:** Única interfaz con Supabase. Exporta funciones puras para cada operación.

| Función               | Descripción                                        |
|-----------------------|----------------------------------------------------|
| `signUp()`            | Registro con user_metadata                         |
| `signIn()`            | Login email/password                               |
| `signOut()`           | Cierra sesión                                      |
| `getSession()`        | Obtiene sesión activa                              |
| `onAuthChange()`      | Listener de eventos auth                           |
| `getConfig()`         | Lee perfil del usuario                             |
| `updateConfig()`      | Actualiza perfil                                   |
| `getFoodByDate()`     | Comidas de un día (RLS)                            |
| `addFood()`           | Inserta alimento con log_date local                |
| `deleteFood()`        | Elimina alimento por ID                            |
| `uploadFoodPhoto()`   | Sube foto a Storage → signed URL                   |
| `refreshSignedUrl()`  | Renueva URLs firmadas vencidas                     |
| `getWaterByDate()`    | Vasos de agua del día                              |
| `setWaterGlasses()`   | Upsert vasos (evita duplicados)                    |
| `getWeightHistory()`  | Últimos N registros de peso                        |
| `logWeight()`         | Upsert peso del día                                |
| `getCalorieHistory()` | Resumen diario: comida + agua + peso (paralelo)    |
| `logActivity()`       | Registra evento en timeline                        |
| `getActivityLog()`    | Timeline de actividades                            |
| `todayStr()`          | Fecha LOCAL en YYYY-MM-DD (evita bugs UTC)         |

**Decisión de diseño:** `todayStr()` usa `new Date()` local en vez de `toISOString()` 
para evitar el bug de zona horaria donde después de las 6PM en México (UTC-6) la fecha 
pasaba al día siguiente.

### 4.2 `gemini.js` — Servicio de IA

**Responsabilidad:** Abstrae toda interacción con Gemini via el proxy seguro.

| Función                              | Uso                                          |
|--------------------------------------|----------------------------------------------|
| `analyzeFoodPhoto(file)`             | Analiza foto (File) → items con macros       |
| `analyzeBase64Frame(base64)`         | Analiza frame de cámara → items con macros   |
| `analyzeFoodByText(name, qty, unit)` | Calcula macros por nombre/cantidad           |
| `generateOnboardingRecommendations()`| Consejos personalizados en registro          |

**Patterns clave:**

1. **`normalizeItem()`** — Sanitiza la respuesta de Gemini con `clampNutrient()` 
   (max 5000 kcal, max 500g por macro). La cantidad queda `null` para que el usuario 
   ingrese el total.

2. **`mergeItems()`** — Unifica ingredientes duplicados por nombre normalizado 
   (lowercase, sin tildes con `normalize('NFD')`). Suma macros de items idénticos.

3. **`callGemini()`** — Invoca la Edge Function `gemini-proxy`. Parsea JSON de la 
   respuesta, extrae `usageMetadata` para token logging. Incluye `_model` para saber 
   qué modelo finalmente respondió.

4. **Prompt Engineering** — El prompt incluye instrucciones de formato JSON estricto, 
   coordenadas de bounding box (0-1000), y reglas de estimación de porciones.

### 4.3 `offlineQueue.js` — Cola Offline

**Patrón:** Store & Forward — la UI siempre responde, la red es eventual.

```
Sin internet → enqueue(action, payload) → localStorage
    ↓
Reconexión detectada (online event) → flushQueue() → Supabase
```

- Soporta: `addFood`, `setWater`, `logWeight`, `logActivity`
- Reintentos: máximo 5 por operación
- Auto-sync: listener `online` + flush al cargar la app
- `withOfflineFallback()`: wrapper que intenta ejecutar y encola si falla

### 4.4 `tokenLogger.js` — Monitoreo de Tokens IA

Registra cada llamada a Gemini con:
- Tipo de función (`photo`, `scan`, `text`, `onboarding`)
- Modelo utilizado
- Tokens entrada/salida
- Costo estimado en USD (pricing Feb 2026)

**Fire-and-forget:** El INSERT no bloquea la UI.

### 4.5 `water.js` — Recordatorios de Agua

Web Notifications API con intervalo configurable. Solo notifica entre 8AM-10PM 
y si no se ha alcanzado la meta. 3 mensajes aleatorios para variedad.

---

## 5. Componentes Principales

### 5.1 `App.jsx` — Router y Layout

- **Layout dual:** Desktop (sidebar + header) y Mobile (bottom nav)
- **Lazy loading:** `CameraScanner`, `History`, `Weight`, `Settings`, `FastingTracker`, `TokenDashboard`
- **Auth flow:** `INITIAL_SESSION` → `SIGNED_IN` → `loadConfig()`
- **Admin check:** Email hardcodeado para acceso al panel de tokens
- **Toast system:** Notificaciones con auto-dismiss

### 5.2 `CameraScanner.jsx` — Escáner IA

**Fases:**
1. `camera` → Viewfinder fullscreen con tap-to-focus y flash
2. `analyzing` → Foto circular con arco de progreso + botón cancelar
3. `review` → Delegado a `ScanReview`

**Features:**
- Tap-to-focus con reticle animado
- Flash/Torch toggle (si el dispositivo lo soporta)
- Resolución HD (1920x1080 ideal)
- Captura escalada (max 1280px) para optimizar análisis
- Barra de progreso simulada (0-90% gradual, 100% al recibir respuesta)
- Cancelación con `AbortController` pattern (cancelledRef)
- Foto circular con arco de progreso cónico (conic-gradient)

### 5.3 `ScanReview.jsx` — Revisión Post-Escaneo

**Diseño inspirado en Foodvisor:**
- Snapshot circular con borde gradient (verde→naranja)
- Badge "✅ N detectados"
- Calorías grandes (48px)
- Barra de macros proporcional (Carbos/Grasas/Proteína)
- Campo de cantidad total en gramos
- Lista de ingredientes: emoji + nombre + kcal + checkbox
- Botones "↺ Repetir" + "Confirmar →"

### 5.4 `Dashboard.jsx` — Pantalla Principal

- Activity Rings (estilo Apple Fitness) — calorías, proteína, agua
- Macro Cards — calorías, proteína, carbos, grasa
- Water Tracker — vasos interactivos
- Food List — comidas del día con delete
- FAB para escanear o agregar comida

### 5.5 `Register.jsx` — Onboarding Wizard

5 pasos scroll-snap:
1. Nombre completo
2. Datos físicos (edad, sexo, altura, peso)
3. Nivel de actividad
4. Objetivo (perder peso, mantener, ganar)
5. Metas numéricas (calorías, proteína, agua)

Genera recomendaciones IA al finalizar con `generateOnboardingRecommendations()`.

---

## 6. Base de Datos (Supabase PostgreSQL)

### Tablas

| Tabla            | Descripción                                    | RLS |
|------------------|------------------------------------------------|-----|
| `user_config`    | Perfil: nombre, metas, datos físicos           | ✅  |
| `food_log`       | Registro de alimentos (macros, foto, source)   | ✅  |
| `water_log`      | Vasos de agua por día                          | ✅  |
| `weight_log`     | Peso corporal por día                          | ✅  |
| `activity_log`   | Timeline de eventos (agua, comida, peso, ayuno)| ✅  |
| `ai_token_log`   | Consumo de tokens por llamada a Gemini         | ✅  |

### Esquema `food_log`

```sql
CREATE TABLE food_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  log_date    DATE NOT NULL,
  meal_type   TEXT CHECK (meal_type IN ('desayuno','comida','cena','snack')),
  food_name   TEXT NOT NULL,
  emoji       TEXT DEFAULT '🍽️',
  quantity    NUMERIC,
  unit        TEXT DEFAULT 'gramos',
  calories    NUMERIC NOT NULL,
  protein_g   NUMERIC DEFAULT 0,
  carbs_g     NUMERIC DEFAULT 0,
  fat_g       NUMERIC DEFAULT 0,
  photo_url   TEXT,
  source      TEXT DEFAULT 'manual', -- 'manual' | 'photo' | 'scan' | 'text'
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS: cada usuario solo ve sus datos
ALTER TABLE food_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own food" ON food_log
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Storage Bucket

- **Nombre:** `food-photos`
- **Ruta:** `{user_id}/{fecha}-{timestamp}.jpg`
- **URLs:** Signed URLs con expiración (renovables con `refreshSignedUrl()`)

---

## 7. Edge Function: gemini-proxy

**Ubicación:** `supabase/functions/gemini-proxy/index.ts`

**Flujo:**
```
Frontend                    Edge Function                 Gemini API
   │                            │                            │
   │── POST {parts, maxTokens} ─►│                            │
   │                            │── gemini-2.5-flash ────────►│
   │                            │◄───── 429 rate limit ──────│
   │                            │── gemini-2.0-flash-lite ───►│
   │                            │◄───── 200 OK ──────────────│
   │◄── {items, _model} ────────│                            │
```

**Seguridad:**
- `GEMINI_API_KEY` almacenada como secret de Deno
- Solo accesible via `supabase.functions.invoke()` con JWT válido
- CORS headers para peticiones del frontend

**Resiliencia:**
- Modelo fallback: gemini-2.5-flash → gemini-2.0-flash-lite
- Retry con espera en 429 (extrae `retry in Xs` del error)
- `safeMaxTokens = Math.max(maxTokens, 8192)` — Gemini 2.5-flash usa tokens para "pensar"

---

## 8. PWA Features

| Feature            | Implementación                                     |
|--------------------|----------------------------------------------------|
| Instalable         | `manifest.json` (standalone, portrait)              |
| Icono homescreen   | `favicon.png` (any + maskable)                      |
| Offline capability | Service Worker con cache de assets                  |
| Theme color        | `#FF375F` (rosa K-Cal)                              |
| iOS Support        | `apple-mobile-web-app-capable` meta tags            |
| Viewport           | `viewport-fit=cover` para safe areas                |

---

## 9. Seguridad

| Aspecto              | Implementación                                       |
|----------------------|------------------------------------------------------|
| API Key de Gemini    | Server-side en Edge Function (nunca en frontend)     |
| Autenticación        | Supabase Auth (email/password + JWT)                 |
| Autorización         | RLS en todas las tablas (user_id = auth.uid())       |
| Session Management   | `persistSession: true` + `sessionStorage`            |
| Storage Access       | Signed URLs con expiración                           |
| Input Validation     | `clampNutrient()` sanitiza macros de Gemini          |
| CORS                 | Configurado en Edge Function                         |

---

## 10. Patrones de Diseño

### 10.1 Store & Forward (Offline)
Las operaciones se ejecutan inmediatamente si hay red, o se encolan en localStorage
para sync automático cuando se detecta la reconexión.

### 10.2 Optimistic UI
Los vasos de agua y comidas se reflejan instantáneamente en la UI antes de confirmar
el INSERT en Supabase.

### 10.3 Lazy Loading + Code Splitting
Componentes pesados (`CameraScanner`, `History`, `Weight`) se cargan bajo demanda
con `React.lazy()` + `Suspense`, reduciendo el bundle inicial.

### 10.4 Fire-and-Forget Logging
El logging de tokens IA no bloquea la UI — el INSERT se ejecuta en background.

### 10.5 Proxy Pattern (Edge Function)
La llamada a Gemini se abstrae detrás de un proxy server-side que maneja:
- Ocultamiento de API Key
- Fallback entre modelos
- Retry con backoff en rate limits
- Sanitización de respuestas

### 10.6 Merge & Normalize (Scanner IA)
Las respuestas crudas de Gemini se procesan en pipeline:
1. Parse JSON → 2. Normalize (clamp) → 3. Merge duplicados → 4. UI

---

## 11. Configuración de Desarrollo

### Variables de Entorno (`.env.local`)

```env
VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Server-side (Supabase Secrets)

```bash
supabase secrets set GEMINI_API_KEY=AIza...
```

### Desarrollo Local

```bash
npm install          # Instalar dependencias
npm run dev          # Vite dev server (http://localhost:5173)
                     # host:true → accesible por IP en red local
```

### Build y Deploy

```bash
npx vite build       # Genera dist/ (GitHub Pages o hosting estático)
git push origin master  # Auto-deploy si está configurado
```

---

## 12. Decisiones de Diseño Notable

1. **No SSR** — App 100% client-side. No necesitamos SEO ni SSG porque es una app
   autenticada detrás de login.

2. **Inline styles en Scanner** — Para garantizar fullscreen real en móvil sin 
   conflictos de CSS/Tailwind. El z-index 9999 asegura cobertura total.

3. **sessionStorage para auth** — Balance entre persistencia (sobrevive refresh) 
   y seguridad (se limpia al cerrar pestaña).

4. **Cantidad total, no por ingrediente** — El usuario ingresa los gramos totales 
   del plato. Los macros de Gemini son proporcionales al 100% de lo detectado.

5. **Merge de duplicados** — Gemini a veces detecta "atún" 3 veces en la misma foto.
   `mergeItems()` los fusiona sumando macros.

6. **Progress simulado** — La barra sube gradualmente (2-10% cada 400ms) hasta 90%.
   Al recibir respuesta salta a 100%. Esto da sensación de progreso sin mentir.

7. **Diseño oscuro (#0D0D11)** — Tema oscuro premium pensado para uso en 
   restaurantes/dimlit environments.
