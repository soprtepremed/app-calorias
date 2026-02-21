---
description: How to build, test, and deploy changes to the K-Cal app
---

# Workflow: Deploy K-Cal

## Desarrollo Local

// turbo-all

1. Instalar dependencias (si es primera vez):
```powershell
cd "c:\Users\curso\OneDrive\Documentos\App calorias\kcal-app"
npm install
```

2. Levantar servidor de desarrollo:
```powershell
cd "c:\Users\curso\OneDrive\Documentos\App calorias\kcal-app"
npm run dev
```
El servidor escucha en `http://localhost:5173` y en la IP local para probar en móvil.

## Build y Deploy

3. Build de producción:
```powershell
cd "c:\Users\curso\OneDrive\Documentos\App calorias\kcal-app"
npx vite build 2>&1 | Select-Object -Last 5
```

4. Commit y deploy:
```powershell
cd "c:\Users\curso\OneDrive\Documentos\App calorias\kcal-app"
git add -A; git commit -m "feat: [DESCRIPCION]"; git push origin develop; git checkout master; git merge develop; git push origin master; git checkout develop
```

## Deploy Edge Function (solo si se modifica gemini-proxy)

5. Desplegar Edge Function:
```powershell
cd "c:\Users\curso\OneDrive\Documentos\App calorias\kcal-app"
npx supabase functions deploy gemini-proxy
```

## Troubleshooting

- Si el build falla, verificar errores de import con `npx vite build 2>&1`
- Si hay problemas de sesión, verificar que `persistSession: true` está en la config de Supabase
- Si Gemini da 429, la Edge Function tiene retry automático con fallback de modelos
- Para probar en móvil: usar la IP local que muestra Vite al arrancar
