/**
 * gemini.js — Servicio Gemini Vision + texto
 * 1. analyzeFoodPhoto    → detecta alimentos desde un File de imagen
 * 2. analyzeFoodByText   → calcula macros desde nombre + cantidad
 * 3. analyzeFoodWithPos  → detecta alimentos + posición (bounding box) para overlay
 * 4. analyzeBase64Frame  → mismo que 3 pero acepta base64 directo (frame de video)
 */

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY
// Modelo primario: gemini-2.5-flash (funciona con Nivel 1 pagado)
// Fallback: gemini-2.0-flash-lite (gemini-2.0-flash ya no disponible para nuevos)
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-lite']
const makeUrl = (model) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`

// ── Prompt con bounding boxes ──────────────────────────────────────────────
// Gemini 1.5 Flash soporta coordenadas normalizadas [y1,x1,y2,x2] en escala 0-1000
const SCAN_PROMPT = `Analiza esta imagen de comida. Para cada alimento visible devuelve ÚNICAMENTE un JSON válido (sin markdown):
{
  "items": [
    {
      "name": "nombre del alimento en español",
      "emoji": "emoji representativo",
      "quantity": número,
      "unit": "gramos|piezas|taza|ml|porción",
      "calories": número,
      "protein_g": número,
      "carbs_g": número,
      "fat_g": número,
      "box": [y1, x1, y2, x2]
    }
  ],
  "confidence": "alta|media|baja"
}

IMPORTANTE sobre "box":
- Son coordenadas normalizadas en escala 0-1000
- [y1, x1] = esquina superior izquierda del alimento
- [y2, x2] = esquina inferior derecha del alimento
- Calcula el centro aproximado de cada alimento visible
- Si no puedes determinar posición exacta, coloca el centro estimado

Reglas:
- Identifica TODOS los ingredientes visibles por separado
- Estima porciones realistas
- Si no hay comida devuelve items:[]`

/** Convierte File a base64 */
async function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => {
            const [header, b64] = e.target.result.split(',')
            resolve({ base64: b64, mimeType: header.match(/:(.*?);/)[1] })
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

/**
 * Llama a Gemini con fallback de modelos + retry para rate limits (429).
 * Flujo: intenta modelo principal → si 429, intenta modelo alternativo
 *        → si ambos 429, espera y reintenta (max 1 vez).
 */
async function callGemini(parts, maxTokens = 1024, _retry = false) {
    const body = JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens },
    })

    // Intentar cada modelo en orden
    for (let i = 0; i < MODELS.length; i++) {
        const model = MODELS[i]
        const res = await fetch(makeUrl(model), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        })

        // Si 429 y hay otro modelo, probar el siguiente sin esperar
        if (res.status === 429 && i < MODELS.length - 1) {
            console.warn(`⏳ ${model} rate limited — probando ${MODELS[i + 1]}...`)
            continue
        }

        // Si 429 en el último modelo y no hemos reintentado, esperar y reintentar
        if (res.status === 429 && !_retry) {
            const errBody = await res.json().catch(() => ({}))
            const retryMatch = errBody.error?.message?.match(/retry in ([\d.]+)s/i)
            const waitSec = Math.min(retryMatch ? parseFloat(retryMatch[1]) : 15, 30)
            console.warn(`⏳ Todos los modelos limitados — esperando ${Math.ceil(waitSec)}s...`)
            await new Promise(r => setTimeout(r, (waitSec + 1) * 1000))
            return callGemini(parts, maxTokens, true)
        }

        if (!res.ok) {
            const e = await res.json().catch(() => ({}))
            throw new Error(e.error?.message || `Gemini HTTP ${res.status}`)
        }

        const data = await res.json()
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        console.log('[Gemini raw]', raw.slice(0, 300))

        // Limpiar markdown code fences
        let clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

        // Intento 1: parsear directamente
        try {
            return JSON.parse(clean)
        } catch { /* intentar extracción */ }

        // Intento 2: extraer el primer bloque JSON {...} del texto
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0])
                console.log('[Gemini parsed]', parsed)
                return parsed
            } catch { /* falló también */ }
        }

        // Intento 3: extraer array JSON [{...}]
        const arrMatch = raw.match(/\[[\s\S]*\]/)
        if (arrMatch) {
            try {
                return { items: JSON.parse(arrMatch[0]) }
            } catch { /* falló */ }
        }

        console.error('Gemini devolvió JSON inválido:', clean.slice(0, 300))
        return { items: [] } // Fallback seguro en vez de crash
    }

    throw new Error('Todos los modelos de IA están temporalmente no disponibles')
}

/** Límites razonables para validación de datos de Gemini */
const MAX_CALORIES = 5000   // Ningún alimento individual supera esto
const MAX_MACRO_G = 500     // Gramos máximos de un macro por item

/** Clamp: asegura que un valor esté en rango razonable */
function clampNutrient(val, max) {
    const n = Number(val ?? 0)
    if (isNaN(n) || n < 0) return 0
    return Math.min(n, max)
}

/** Normaliza un item de Gemini con validación de rangos */
function normalizeItem(i, source = 'photo') {
    return {
        food_name: i.name ?? 'Desconocido',
        emoji: i.emoji ?? '🍽️',
        quantity: Math.max(0, Number(i.quantity ?? 1)),
        unit: i.unit ?? 'porción',
        calories: clampNutrient(i.calories, MAX_CALORIES),
        protein_g: clampNutrient(i.protein_g, MAX_MACRO_G),
        carbs_g: clampNutrient(i.carbs_g, MAX_MACRO_G),
        fat_g: clampNutrient(i.fat_g, MAX_MACRO_G),
        // box = [y1,x1,y2,x2] en 0-1000 → convertimos a % (cx,cy = centro)
        cx: i.box ? ((i.box[1] + i.box[3]) / 2) / 10 : 50,   // % horizontal
        cy: i.box ? ((i.box[0] + i.box[2]) / 2) / 10 : 50,   // % vertical
        source,
    }
}

/**
 * Analiza una foto (File) con posición de cada alimento.
 * Usado en el modo foto del modal y en el scanner de cámara.
 * @param {File} imageFile
 */
export async function analyzeFoodPhoto(imageFile) {
    const { base64, mimeType } = await toBase64(imageFile)
    const parsed = await callGemini([
        { text: SCAN_PROMPT },
        { inlineData: { mimeType, data: base64 } },
    ])
    return {
        items: (parsed.items ?? []).map(i => normalizeItem(i, 'photo')),
        confidence: parsed.confidence ?? 'media',
    }
}

/**
 * Analiza un frame de video (base64, jpeg) con posición.
 * Usado para el escaneo de cámara en vivo.
 * @param {string} base64jpeg — datos base64 sin prefijo "data:..."
 */
export async function analyzeBase64Frame(base64jpeg) {
    const parsed = await callGemini([
        { text: SCAN_PROMPT },
        { inlineData: { mimeType: 'image/jpeg', data: base64jpeg } },
    ])
    return {
        items: (parsed.items ?? []).map(i => normalizeItem(i, 'scan')),
        confidence: parsed.confidence ?? 'media',
    }
}

/**
 * Calcula macros automáticamente a partir del nombre y cantidad.
 * @param {string} foodName
 * @param {number} quantity
 * @param {string} unit
 */
export async function analyzeFoodByText(foodName, quantity, unit) {
    const prompt = `Eres nutriólogo experto. Calcula los macros exactos para:
Alimento: "${foodName}"
Cantidad: ${quantity} ${unit}

Devuelve ÚNICAMENTE JSON válido (sin markdown):
{
  "calories": número,
  "protein_g": número,
  "carbs_g": número,
  "fat_g": número,
  "emoji": "emoji del alimento"
}
Usa datos USDA. Redondea a 1 decimal.`

    // maxOutputTokens: 1024 (Gemini 2.5-flash usa pensamiento interno
    // que consume tokens — con 256 el JSON se truncaba)
    const parsed = await callGemini([{ text: prompt }], 1024)

    // Validar que Gemini devolvió datos nutricionales reales
    if (parsed.calories == null && parsed.items !== undefined) {
        // callGemini cayó al fallback { items: [] } — no es un resultado de texto válido
        throw new Error('Gemini no devolvió datos nutricionales válidos')
    }

    const result = {
        calories: clampNutrient(parsed.calories, MAX_CALORIES),
        protein_g: clampNutrient(parsed.protein_g, MAX_MACRO_G),
        carbs_g: clampNutrient(parsed.carbs_g, MAX_MACRO_G),
        fat_g: clampNutrient(parsed.fat_g, MAX_MACRO_G),
        emoji: parsed.emoji ?? '🍽️',
    }

    // Si TODO es 0, algo salió mal — no hay alimento con 0 calorías en todo
    if (result.calories === 0 && result.protein_g === 0 && result.carbs_g === 0 && result.fat_g === 0) {
        console.error('Gemini devolvió todo en 0:', parsed)
        throw new Error('No se pudieron calcular los macros — intenta describir mejor el alimento')
    }

    return result
}

// ══════════════════════════════════════════════════════════════════════════
// RECOMENDACIONES DE ONBOARDING — Generadas al registrarse
// ══════════════════════════════════════════════════════════════════════════

/**
 * Genera recomendaciones personalizadas de salud/nutrición basadas en
 * el perfil físico del usuario (IMC, edad, sexo, actividad, metas).
 * Se llama una sola vez durante el registro.
 *
 * @param {object} profile
 * @param {string} profile.firstName
 * @param {number} profile.weight   - kg
 * @param {number} profile.height   - cm
 * @param {number} profile.bmi
 * @param {string} profile.bmiCategory
 * @param {number} profile.age
 * @param {string} profile.sex      - 'M' | 'F' | 'otro'
 * @param {string} profile.activity  - nivel de actividad
 * @param {number} profile.calorieGoal
 * @param {number} profile.waterGoal
 * @returns {Promise<string[]>}     - array de 4-5 consejos personalizados
 */
export async function generateOnboardingRecommendations(profile) {
    const {
        firstName, weight, height, bmi, bmiCategory,
        age, sex, activity, calorieGoal, waterGoal
    } = profile

    const sexLabel = sex === 'M' ? 'hombre' : sex === 'F' ? 'mujer' : 'persona'

    const prompt = `Eres un nutriólogo y entrenador personal experto. Un nuevo usuario se acaba de registrar con este perfil:

- Nombre: ${firstName}
- Sexo: ${sexLabel}
- Edad: ${age} años
- Peso: ${weight} kg
- Talla: ${height} cm
- IMC: ${bmi} (${bmiCategory})
- Nivel de actividad: ${activity}
- Meta calórica diaria: ${calorieGoal} kcal
- Meta de agua: ${waterGoal} vasos/día

Genera exactamente 5 recomendaciones personalizadas, concretas y motivadoras para ESTA persona.
Cada recomendación debe:
- Ser específica para su perfil (no genérica)
- Tener máximo 2 líneas
- Empezar con un emoji relevante
- Ser positiva y motivadora
- Considerar su IMC y sus metas

Devuelve ÚNICAMENTE un JSON válido (sin markdown):
{
  "recommendations": [
    "emoji consejo 1",
    "emoji consejo 2",
    "emoji consejo 3",
    "emoji consejo 4",
    "emoji consejo 5"
  ]
}`

    try {
        const parsed = await callGemini([{ text: prompt }], 512)
        return Array.isArray(parsed.recommendations)
            ? parsed.recommendations
            : ['💪 ¡Bienvenido! Has dado el primer paso hacia una vida más saludable.',
                '🎯 Empieza registrando tus comidas diariamente para ver tu progreso.',
                `💧 Recuerda tomar ${waterGoal} vasos de agua al día.`,
                `🔥 Tu meta de ${calorieGoal} kcal diarias está calculada para ti.`,
                '📊 Registra tu peso semanalmente para ver tu evolución.']
    } catch {
        // Fallback si Gemini falla
        return ['💪 ¡Bienvenido! Has dado el primer paso hacia una vida más saludable.',
            '🎯 Empieza registrando tus comidas diariamente para ver tu progreso.',
            `💧 Recuerda tomar ${waterGoal} vasos de agua al día.`,
            `🔥 Tu meta de ${calorieGoal} kcal está personalizada para tu perfil.`,
            '📊 Consulta tu historial cada semana para ajustar tus hábitos.']
    }
}

