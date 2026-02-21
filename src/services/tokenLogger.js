/**
 * tokenLogger.js — Servicio para registrar y consultar consumo de tokens IA
 * 
 * Registra cada llamada a Gemini con:
 * - Tipo de función (photo, scan, text, onboarding)
 * - Modelo utilizado
 * - Tokens de entrada/salida
 * - Costo estimado en USD
 * 
 * Los datos se almacenan en la tabla ai_token_log (con RLS por user_id).
 */

import { supabase } from './supabase'

// ── Precios por 1M tokens (Gemini, Feb 2026) ─────────────────────────────────
const PRICING = {
    'gemini-2.5-flash': { input: 0.15, output: 0.60 },     // USD por 1M tokens
    'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
}
const DEFAULT_PRICING = { input: 0.15, output: 0.60 }

/**
 * Calcula el costo en USD dado el modelo y la cantidad de tokens.
 * @param {string} model - Nombre del modelo Gemini
 * @param {number} inputTokens - Tokens de entrada
 * @param {number} outputTokens - Tokens de salida
 * @returns {number} Costo en USD
 */
function calculateCost(model, inputTokens, outputTokens) {
    const prices = PRICING[model] || DEFAULT_PRICING
    return (inputTokens * prices.input + outputTokens * prices.output) / 1_000_000
}

/**
 * Registra el consumo de tokens de una llamada a Gemini.
 * Se ejecuta en background (fire-and-forget) para no bloquear la UI.
 * 
 * @param {object} params
 * @param {string} params.functionType - 'photo' | 'scan' | 'text' | 'onboarding'
 * @param {string} params.model - Nombre del modelo utilizado
 * @param {number} params.inputTokens - Tokens de entrada
 * @param {number} params.outputTokens - Tokens de salida
 * @param {number} params.totalTokens - Tokens totales
 * @param {object} [params.metadata] - Datos extra (nombre alimento, etc.)
 */
export function logTokenUsage({ functionType, model, inputTokens, outputTokens, totalTokens, metadata = {} }) {
    const costUsd = calculateCost(model, inputTokens, outputTokens)

    // Fire-and-forget: no bloqueamos la UI esperando el INSERT
    supabase.from('ai_token_log').insert([{
        function_type: functionType,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_usd: costUsd,
        metadata,
    }]).then(({ error }) => {
        if (error) console.warn('Token log error:', error.message)
    })
}

// ── Consultas para el dashboard ───────────────────────────────────────────────

/**
 * Obtiene estadísticas agregadas de consumo de tokens.
 * Solo devuelve datos del usuario autenticado (RLS).
 * 
 * @param {number} [days=30] - Días hacia atrás para consultar
 * @returns {Promise<object>} Estadísticas agregadas
 */
export async function getTokenStats(days = 30) {
    const from = new Date()
    from.setDate(from.getDate() - days)
    const fromStr = from.toISOString()

    const { data, error } = await supabase
        .from('ai_token_log')
        .select('*')
        .gte('created_at', fromStr)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('getTokenStats error:', error)
        return null
    }

    const logs = data ?? []

    // Totales generales
    let totalInput = 0, totalOutput = 0, totalTokens = 0, totalCost = 0
    const byFunction = {}  // { photo: { count, input, output, total, cost }, ... }
    const byModel = {}     // { 'gemini-2.5-flash': { count, input, output, total, cost }, ... }
    const byDay = {}       // { '2026-02-21': { count, input, output, total, cost }, ... }

    for (const log of logs) {
        totalInput += log.input_tokens
        totalOutput += log.output_tokens
        totalTokens += log.total_tokens
        totalCost += Number(log.cost_usd)

        // Por función
        if (!byFunction[log.function_type]) {
            byFunction[log.function_type] = { count: 0, input: 0, output: 0, total: 0, cost: 0 }
        }
        byFunction[log.function_type].count++
        byFunction[log.function_type].input += log.input_tokens
        byFunction[log.function_type].output += log.output_tokens
        byFunction[log.function_type].total += log.total_tokens
        byFunction[log.function_type].cost += Number(log.cost_usd)

        // Por modelo
        if (!byModel[log.model]) {
            byModel[log.model] = { count: 0, input: 0, output: 0, total: 0, cost: 0 }
        }
        byModel[log.model].count++
        byModel[log.model].input += log.input_tokens
        byModel[log.model].output += log.output_tokens
        byModel[log.model].total += log.total_tokens
        byModel[log.model].cost += Number(log.cost_usd)

        // Por día
        const day = log.created_at.slice(0, 10)
        if (!byDay[day]) {
            byDay[day] = { count: 0, input: 0, output: 0, total: 0, cost: 0 }
        }
        byDay[day].count++
        byDay[day].input += log.input_tokens
        byDay[day].output += log.output_tokens
        byDay[day].total += log.total_tokens
        byDay[day].cost += Number(log.cost_usd)
    }

    return {
        totalCalls: logs.length,
        totalInput,
        totalOutput,
        totalTokens,
        totalCost,
        byFunction,
        byModel,
        byDay,
        logs,      // datos crudos para tabla detallada
        pricing: PRICING,
    }
}
