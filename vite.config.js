import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // host: true → escucha en 0.0.0.0 (accesible por IP de red local)
    // Permite probar desde el teléfono en la misma WiFi
    host: true,
    port: 5173,
    // CORS abierto en desarrollo para que Supabase funcione sin problemas
    cors: true,
    // Mostrar la URL de red local al arrancar
    open: false,
  },
})
