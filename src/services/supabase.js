/**
 * supabase.js — Cliente Supabase usando el SDK oficial
 * Las variables de entorno se configuran en .env.local
 * y en las Environment Variables de Vercel.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Helpers de fecha ──────────────────────────────────────────────────────
export const todayStr = () => new Date().toISOString().split('T')[0]

// ── user_config ───────────────────────────────────────────────────────────

/** Obtiene la configuración del usuario (primera fila) */
export async function getConfig() {
    const { data, error } = await supabase
        .from('user_config')
        .select('*')
        .limit(1)
        .single()
    if (error && error.code !== 'PGRST116') throw error   // 116 = no rows
    return data ?? { calorie_goal: 2000, water_goal: 8, water_reminder_hours: 2, name: 'Usuario', notifications_enabled: true }
}

/** Actualiza la configuración del usuario */
export async function updateConfig(id, data) {
    const { error } = await supabase
        .from('user_config')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
    if (error) throw error
}

// ── food_log ──────────────────────────────────────────────────────────────

/** Alimentos registrados en una fecha */
export async function getFoodByDate(date) {
    const { data, error } = await supabase
        .from('food_log')
        .select('*')
        .eq('log_date', date)
        .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
}

/** Registra un nuevo alimento */
export async function addFood(food) {
    const { data, error } = await supabase
        .from('food_log')
        .insert(food)
        .select()
    if (error) throw error
    return data
}

/** Elimina un alimento por ID */
export async function deleteFood(id) {
    const { error } = await supabase.from('food_log').delete().eq('id', id)
    if (error) throw error
}

/** Resumen de calorías de los últimos N días (usa la vista daily_summary) */
export async function getCalorieHistory(days = 14) {
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('daily_summary')
        .select('*')
        .gte('log_date', sinceStr)
        .order('log_date', { ascending: false })
    if (error) throw error
    return data ?? []
}

// ── weight_log ────────────────────────────────────────────────────────────

/** Últimos N registros de peso */
export async function getWeightHistory(limit = 10) {
    const { data, error } = await supabase
        .from('weight_log')
        .select('*')
        .order('log_date', { ascending: false })
        .limit(limit)
    if (error) throw error
    return data ?? []
}

/** Upsert de peso para una fecha */
export async function logWeight(date, weightKg, notes = '') {
    const { data: existing } = await supabase
        .from('weight_log')
        .select('id')
        .eq('log_date', date)
        .limit(1)

    if (existing?.length > 0) {
        const { error } = await supabase
            .from('weight_log')
            .update({ weight_kg: weightKg, notes })
            .eq('log_date', date)
        if (error) throw error
    } else {
        const { error } = await supabase
            .from('weight_log')
            .insert({ log_date: date, weight_kg: weightKg, notes })
        if (error) throw error
    }
}

/** Elimina registro de peso */
export async function deleteWeight(id) {
    const { error } = await supabase.from('weight_log').delete().eq('id', id)
    if (error) throw error
}

// ── water_log ─────────────────────────────────────────────────────────────

/** Obtiene o crea el registro de agua de hoy */
export async function getWaterByDate(date) {
    const { data } = await supabase
        .from('water_log')
        .select('*')
        .eq('log_date', date)
        .limit(1)
    return data?.[0] ?? null
}

/** Actualiza los vasos de agua del día */
export async function setWaterGlasses(date, glasses) {
    const existing = await getWaterByDate(date)
    if (existing) {
        const { error } = await supabase
            .from('water_log')
            .update({ glasses })
            .eq('log_date', date)
        if (error) throw error
    } else {
        const { error } = await supabase
            .from('water_log')
            .insert({ log_date: date, glasses })
        if (error) throw error
    }
}
