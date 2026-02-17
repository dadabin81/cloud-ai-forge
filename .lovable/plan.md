

# Fase 8: Respuesta Profesional del Chat, Estructura de Archivos y Modelos Actualizados

## Problemas Detectados

### 1. Respuesta del Chat sin formato profesional
- Las respuestas del AI se renderizan con `<pre className="whitespace-pre-wrap">` (linea 934 de Playground.tsx), lo que muestra texto plano sin formatear markdown
- No hay soporte para encabezados, listas, negritas, codigo inline, ni bloques de codigo con syntax highlighting
- Los bloques de codigo generados (que contienen los archivos) se mezclan visualmente con el texto explicativo
- No hay separacion clara entre "explicacion" y "codigo generado"

### 2. Estructura de archivos generados no profesional
- Los templates solo tienen 2 archivos (index.html + app.jsx), mezclando todo en un solo JSX monolitico
- No hay separacion de componentes, estilos, ni utilidades
- La estructura `// filename:` no genera carpetas organizadas (ej: `src/components/`, `src/styles/`)
- `buildProjectPreview()` en `projectGenerator.ts` carga React/Babel desde CDN sin estructura de proyecto real

### 3. Modelos desactualizados
- La lista de modelos en `cloudflare/src/index.ts` (linea 1600) tiene modelos obsoletos:
  - `@cf/mistral/mistral-7b-instruct-v0.2` -- version vieja
  - `@cf/qwen/qwen1.5-14b-chat-awq` -- version vieja de Qwen
  - Falta Llama 4 Scout, DeepSeek V3, GLM-4.7, Granite 4.0, Llama 3.2 1B/3B
- El frontend (`useProviders.ts`) depende 100% del endpoint `/v1/models`, sin fallback actualizado
- No hay informacion de costes en neurons para que el usuario entienda el consumo

---

## Solucion

### Parte A: Renderizado Markdown Profesional en el Chat

**Problema**: Linea 934 de `Playground.tsx` usa `<pre>` para todo el contenido.

**Solucion**: Crear un componente `ChatMessage.tsx` que:
1. Separa el contenido de respuesta en dos zonas: **texto explicativo** (renderizado como markdown) y **bloques de codigo** (ocultos del chat ya que se muestran en el IDE)
2. Usa una funcion simple de renderizado markdown (sin dependencias externas) que convierte:
   - `**texto**` a negritas
   - `# titulo` a encabezados
   - `- item` a listas
   - `` `codigo` `` a codigo inline con fondo
   - Bloques ``` a bloques de codigo con estilo
3. Los bloques de codigo que corresponden a archivos del proyecto (`// filename:` o `[EDIT_FILE:]`) se muestran como badges compactos ("archivo actualizado") en vez del codigo completo
4. La respuesta se estructura visualmente con secciones claras

**Archivos**:
- Crear: `src/components/ChatMessage.tsx` -- componente de renderizado de mensajes
- Modificar: `src/pages/Playground.tsx` -- reemplazar `<pre>` con `<ChatMessage>`

### Parte B: Estructura de Archivos Profesional

**Problema**: Los templates y el system prompt no guian una estructura profesional de carpetas.

**Solucion**:
1. Actualizar los templates en `src/lib/templates.ts` para que tengan estructura de carpetas realista:
   ```
   src/
     components/
       Header.jsx
       Hero.jsx
       Features.jsx
     styles/
       globals.css
     App.jsx
   index.html
   ```
2. Actualizar el `DEFAULT_SYSTEM_PROMPT` para instruir al AI a generar siempre con estructura de carpetas organizada
3. Actualizar `buildProjectPreview()` en `projectGenerator.ts` para resolver imports entre archivos correctamente (los `<script src="app.jsx">` actualmente no funcionan, todo se inyecta inline)

**Archivos**:
- Modificar: `src/lib/templates.ts` -- reestructurar con carpetas
- Modificar: `src/pages/Playground.tsx` -- system prompt con instrucciones de estructura
- Modificar: `src/lib/projectGenerator.ts` -- mejorar `buildProjectPreview()` para concatenar JSX de multiples archivos

### Parte C: Modelos Actualizados con Costes

**Problema**: Los modelos listados en el worker estan desactualizados y no incluyen informacion de costes.

**Solucion**: Actualizar `getAvailableModels()` en `cloudflare/src/index.ts` con los modelos actuales de Workers AI:

Modelos gratuitos (10,000 neurons/dia incluidos):
- `@cf/meta/llama-3.2-1b-instruct` -- Ultra rapido, ideal para tareas simples (2,457 neurons/M input)
- `@cf/meta/llama-3.2-3b-instruct` -- Buen balance velocidad/calidad (4,625 neurons/M input)
- `@cf/meta/llama-3.1-8b-instruct` -- Modelo principal gratuito (4,119 neurons/M input)
- `@cf/meta/llama-3.1-8b-instruct-fp8-fast` -- Version optimizada y rapida
- `@cf/mistral/mistral-7b-instruct-v0.2` -- Alternativa Mistral
- `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` -- Razonamiento avanzado

Modelos pro (bajo coste):
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast` -- Modelo grande con alta calidad
- `@cf/meta/llama-3.2-11b-vision-instruct` -- Vision multimodal
- `@cf/meta/llama-4-scout-17b-16e-instruct` -- Ultimo modelo Meta con MoE
- `@cf/qwen/qwen2.5-coder-32b-instruct` -- Especializado en codigo

Cada modelo incluira metadata adicional: `neurons_per_m_input`, `neurons_per_m_output`, `capabilities` (code, vision, reasoning), `context_window`.

**Archivos**:
- Modificar: `cloudflare/src/index.ts` -- actualizar `getAvailableModels()` y `MODEL_ROUTING`
- Modificar: `src/hooks/useProviders.ts` -- manejar nuevos campos (neurons, capabilities)
- Modificar: `src/pages/Playground.tsx` -- mostrar info de modelo seleccionado (neurons, capacidades)

### Parte D: Sincronizacion Frontend-Backend de Modelos

**Problema**: El frontend tiene un fallback hardcodeado de 2 modelos (linea 96-108 de `useProviders.ts`) que no coincide con el backend.

**Solucion**:
1. Actualizar el fallback en `useProviders.ts` para que coincida exactamente con los modelos del backend
2. Agregar indicadores visuales en el selector de modelo:
   - Badge de "Free" / "Pro" (ya existe pero mejorar)
   - Badge de capacidad: "Code" / "Vision" / "Reasoning"
   - Tooltip con costo estimado en neurons
3. Modelo por defecto inteligente: `llama-3.1-8b-instruct` para Free, `llama-3.3-70b` para Pro

---

## Detalles Tecnicos

### Archivos a crear

| Archivo | Proposito |
|---------|-----------|
| `src/components/ChatMessage.tsx` | Renderizado markdown profesional de mensajes del chat |

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Playground.tsx` | Usar ChatMessage, actualizar system prompt con instrucciones de estructura, mostrar info de modelo |
| `src/lib/templates.ts` | Reestructurar templates con carpetas profesionales |
| `src/lib/projectGenerator.ts` | Mejorar buildProjectPreview para multiples archivos JSX |
| `cloudflare/src/index.ts` | Actualizar getAvailableModels con modelos actuales y metadata |
| `src/hooks/useProviders.ts` | Actualizar fallback, manejar nuevos campos de modelo |

### Sin nuevas dependencias

El renderizado markdown se hace con una funcion personalizada simple (regex para bold, headers, lists, code), sin necesidad de `react-markdown` ni librerias externas.

### Sin migraciones de base de datos

---

## Resultado esperado

### Chat ANTES:
```
assistant: **Crear un blog moderno con dark mode**\n\nEn este tutorial...
```html\n<!DOCTYPE html>...
```
(Todo como texto plano, sin formato, codigo mezclado)

### Chat DESPUES:
El mensaje del asistente se ve con:
- Titulo en negrita con tipografia clara
- Lista estructurada de archivos a crear/modificar
- Bloques de codigo con fondo oscuro y syntax highlighting basico
- Badges compactos para archivos generados ("index.html actualizado", "App.jsx creado")
- Separacion visual clara entre explicacion y codigo

### Estructura de archivos ANTES:
```
index.html
app.jsx
```

### Estructura de archivos DESPUES:
```
index.html
src/
  App.jsx
  components/
    Header.jsx
    Hero.jsx
  styles/
    globals.css
```

### Modelos ANTES:
6 modelos, algunos obsoletos, sin informacion de costes

### Modelos DESPUES:
10+ modelos actualizados, con badges de capacidad (Code/Vision/Reasoning), indicador de costes en neurons, y recomendacion automatica segun el tipo de tarea

