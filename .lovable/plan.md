

# Fase 2-4: Mejoras del Preview, Blueprint y Auto-Correccion

## Resumen

Con la Fase 1 (persistencia y edicion incremental) completada, ahora implementaremos tres mejoras de alto impacto que transforman el Playground en una plataforma de VibeCoding profesional -- todo sin depender de infraestructura externa.

---

## Fase 2A: Preview Mejorado (sin WebContainers)

Mientras se prepara la integracion con Cloudflare Containers (que requiere configuracion de infraestructura aparte), mejoramos drasticamente el preview actual:

### Cambios en `src/lib/projectGenerator.ts`

- Agregar **Tailwind CSS via CDN** (`<script src="https://cdn.tailwindcss.com">`) automaticamente cuando se detecta uso de clases Tailwind en el codigo generado
- Agregar **consola embebida** que captura `console.log`, `console.error`, `console.warn` del iframe y los muestra en un panel colapsable debajo del preview
- Mejorar el wrapper JSX para soportar hooks de React mas complejos (useState, useEffect, useRef, useMemo)

### Nuevo componente: `src/components/PreviewConsole.tsx`

- Panel colapsable debajo del iframe que muestra logs capturados
- Iconos por tipo: info (azul), warn (amarillo), error (rojo)
- Boton "Clear" para limpiar logs
- Se comunica con el iframe via `window.postMessage`

### Cambios en `src/components/CodePreview.tsx`

- Agregar listener de `postMessage` para recibir logs del iframe
- Inyectar script de captura de consola en el `srcDoc` generado
- Agregar el componente `PreviewConsole` debajo del iframe
- Agregar contador de errores en la toolbar del preview

---

## Fase 2B: Editor de Codigo Editable

### Cambios en `src/components/CodeEditor.tsx`

- Convertir el editor de solo-lectura a **editable** usando un `<textarea>` superpuesto con syntax highlighting
- Los cambios del usuario se propagan al estado `projectFiles` en `Playground.tsx`
- Auto-save: los cambios se guardan automaticamente a la base de datos (via el hook existente `saveFiles`)
- Indicador visual de "archivo modificado" (dot amarillo en el tab del archivo)

### Cambios en `src/pages/Playground.tsx`

- Agregar callback `onCodeChange` que actualiza `projectFiles` cuando el usuario edita manualmente
- El preview se actualiza en tiempo real al editar codigo

---

## Fase 3: Sistema de Blueprint (Generacion por Fases)

### Nuevo archivo: `src/lib/blueprintSystem.ts`

- Define la interfaz `Blueprint`: nombre del proyecto, descripcion, lista de archivos planificados, dependencias CDN, estructura de carpetas
- Funcion `detectBlueprintRequest`: analiza el prompt del usuario para determinar si es un proyecto nuevo (necesita blueprint) o una modificacion (edicion incremental)
- Funcion `buildBlueprintPrompt`: genera un system prompt especial que fuerza al LLM a responder primero con un JSON blueprint antes de generar codigo
- Funcion `parseBlueprintResponse`: extrae el blueprint JSON de la respuesta del LLM

### Cambios en `src/pages/Playground.tsx`

- Nuevo estado `currentPhase`: 'idle' | 'planning' | 'generating' | 'refining'
- Cuando el usuario pide un proyecto nuevo, primero se ejecuta la fase "planning" que muestra el blueprint en el chat como una tarjeta visual
- El usuario puede aprobar o modificar el blueprint antes de que se genere el codigo
- Barra de progreso visual mostrando la fase actual
- Badge "Planning..." / "Generating..." / "Done" en el header del chat

### Nuevo componente: `src/components/BlueprintCard.tsx`

- Tarjeta visual que muestra el plan del proyecto: archivos a crear, dependencias, estructura
- Botones "Aprobar" y "Modificar"
- Al aprobar, se envia el blueprint como contexto para la generacion de codigo

---

## Fase 4: Deteccion y Auto-Correccion de Errores

### Cambios en `src/components/CodePreview.tsx`

- Capturar errores JavaScript del iframe (via postMessage desde el script inyectado)
- Detectar errores de React (render failures, hook errors)
- Nuevo estado `previewErrors` con lista de errores capturados

### Nuevo archivo: `src/lib/errorCorrection.ts`

- Funcion `buildErrorCorrectionPrompt`: toma los errores capturados + el codigo actual y genera un prompt para el LLM que le pide corregir los errores
- Funcion `shouldAutoCorrect`: decide si un error es auto-corregible (errores de sintaxis, imports faltantes, typos)
- Maximo 3 intentos de correccion antes de mostrar el error al usuario

### Cambios en `src/pages/Playground.tsx`

- Nuevo estado `errorCorrectionAttempts`
- Cuando se detecta un error en el preview, se muestra un banner con:
  - Descripcion del error
  - Boton "Auto-fix" que envia el error al LLM para correccion
  - Contador de intentos restantes
- Opcion de activar auto-correccion automatica (sin click) via toggle en Config

---

## Detalles Tecnicos

### Archivos a crear:
| Archivo | Proposito |
|---------|-----------|
| `src/components/PreviewConsole.tsx` | Panel de consola embebida para logs del iframe |
| `src/components/BlueprintCard.tsx` | Tarjeta visual del plan de proyecto |
| `src/lib/blueprintSystem.ts` | Logica de planificacion por fases |
| `src/lib/errorCorrection.ts` | Logica de deteccion y correccion de errores |

### Archivos a modificar:
| Archivo | Cambio |
|---------|--------|
| `src/lib/projectGenerator.ts` | Inyectar Tailwind CDN + script de captura de consola |
| `src/components/CodePreview.tsx` | Listener de postMessage, PreviewConsole, contador de errores |
| `src/components/CodeEditor.tsx` | Hacer editable con textarea overlay |
| `src/pages/Playground.tsx` | Blueprint phases, error correction, onCodeChange callback |

### No se necesitan nuevas dependencias
Todo se implementa con React, los componentes UI existentes (Badge, Button, Card), y APIs del navegador (postMessage, MutationObserver).

### Flujo de usuario mejorado:

```text
1. Usuario escribe "Crea un dashboard de ventas"
2. Fase PLANNING: LLM responde con blueprint JSON
3. Se muestra BlueprintCard en el chat:
   +----------------------------------+
   | Blueprint: Dashboard de Ventas   |
   | Files: index.html, styles.css,   |
   |        App.jsx, Dashboard.jsx    |
   | CDN: Tailwind, Chart.js          |
   | [Aprobar]  [Modificar]           |
   +----------------------------------+
4. Usuario aprueba -> Fase GENERATING
5. LLM genera los archivos uno por uno
6. Preview se actualiza en tiempo real
7. Si hay errores -> banner "Auto-fix?"
8. Usuario puede editar codigo manualmente
9. Cambios se auto-guardan a la DB
```

