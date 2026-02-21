/**
 * gemini.js — Servicio Gemini Vision + texto
 *
 * SEGURIDAD: Las llamadas a Gemini se hacen a través de la Edge Function
 * "gemini-proxy" de Supabase. La API Key NUNCA sale del servidor.
 *
 * 1. analyzeFoodPhoto    → detecta alimentos desde un File de imagen
 * 2. analyzeFoodByText   → calcula macros desde nombre + cantidad
 * 3. analyzeFoodWithPos  → detecta alimentos + posición (bounding box) para overlay
 * 4. analyzeBase64Frame  → mismo que 3 pero acepta base64 directo (frame de video)
 */

import { logTokenUsage } from './tokenLogger'
import { supabase } from './supabase'

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
 * Llama a Gemini a través de la Edge Function "gemini-proxy".
 * La API Key vive como secret server-side — nunca expuesta al frontend.
 * La lógica de model fallback y retry está en la Edge Function.
 */
async function callGemini(parts, maxTokens = 1024) {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: { parts, maxTokens },
    })

    // Error de red o invocación
    if (error) {
        console.error('Edge Function error:', error)
        throw new Error(error.message || 'Error al conectar con el servidor de IA')
    }

    // Error devuelto por la Edge Function (ej: 429, 500)
    if (data?.error) {
        throw new Error(data.error)
    }

    // Extraer respuesta de Gemini
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    console.log('[Gemini raw]', raw.slice(0, 300))

    // Capturar metadata de uso de tokens y modelo usado
    const usageMetadata = data?.usageMetadata ?? {}
    const model = data?._model ?? 'gemini-2.5-flash'

    // Limpiar markdown code fences
    let clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

    // Helper para retornar parsed + metadata
    const wrapResult = (parsed) => ({ parsed, usageMetadata, model })

    // Intento 1: parsear directamente
    try {
        return wrapResult(JSON.parse(clean))
    } catch { /* intentar extracción */ }

    // Intento 2: extraer el primer bloque JSON {...} del texto
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
        try {
            return wrapResult(JSON.parse(jsonMatch[0]))
        } catch { /* falló también */ }
    }

    // Intento 3: extraer array JSON [{...}]
    const arrMatch = raw.match(/\[[\s\S]*\]/)
    if (arrMatch) {
        try {
            return wrapResult({ items: JSON.parse(arrMatch[0]) })
        } catch { /* falló */ }
    }

    console.error('Gemini devolvió JSON inválido:', clean.slice(0, 300))
    throw new Error('La IA no devolvió datos válidos. Intenta de nuevo.')
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
        // Quantity vacío: el usuario decide la porción total
        quantity: null,
        unit: 'gramos',
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
 * Unifica ingredientes repetidos: si Gemini reporta "atún" 3 veces,
 * se fusiona en un solo item sumando macros.
 * Comparación por nombre normalizado (lowercase, sin tildes).
 */
function mergeItems(items) {
    const map = new Map()
    for (const item of items) {
        // Normalizar nombre para comparación (sin tildes, lowercase)
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
            // Mantener el primer emoji y posición
        } else {
            map.set(key, { ...item })
        }
    }
    return Array.from(map.values())
}

/**
 * Analiza una foto (File) con posición de cada alimento.
 * Usado en el modo foto del modal y en el scanner de cámara.
 * @param {File} imageFile
 */
export async function analyzeFoodPhoto(imageFile) {
    const { base64, mimeType } = await toBase64(imageFile)
    // Edge Function aplica Math.max(8192) para pensamiento + JSON de múltiples items
    const { parsed, usageMetadata, model } = await callGemini([
        { text: SCAN_PROMPT },
        { inlineData: { mimeType, data: base64 } },
    ], 2048)

    // Registrar consumo de tokens
    logTokenUsage({
        functionType: 'photo',
        model,
        inputTokens: usageMetadata.promptTokenCount ?? 0,
        outputTokens: usageMetadata.candidatesTokenCount ?? 0,
        totalTokens: usageMetadata.totalTokenCount ?? 0,
        metadata: { items: (parsed.items ?? []).length },
    })

    // Normalizar → unificar duplicados (ej: 3×atún → 1×atún sumado)
    const normalized = (parsed.items ?? []).map(i => normalizeItem(i, 'photo'))
    return {
        items: mergeItems(normalized),
        confidence: parsed.confidence ?? 'media',
    }
}

/**
 * Analiza un frame de video (base64, jpeg) con posición.
 * Usado para el escaneo de cámara en vivo.
 * @param {string} base64jpeg — datos base64 sin prefijo "data:..."
 */
export async function analyzeBase64Frame(base64jpeg) {
    const { parsed, usageMetadata, model } = await callGemini([
        { text: SCAN_PROMPT },
        { inlineData: { mimeType: 'image/jpeg', data: base64jpeg } },
    ], 2048)

    // Registrar consumo de tokens
    logTokenUsage({
        functionType: 'scan',
        model,
        inputTokens: usageMetadata.promptTokenCount ?? 0,
        outputTokens: usageMetadata.candidatesTokenCount ?? 0,
        totalTokens: usageMetadata.totalTokenCount ?? 0,
        metadata: { items: (parsed.items ?? []).length },
    })

    // Normalizar → unificar duplicados
    const normalized = (parsed.items ?? []).map(i => normalizeItem(i, 'scan'))
    return {
        items: mergeItems(normalized),
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

    // El frontend envía 1024, pero la Edge Function aplica Math.max(8192)
    // para que el pensamiento interno de Gemini 2.5-flash no trunque el JSON.
    const { parsed, usageMetadata, model } = await callGemini([{ text: prompt }], 1024)

    // Registrar consumo de tokens
    logTokenUsage({
        functionType: 'text',
        model,
        inputTokens: usageMetadata.promptTokenCount ?? 0,
        outputTokens: usageMetadata.candidatesTokenCount ?? 0,
        totalTokens: usageMetadata.totalTokenCount ?? 0,
        metadata: { foodName, quantity, unit },
    })

    // Validar que Gemini devolvió datos nutricionales reales
    if (parsed.calories == null && parsed.items !== undefined) {
        throw new Error('Gemini no devolvió datos nutricionales válidos')
    }

    const result = {
        calories: clampNutrient(parsed.calories, MAX_CALORIES),
        protein_g: clampNutrient(parsed.protein_g, MAX_MACRO_G),
        carbs_g: clampNutrient(parsed.carbs_g, MAX_MACRO_G),
        fat_g: clampNutrient(parsed.fat_g, MAX_MACRO_G),
        emoji: parsed.emoji ?? '🍽️',
    }

    // Si TODO es 0, algo salió mal
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
        // Edge Function aplica min 8192 tokens server-side
        const { parsed, usageMetadata, model } = await callGemini([{ text: prompt }], 512)

        // Registrar consumo de tokens
        logTokenUsage({
            functionType: 'onboarding',
            model,
            inputTokens: usageMetadata.promptTokenCount ?? 0,
            outputTokens: usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata.totalTokenCount ?? 0,
            metadata: { firstName },
        })

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

