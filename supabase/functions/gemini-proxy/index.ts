/**
 * gemini-proxy — Edge Function que proxea llamadas a Gemini API.
 *
 * Seguridad:
 * - API Key de Gemini almacenada como secret server-side (nunca expuesta al frontend)
 * - Requiere JWT válido de Supabase (usuario autenticado)
 * - Rate limit implícito: solo usuarios logueados pueden invocar
 *
 * Flujo:
 * 1. Frontend envía { parts, maxTokens } via supabase.functions.invoke()
 * 2. La Edge Function intenta modelo principal → fallback → retry en 429
 * 3. Retorna la respuesta completa de Gemini (con usageMetadata)
 */

// CORS headers para peticiones del frontend
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Modelos en orden de preferencia
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-lite']

/** Construye la URL de la API de Gemini */
function makeUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
}

/**
 * Llama a Gemini con fallback de modelos + retry para rate limits (429).
 * Misma lógica que tenía el frontend, ahora segura en el servidor.
 */
async function callGemini(
  apiKey: string,
  parts: unknown[],
  maxTokens: number,
  _retry = false,
): Promise<Response> {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens },
  })

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i]
    const res = await fetch(makeUrl(model, apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    // 429 con otro modelo disponible → siguiente
    if (res.status === 429 && i < MODELS.length - 1) {
      console.warn(`⏳ ${model} rate limited — probando ${MODELS[i + 1]}...`)
      continue
    }

    // 429 en último modelo, primer intento → esperar y reintentar
    if (res.status === 429 && !_retry) {
      const errBody = await res.json().catch(() => ({}))
      const retryMatch = (errBody as any)?.error?.message?.match(/retry in ([\d.]+)s/i)
      const waitSec = Math.min(retryMatch ? parseFloat(retryMatch[1]) : 15, 30)
      console.warn(`⏳ Rate limited — esperando ${Math.ceil(waitSec)}s...`)
      await new Promise(r => setTimeout(r, (waitSec + 1) * 1000))
      return callGemini(apiKey, parts, maxTokens, true)
    }

    // Error no-429 → reportar
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      const msg = (e as any)?.error?.message || `Gemini HTTP ${res.status}`
      return new Response(JSON.stringify({ error: msg }), {
        status: res.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Éxito — devolver respuesta completa de Gemini (incluye usageMetadata)
    const data = await res.json()
    return new Response(JSON.stringify({ ...data, _model: model }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({ error: 'Todos los modelos de IA están temporalmente no disponibles' }),
    { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // 1. Validar método
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // 2. Obtener API Key del entorno (secret server-side)
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      console.error('GEMINI_API_KEY no configurada en secrets')
      return new Response(JSON.stringify({ error: 'Configuración del servidor incompleta' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // 3. Parsear el body del request
    const { parts, maxTokens = 1024 } = await req.json()

    if (!parts || !Array.isArray(parts)) {
      return new Response(JSON.stringify({ error: 'Campo "parts" requerido (array)' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // 4. Ejecutar la llamada a Gemini
    return await callGemini(apiKey, parts, maxTokens)

  } catch (err) {
    console.error('gemini-proxy error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Error interno del proxy' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
