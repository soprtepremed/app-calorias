# 📱 KCal — Guía de Uso

**URL:** https://app-calorias-eight.vercel.app/

---

## ¿Qué es KCal?

KCal es una app personal para registrar lo que comes cada día, controlar tus calorías y macronutrientes (proteína, carbohidratos y grasa), registrar tu peso y mantenerte hidratado. Usa inteligencia artificial (Gemini de Google) para calcular automáticamente los valores nutricionales.

---

## Instalación en el celular (recomendado)

### Android
1. Abre **Chrome** y ve a `https://app-calorias-eight.vercel.app/`
2. Toca el menú de 3 puntos **(⋮)** arriba a la derecha
3. Selecciona **"Añadir a pantalla de inicio"**
4. Confirma → la app aparece como ícono en tu pantalla

### iPhone
1. Abre **Safari** y ve a `https://app-calorias-eight.vercel.app/`
2. Toca el botón de **compartir** (cuadro con flecha hacia arriba)
3. Selecciona **"Agregar a pantalla de inicio"**
4. Confirma → listo

---

## Pantallas de la app

La app tiene 4 pantallas accesibles desde la barra de navegación inferior:

| Ícono | Pantalla | Función |
|---|---|---|
| 🏠 | **Inicio** | Resumen del día: calorías, macros, agua, alimentos |
| 📊 | **Historial** | Últimos 14 días con tendencias |
| ⚖️ | **Peso** | Registro de peso corporal con gráfica |
| ⚙️ | **Ajustes** | Metas, notificaciones, nombre |

---

## 🏠 Pantalla de Inicio (Dashboard)

Es la pantalla principal. Muestra todo lo de hoy.

### Círculo de calorías
- El círculo grande muestra cuántas **kcal** has consumido hoy
- El arco naranja va llenándose conforme comes
- Abajo del círculo ves: **Meta** (objetivo del día) y **Restantes** (cuántas te quedan)
- Si pasas la meta, el círculo se pone rojo y dice **Exceso**

### Macronutrientes
Tres tarjetas debajo del círculo:
- 🔵 **Proteína** (gramos) — músculo y saciedad
- 🟠 **Carbos** (gramos) — energía
- 🟣 **Grasa** (gramos) — hormonas y energía

### Agua
- Cada cuadro azul = 1 vaso de 250ml
- **Toca un vaso** para marcarlo como bebido
- Toca de nuevo el último vaso lleno para desmarcarlo
- Cuando alcances tu meta aparece una confirmación verde

### Lista de alimentos
Los alimentos del día agrupados por comida (Desayuno, Almuerzo, Cena, Snack).  
- Muestra: nombre, cantidad, macros y calorías de cada uno
- **Mantén el dedo** sobre un alimento para ver el botón de eliminar (🗑️)

---

## ➕ Registrar un alimento

Toca el botón naranja **(+)** flotante, abajo a la derecha.

### Paso 1 — Tipo de comida
Selecciona: **Desayuno / Almuerzo / Cena / Snack**

### Paso 2 — Modo de registro

Tienes dos opciones:

---

#### 📝 Modo Manual

1. Escribe el **nombre del alimento** (ej: "Pechuga de pollo a la plancha")
2. Escribe la **cantidad** (ej: 150) y la **unidad** (ej: gramos)
3. Toca **"Calcular con IA (Gemini)"** — la app consulta a la IA y llena automáticamente:
   - Calorías
   - Proteína
   - Carbohidratos
   - Grasa
4. Revisa los valores (puedes editarlos si quieres ajustar)
5. Toca **Guardar**

> ✅ **No necesitas saber las calorías de memoria** — la IA las calcula por ti en segundos.

---

#### 📷 Modo Foto IA

1. Toca en la zona de la cámara
2. Toma una **foto de tu plato** o elige una imagen de la galería
3. La IA analiza la foto y detecta automáticamente todos los alimentos visibles
4. Aparece una lista con cada alimento, su cantidad estimada y sus calorías
5. **Selecciona** los alimentos que quieres registrar (todos vienen seleccionados por defecto)
6. Toca **Guardar**

> 💡 **Consejos para mejores resultados:**
> - Foto desde arriba del plato, con buena luz
> - Que todos los alimentos sean visibles
> - Funciona con platillos mexicanos, comida rápida, frutas, etc.

---

## 📊 Pantalla de Historial

Muestra un resumen de los **últimos 14 días**:

- **Promedio** de calorías por día
- **Días registrados**
- Si estás en **Déficit** o **Exceso** calórico (comparado con tu meta)

Por cada día:
- Barra de progreso (naranja = dentro de meta, rojo = exceso, verde = bajo)
- Macros totales del día
- Número de alimentos registrados

---

## ⚖️ Pantalla de Peso

Registra tu peso corporal periódicamente (recomendado: una vez por semana, en ayunas).

### Registrar peso
1. Toca el botón **"Registrar"** (arriba a la derecha)
2. Ingresa tu peso en **kg** (ej: 73.5)
3. Opcional: agrega una nota (ej: "En ayunas", "Después de entrenar")
4. Toca **Guardar**

### Gráfica de tendencia
- Muestra la línea de evolución de tu peso
- Aparece cuando tienes 2 o más registros

### Historial de registros
- Lista de todos tus pesos con fecha
- Indicador de flecha: ↑ rojo (subiste) / ↓ verde (bajaste)
- Muestra la diferencia vs el registro anterior

> 💡 Para eliminar un registro: pasa el dedo sobre él y aparece el ícono de basura.

---

## ⚙️ Pantalla de Ajustes

Personaliza la app según tus necesidades.

### Perfil
- **Tu nombre** — aparece en el saludo del header

### Metas diarias
| Campo | Por defecto | Descripción |
|---|---|---|
| Calorías | 2000 kcal | Tu objetivo calórico diario |
| Vasos de agua | 8 vasos | Equivale a 2 litros (250ml c/u) |
| Recordatorio agua | cada 2 horas | Frecuencia de notificaciones |

### Notificaciones
- Toggle para activar/desactivar los recordatorios de agua
- Solo funcionan entre **8am y 10pm** (no molestan de noche)
- La primera vez te pedirá permiso en el navegador — acepta

### Guardar
Siempre toca **"Guardar Ajustes"** después de hacer cambios.

---

## 💡 Preguntas frecuentes

**¿Los datos se guardan aunque cierre la app?**  
Sí. Todo se guarda en la nube (Supabase). Puedes abrir la app desde cualquier dispositivo y tus datos estarán ahí.

**¿Necesito crear una cuenta?**  
No. La app es de uso personal, sin login.

**¿Funciona sin internet?**  
Necesitas internet para usar la IA y sincronizar datos. Puedes verla instalada sin internet, pero no cargará datos nuevos.

**¿La foto tiene que ser perfecta?**  
No, pero entre mejor la luz y más visible el plato, más precisa será la detección.

**¿Puedo editar un alimento ya guardado?**  
Por ahora solo puedes eliminar y volver a agregar. En una actualización futura se añadirá edición.

**¿Puedo agregar el mismo alimento todos los días?**  
Sí, simplemente regístralo cada día. Considera que cada registro es independiente por fecha.

---

## 🔄 Actualizar la app

La app se actualiza automáticamente. Cada vez que haya mejoras, la próxima vez que la abras verás la versión más reciente.

---

*KCal v1.0 — Powered by Gemini Vision + Supabase · React + Tailwind + Vercel*
