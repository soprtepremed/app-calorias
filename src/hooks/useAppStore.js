/**
 * useAppStore.js — Estado global de la app con useReducer
 * Centraliza todos los datos para evitar prop-drilling.
 */
import { useReducer, useCallback } from 'react'

const initialState = {
    // Config del usuario
    config: null,
    configId: null,
    // Datos del día
    today: new Date().toISOString().split('T')[0],
    foodLog: [],
    waterGlasses: 0,
    // Historial
    calorieHistory: [],
    weightHistory: [],
    // UI
    loading: false,
    toast: null,   // { msg, id }
}

function reducer(state, action) {
    switch (action.type) {
        case 'SET_CONFIG':
            return { ...state, config: action.payload, configId: action.payload?.id }
        case 'SET_FOOD_LOG':
            return { ...state, foodLog: action.payload }
        case 'SET_WATER':
            return { ...state, waterGlasses: action.payload }
        case 'SET_CALORIE_HISTORY':
            return { ...state, calorieHistory: action.payload }
        case 'SET_WEIGHT_HISTORY':
            return { ...state, weightHistory: action.payload }
        case 'SET_LOADING':
            return { ...state, loading: action.payload }
        case 'SHOW_TOAST':
            return { ...state, toast: { msg: action.payload, id: Date.now() } }
        case 'CLEAR_TOAST':
            return { ...state, toast: null }
        default:
            return state
    }
}

export function useAppStore() {
    const [state, dispatch] = useReducer(reducer, initialState)

    const showToast = useCallback((msg) => {
        dispatch({ type: 'SHOW_TOAST', payload: msg })
        setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2800)
    }, [])

    return { state, dispatch, showToast }
}
