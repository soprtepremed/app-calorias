/**
 * RegisterHelpers.js — Funciones de cálculo para el flujo de registro.
 *
 * Extraídas de Register.jsx para mantener el componente enfocado en UI.
 * Incluye: IMC, TDEE (Harris-Benedict), metas de agua y proteína.
 */

// ── Cálculos de perfil ──────────────────────────────────────────────────────

/** Índice de Masa Corporal */
export function calcBMI(weightKg, heightCm) {
    const h = heightCm / 100
    return parseFloat((weightKg / (h * h)).toFixed(1))
}

/** Categoría IMC con label, color y emoji */
export function bmiCategory(bmi) {
    if (bmi < 18.5) return { label: 'Bajo peso', color: '#0A84FF', emoji: '📉' }
    if (bmi < 25) return { label: 'Normal', color: '#30D158', emoji: '✅' }
    if (bmi < 30) return { label: 'Sobrepeso', color: '#FF9F0A', emoji: '⚠️' }
    return { label: 'Obesidad', color: '#FF375F', emoji: '🔴' }
}

/**
 * TDEE con Harris-Benedict × factor de actividad.
 * Redondea a 50 kcal más cercanas.
 */
export function calcTDEE(weightKg, heightCm, age, sex, activity) {
    let bmr
    if (sex === 'M') {
        bmr = 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age)
    } else {
        bmr = 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age)
    }
    const factors = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, activo: 1.725, muy_activo: 1.9 }
    const tdee = bmr * (factors[activity] ?? 1.55)
    return Math.round(tdee / 50) * 50
}

/** Agua recomendada: 35ml por kg → vasos de 250ml */
export function calcWaterGoal(weightKg) {
    return Math.max(6, Math.min(12, Math.round((weightKg * 35) / 250)))
}

/** Proteína recomendada: variable por nivel de actividad */
export function calcProteinGoal(weightKg, activity) {
    const factor = { sedentario: 1.0, ligero: 1.3, moderado: 1.6, activo: 1.8, muy_activo: 2.0 }
    return Math.round(weightKg * (factor[activity] ?? 1.6))
}

// ── Constantes ──────────────────────────────────────────────────────────────

export const ACTIVITY_OPTIONS = [
    { key: 'sedentario', label: 'Sedentario', sub: 'Sin ejercicio', emoji: '🛋️' },
    { key: 'ligero', label: 'Ligero', sub: '1-2 días/semana', emoji: '🚶' },
    { key: 'moderado', label: 'Moderado', sub: '3-5 días/semana', emoji: '🏃' },
    { key: 'activo', label: 'Activo', sub: '6-7 días/semana', emoji: '💪' },
    { key: 'muy_activo', label: 'Muy activo', sub: 'Ejercicio intenso diario', emoji: '🏋️' },
]
