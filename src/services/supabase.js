/**
 * supabase.js — Cliente Supabase con Auth + CRUD por usuario
 *
 * RLS habilitado: todas las queries aplican automáticamente
 * el filtro user_id = auth.uid() en el servidor.
 * El cliente SDK incluye el JWT del usuario en cada request.
 */

import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
        auth: {
            // Supabase persiste la sesión en localStorage automáticamente.
            // El usuario no necesita volver a loguearse hasta que el token expire (1 semana).
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    }
)

// ══════════════════════════════════════════════════════════════════════════
// AUTH — Registro, login, sesión
// ══════════════════════════════════════════════════════════════════════════

/**
 * Registra un nuevo usuario.
 * Supabase crea la fila en auth.users y el trigger crea el user_config.
 * @param {string} email
 * @param {string} password
 * @param {string} fullName - se guarda en user_metadata y user_config
 */
export async function signUp(email, password, fullName, calorieGoal = 2000) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            // full_name y calorie_goal van al trigger → user_config
            data: { full_name: fullName, calorie_goal: String(calorieGoal) },
            emailRedirectTo: window.location.origin,
        },
    })
    if (error) throw error
    return data
}

/**
 * Inicia sesión con email y contraseña.
 * La sesión queda guardada automáticamente en localStorage.
 */
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
}

/** Cierra la sesión del usuario actual */
export async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

/**
 * Obtiene la sesión activa desde localStorage (sincrónico).
 * Retorna null si no hay sesión.
 */
export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
}

/**
 * Suscribe un listener a cambios de sesión (login, logout, refresh).
 * El callback recibe (session, event) donde event es:
 *   'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'INITIAL_SESSION'
 * Retorna la función de unsuscribe para limpiar en useEffect.
 */
export function onAuthChange(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => callback(session, event)
    )
    return () => subscription.unsubscribe()
}

// ══════════════════════════════════════════════════════════════════════════
// USER CONFIG — Perfil del usuario
// ══════════════════════════════════════════════════════════════════════════

/**
 * Lee la configuración del usuario autenticado.
 * RLS filtra automáticamente por user_id = auth.uid().
 */
export async function getConfig() {
    const { data, error } = await supabase
        .from('user_config')
        .select('*')
        .single()
    if (error && error.code !== 'PGRST116') throw error
    return data
}

/** Actualiza el perfil del usuario */
export async function updateConfig(id, payload) {
    const { error } = await supabase
        .from('user_config')
        .update(payload)
        .eq('id', id)
    if (error) throw error
}

// ══════════════════════════════════════════════════════════════════════════
// FOOD LOG — Registro de alimentos
// ══════════════════════════════════════════════════════════════════════════

export async function getFoodByDate(date) {
    const { data, error } = await supabase
        .from('food_log')
        .select('*')
        .eq('log_date', date)
        .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
}

export async function addFood(item) {
    // user_id se inyecta automáticamente vía RLS WITH CHECK (auth.uid())
    const { error } = await supabase.from('food_log').insert([{
        log_date: item.log_date,
        meal_type: item.meal_type,
        food_name: item.food_name,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        source: item.source ?? 'manual',
        photo_url: item.photo_url ?? null,   // URL del Storage (si se subió foto)
    }])
    if (error) throw error
}

// ══════════════════════════════════════════════════════════════════════════
// STORAGE — Fotos de alimentos
// ══════════════════════════════════════════════════════════════════════════

const BUCKET = 'food-photos'

/**
 * Sube una foto al bucket "food-photos".
 * La ruta es: {user_id}/{fecha}-{timestamp}.jpg
 * RLS garantiza que solo el usuario propietario puede leer/escribir.
 *
 * @param {File|Blob} file  - Archivo o Blob de la imagen
 * @param {string} [ext]    - Extensión: 'jpg', 'png', 'webp'
 * @returns {Promise<string>} URL pública (signed) de la foto subida
 */
export async function uploadFoodPhoto(file, ext = 'jpg') {
    // Obtener user_id actual
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No hay sesión activa')

    const userId = session.user.id
    const timestamp = Date.now()
    const fileName = `${userId}/${todayStr()}-${timestamp}.${ext}`

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, file, {
            contentType: `image/${ext}`,
            upsert: false,
        })

    if (error) throw error

    // Generar URL firmada válida por 10 años (máx Supabase = 315360000s)
    const { data: signedData, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(fileName, 315360000)

    if (signErr) throw signErr
    return signedData.signedUrl
}

/**
 * Renueva una URL firmada vencida.
 * Extrae la ruta del bucket desde la URL original y genera una nueva.
 * @param {string} oldUrl - URL firmada vencida
 * @returns {Promise<string|null>} Nueva URL firmada o null si falla
 */
export async function refreshSignedUrl(oldUrl) {
    try {
        // Extraer path del bucket desde la URL
        const urlObj = new URL(oldUrl)
        const pathMatch = urlObj.pathname.match(/\/object\/sign\/food-photos\/(.+)/)
        if (!pathMatch) return null
        const filePath = decodeURIComponent(pathMatch[1])
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(filePath, 315360000)
        if (error) return null
        return data.signedUrl
    } catch {
        return null
    }
}

/**
 * Elimina una foto del storage por su URL firmada o path
 * @param {string} path - Ruta relativa dentro del bucket (userId/archivo.jpg)
 */
export async function deleteFoodPhoto(path) {
    const { error } = await supabase.storage.from(BUCKET).remove([path])
    if (error) console.warn('No se pudo eliminar foto:', error.message)
}

export async function deleteFood(id) {
    const { error } = await supabase.from('food_log').delete().eq('id', id)
    if (error) throw error
}

// ══════════════════════════════════════════════════════════════════════════
// WATER LOG — Vasos de agua
// ══════════════════════════════════════════════════════════════════════════

export async function getWaterByDate(date) {
    const { data, error } = await supabase
        .from('water_log')
        .select('*')
        .eq('log_date', date)
        .maybeSingle()
    if (error) throw error
    return data
}

export async function setWaterGlasses(date, glasses) {
    const { data: existing } = await supabase
        .from('water_log')
        .select('id')
        .eq('log_date', date)
        .maybeSingle()

    if (existing) {
        const { error } = await supabase
            .from('water_log')
            .update({ glasses })
            .eq('id', existing.id)
        if (error) throw error
    } else {
        const { error } = await supabase
            .from('water_log')
            .insert([{ log_date: date, glasses }])
        if (error) throw error
    }
}

// ══════════════════════════════════════════════════════════════════════════
// WEIGHT LOG — Peso corporal
// ══════════════════════════════════════════════════════════════════════════

export async function getWeightHistory(limit = 12) {
    const { data, error } = await supabase
        .from('weight_log')
        .select('*')
        .order('log_date', { ascending: false })
        .limit(limit)
    if (error) throw error
    return data ?? []
}

/**
 * Registra/actualiza peso del día.
 * Usa upsert: si ya hay registro para ese día, lo actualiza.
 * Evita duplicados en la gráfica de tendencia.
 */
export async function logWeight(date, weight_kg, notes = '') {
    // Verificar si ya existe registro para hoy
    const { data: existing } = await supabase
        .from('weight_log')
        .select('id')
        .eq('log_date', date)
        .maybeSingle()

    if (existing) {
        const { error } = await supabase
            .from('weight_log')
            .update({ weight_kg, notes })
            .eq('id', existing.id)
        if (error) throw error
    } else {
        const { error } = await supabase.from('weight_log').insert([{
            log_date: date, weight_kg, notes,
        }])
        if (error) throw error
    }
}

export async function deleteWeight(id) {
    const { error } = await supabase.from('weight_log').delete().eq('id', id)
    if (error) throw error
}

// ══════════════════════════════════════════════════════════════════════════
// HISTORIAL — Resumen diario
// ══════════════════════════════════════════════════════════════════════════

export async function getCalorieHistory(days = 15) {
    const from = new Date()
    from.setDate(from.getDate() - days)
    const fromStr = from.toISOString().slice(0, 10)

    // Traer comida, agua y peso en paralelo
    const [foodRes, waterRes, weightRes] = await Promise.all([
        supabase
            .from('food_log')
            .select('log_date, calories, protein_g, carbs_g, fat_g')
            .gte('log_date', fromStr)
            .order('log_date', { ascending: false }),
        supabase
            .from('water_log')
            .select('log_date, glasses')
            .gte('log_date', fromStr),
        supabase
            .from('weight_log')
            .select('log_date, weight_kg')
            .gte('log_date', fromStr),
    ])

    if (foodRes.error) throw foodRes.error
    // water y weight pueden fallar silenciosamente (tabla nueva etc.)

    // Indexar agua por fecha
    const waterMap = {}
    for (const w of waterRes.data ?? []) {
        waterMap[w.log_date] = w.glasses ?? 0
    }

    // Indexar peso por fecha
    const weightMap = {}
    for (const w of weightRes.data ?? []) {
        weightMap[w.log_date] = w.weight_kg
    }

    // Agrupar comida por fecha
    const grouped = {}
    for (const row of foodRes.data ?? []) {
        if (!grouped[row.log_date]) {
            grouped[row.log_date] = {
                log_date: row.log_date,
                total_calories: 0, total_protein: 0,
                total_carbs: 0, total_fat: 0, total_items: 0,
                glasses: 0, weight_kg: null,
            }
        }
        grouped[row.log_date].total_calories += Number(row.calories ?? 0)
        grouped[row.log_date].total_protein += Number(row.protein_g ?? 0)
        grouped[row.log_date].total_carbs += Number(row.carbs_g ?? 0)
        grouped[row.log_date].total_fat += Number(row.fat_g ?? 0)
        grouped[row.log_date].total_items += 1
    }

    // Mezclar agua y peso
    const allDates = new Set([
        ...Object.keys(grouped),
        ...Object.keys(waterMap),
        ...Object.keys(weightMap),
    ])

    for (const date of allDates) {
        if (!grouped[date]) {
            grouped[date] = {
                log_date: date,
                total_calories: 0, total_protein: 0,
                total_carbs: 0, total_fat: 0, total_items: 0,
                glasses: 0, weight_kg: null,
            }
        }
        if (waterMap[date]) grouped[date].glasses = waterMap[date]
        if (weightMap[date]) grouped[date].weight_kg = weightMap[date]
    }

    return Object.values(grouped).sort((a, b) => b.log_date.localeCompare(a.log_date))
}

// ══════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Fecha actual en formato YYYY-MM-DD usando hora LOCAL del dispositivo.
 * Importante: toISOString() devuelve UTC, lo que causaba que después de
 * las 6PM en México (UTC-6) la fecha fuera del día siguiente.
 */
export function todayStr() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

// ══════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG — Registro granular de eventos
// Tipos: 'water', 'fasting_start', 'fasting_end', 'food_add', 'weight'
// ══════════════════════════════════════════════════════════════════════════

/**
 * Registra un evento individual con timestamp exacto.
 * @param {'water'|'fasting_start'|'fasting_end'|'food_add'|'weight'} type
 * @param {object} metadata — datos extra (glass_number, hours, food_name, kg, etc.)
 */
export async function logActivity(type, metadata = {}) {
    const { error } = await supabase.from('activity_log').insert([{
        type,
        log_date: todayStr(),
        log_time: new Date().toISOString(), // timestamp absoluto (UTC) para ordenamiento
        metadata,
    }])
    if (error) console.error('logActivity error:', error)
}

/**
 * Obtiene el timeline de actividades de los últimos N días.
 * Devuelve array de eventos ordenados por timestamp descendente.
 */
export async function getActivityLog(days = 15) {
    const from = new Date()
    from.setDate(from.getDate() - days)
    const fromStr = from.toISOString().slice(0, 10)

    const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .gte('log_date', fromStr)
        .order('log_time', { ascending: false })

    if (error) {
        console.error('getActivityLog error:', error)
        return []
    }
    return data ?? []
}
