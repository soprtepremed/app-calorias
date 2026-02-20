/**
 * gemini.js — Servicio Gemini Vision + texto
 * 1. analyzeFoodPhoto  → detecta alimentos desde una foto
 * 2. analyzeFoodByText → calcula macros desde nombre + cantidad
 */

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-1.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`

/** Prompt para análisis de foto */
const PHOTO_PROMPT = `Analiza esta imagen de comida y devuelve ÚNICAMENTE un JSON válido (sin markdown):
{
  "items": [
    {
      "name": "nombre en español",
      "emoji": "emoji",
      "quantity": número,
      "unit": "gramos|piezas|taza|ml|porción",
      "calories": número,
      "protein_g": número,
      "carbs_g": número,
      "fat_g": número
    }
  ],
  "confidence": "alta|media|baja"
}
Identifica TODOS los alimentos visibles. Estima porciones realistas. Si no hay comida devuelve items:[].`

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

/** Llama a Gemini y parsea el JSON de la respuesta */
async function callGemini(parts, maxTokens = 1024) {
    const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens },
        }),
    })
    if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error?.message || `Gemini HTTP ${res.status}`)
    }
    const data = await res.json()
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    return JSON.parse(clean)
}

/**
 * Analiza una foto y devuelve lista de alimentos con macros.
 * @param {File} imageFile
 */
export async function analyzeFoodPhoto(imageFile) {
    const { base64, mimeType } = await toBase64(imageFile)
    const parsed = await callGemini([
        { text: PHOTO_PROMPT },
        { inlineData: { mimeType, data: base64 } },
    ])
    return {
        items: (parsed.items ?? []).map(i => ({
            food_name: i.name ?? 'Desconocido',
            emoji: i.emoji ?? '🍽️',
            quantity: Number(i.quantity ?? 1),
            unit: i.unit ?? 'porción',
            calories: Number(i.calories ?? 0),
            protein_g: Number(i.protein_g ?? 0),
            carbs_g: Number(i.carbs_g ?? 0),
            fat_g: Number(i.fat_g ?? 0),
            source: 'photo',
        })),
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

    const parsed = await callGemini([{ text: prompt }], 256)
    return {
        calories: Number(parsed.calories ?? 0),
        protein_g: Number(parsed.protein_g ?? 0),
        carbs_g: Number(parsed.carbs_g ?? 0),
        fat_g: Number(parsed.fat_g ?? 0),
        emoji: parsed.emoji ?? '🍽️',
    }
}
