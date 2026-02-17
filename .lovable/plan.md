

# Fase 7: Refactorizacion Profunda - Chat-First Architecture

## El Problema Real

El Playground actual tiene problemas fundamentales de arquitectura:

1. **La IA no tiene memoria**: Cada vez que genera codigo, reemplaza TODOS los archivos en vez de editar los existentes. El sistema incremental (`[EDIT_FILE]`) existe en el codigo pero la IA no lo usa correctamente porque el system prompt no es suficiente y la deteccion falla.

2. **Demasiados botones manuales**: `TemplateGallery`, `BlueprintDesigner`, `ProjectDashboard`, `DeployDialog`, `ProjectManager`, `CloudPanel`, `Config Sheet` -- todo esto deberia ser orquestado por la IA desde el chat, no expuesto como botones separados.

3. **BlueprintDesigner esta mal concebido**: Es un wizard manual de 4 pasos donde el usuario elige secciones y colores manualmente. En una plataforma real, el usuario describe lo que quiere en el chat y la IA automaticamente genera el blueprint, muestra una preview, y pregunta si quiere cambios.

4. **Nada funciona realmente**: El sandbox service apunta a endpoints que no existen, el RAG da error 500, los templates son archivos estaticos que no se renderizan bien.

---

## Solucion: Chat-First, Todo Orquestado en Background

### Principio fundamental
> El usuario solo interactua con el chat. Todo lo demas sucede automaticamente en background.

---

## Parte A: Corregir el Flujo de Generacion de Archivos

### Problema
Cuando la IA responde con codigo, el `useEffect` en linea 284-330 de `Playground.tsx` decide entre incremental (`[EDIT_FILE]`) y full regeneration (`// filename:`). Pero la IA casi nunca usa marcadores incrementales porque:
- El system prompt no es lo suficientemente claro
- `buildFileContextPrompt()` lista archivos pero no envia su contenido
- El modelo no tiene suficiente contexto para saber que editar

### Solucion
1. **Mejorar `buildFileContextPrompt()`** en `src/lib/incrementalParser.ts`: Enviar no solo la lista de archivos sino tambien el contenido completo (o un resumen) de cada archivo existente, para que la IA sepa exactamente que ya existe
2. **Mejorar el system prompt** para ser MUY explicito: "NUNCA regeneres archivos que no necesitan cambios. SIEMPRE usa [EDIT_FILE: path] para modificar archivos existentes."
3. **Mejorar `applyIncrementalActions()`**: Cuando la IA responde con `// filename:` markers Y ya existen archivos, hacer merge inteligente en vez de reemplazar todo -- solo actualizar los archivos que aparecen en la respuesta, mantener los demas

### Archivos a modificar
- `src/lib/incrementalParser.ts`: Mejorar `buildFileContextPrompt()` para incluir contenido de archivos
- `src/pages/Playground.tsx` lineas 284-330: Mejorar logica de deteccion para hacer merge cuando ya hay archivos existentes

---

## Parte B: Eliminar Componentes Manuales Innecesarios

### Eliminar o simplificar
- **`BlueprintDesigner.tsx`**: ELIMINAR completamente. El blueprint se genera automaticamente cuando la IA detecta que el usuario quiere un proyecto nuevo. La IA pregunta al usuario en el chat si quiere cambios.
- **`TemplateGallery.tsx`**: SIMPLIFICAR. En vez de un dialog separado, la IA sugiere templates relevantes directamente en el chat cuando el usuario pide un proyecto nuevo.
- **`WireframePreview.tsx`**: ELIMINAR. No aporta valor real, es solo boxes de colores.
- **`ProjectDashboard.tsx`**: ELIMINAR. La informacion del proyecto se muestra en la barra superior de forma compacta.

### Mantener pero mover al background
- **`ProjectManager.tsx`**: Mantener como dialog pero mas simple, sin botones de sync/cloud que no funcionan
- **`DeployDialog.tsx`**: Mantener, es funcional

---

## Parte C: System Prompt Profesional para Chat-First

### Reescribir `DEFAULT_SYSTEM_PROMPT`

El system prompt actual es generico. Debe ser preciso y profesional:

- Instrucciones claras sobre cuando crear archivos nuevos vs editar existentes
- Cuando el usuario describe un proyecto nuevo, la IA debe responder primero con una propuesta (nombre, descripcion, archivos a crear, stack) en formato legible -- NO un JSON oculto sino un mensaje claro
- La IA debe preguntar "Quieres que proceda?" antes de generar codigo
- Cuando ya existen archivos, SIEMPRE usar `[EDIT_FILE]` para los que cambian
- La IA debe sugerir mejoras proactivamente despues de generar
- Eliminar las instrucciones de `[ACTION:...]` que confunden -- esas acciones deben ejecutarse automaticamente, no como marcadores en el texto

---

## Parte D: Deteccion Inteligente de Intent desde el Chat

### Modificar `src/pages/Playground.tsx` (sendHttp)

Antes de enviar el mensaje a la IA, analizar el intent del usuario:

1. **Proyecto nuevo**: Detectar si pide crear algo desde cero. Si hay archivos existentes, preguntar si quiere crear un proyecto nuevo o modificar el actual.
2. **Modificacion**: Si hay archivos existentes y el usuario pide un cambio, incluir el contexto completo de los archivos.
3. **Template**: Si el usuario menciona un tipo de proyecto conocido (dashboard, landing, blog), pre-seleccionar el template mas adecuado y enviarlo como contexto adicional a la IA.
4. **Deploy**: Si el usuario dice "deploya" o "publica", abrir el DeployDialog automaticamente.
5. **Export**: Si dice "exporta" o "descarga", ejecutar la exportacion directamente.

Esto reemplaza el sistema de `[ACTION:...]` markers, que nunca funciono bien porque depende de que la IA genere el formato exacto.

---

## Parte E: Limpieza de la Barra Superior

### Estado actual (demasiados botones)
Templates | Blueprint Designer | Projects | Cloud | Config

### Estado propuesto (limpio y profesional)
[Nombre del proyecto] | Projects | Deploy | Config

- El nombre del proyecto es editable inline
- "Projects" abre el ProjectManager simplificado
- "Deploy" abre el DeployDialog
- "Config" mantiene API key, provider/model, system prompt
- Cloud/Templates/Blueprint se eliminan de la barra -- todo se maneja desde el chat

---

## Parte F: Auto-Save y Gestion de Proyectos Mejorada

### Modificar `src/hooks/usePlaygroundProject.ts`

1. **Auto-crear proyecto**: Cuando la IA genera codigo por primera vez, crear automaticamente un proyecto con nombre derivado de la descripcion del usuario (no "Project 02/17/2026")
2. **Auto-save inmediato**: Reducir el debounce de 2000ms a 500ms
3. **Eliminar campos de sandbox** que no funcionan: `sandbox_id`, `sandbox_status` -- estos se pueden usar en el futuro pero ahora solo anade complejidad sin funcionalidad

---

## Resumen de Cambios

### Archivos a ELIMINAR
| Archivo | Razon |
|---------|-------|
| `src/components/BlueprintDesigner.tsx` | Manual wizard innecesario, la IA lo hace desde el chat |
| `src/components/WireframePreview.tsx` | No aporta valor real |
| `src/components/ProjectDashboard.tsx` | Informacion se muestra en barra superior |

### Archivos a MODIFICAR
| Archivo | Cambio |
|---------|--------|
| `src/lib/incrementalParser.ts` | `buildFileContextPrompt()` incluye contenido de archivos, merge inteligente |
| `src/pages/Playground.tsx` | Eliminar imports de BlueprintDesigner/WireframePreview/TemplateGallery/ProjectDashboard, limpiar barra superior, mejorar system prompt, mejorar logica de merge de archivos, deteccion de intent |
| `src/lib/blueprintSystem.ts` | Simplificar: eliminar `buildBlueprintPrompt()` forzado, hacer que `detectBlueprintRequest()` sea mas inteligente y dispare una propuesta en lenguaje natural |
| `src/lib/chatActions.ts` | Eliminar acciones que no funcionan (sandbox_*), simplificar a las que realmente funcionan |
| `src/hooks/usePlaygroundProject.ts` | Auto-crear con nombre inteligente, reducir debounce |
| `src/components/TemplateGallery.tsx` | Convertir de dialog a funcion helper que la IA usa internamente |
| `src/lib/templates.ts` | Mantener pero agregar funcion `suggestTemplate(description)` que la IA puede usar |

### Ninguna dependencia nueva necesaria

### Sin migraciones de base de datos

---

## Flujo del Usuario (ANTES vs DESPUES)

```text
ANTES (confuso):
1. Usuario ve 6 botones en la barra
2. Abre Templates -> elige uno -> carga archivos
3. O abre Blueprint Designer -> 4 pasos manuales -> genera
4. Chat genera codigo -> REEMPLAZA todo lo anterior
5. Usuario no sabe si guardar, deployar, exportar
6. Botones de Cloud/Sandbox que no funcionan

DESPUES (profesional):
1. Usuario escribe en el chat: "Crea un dashboard de analytics"
2. IA responde: "Voy a crear un Dashboard Analytics con:
   - index.html (entrada principal)
   - styles.css (Tailwind dark mode)
   - App.jsx (componente principal con graficos)
   Uso: React + Chart.js + Tailwind
   Quieres que proceda?"
3. Usuario: "Si, adelante"
4. IA genera codigo -> archivos aparecen en el IDE -> preview en vivo
5. Proyecto se guarda automaticamente como "Dashboard Analytics"
6. Usuario: "Agrega una seccion de usuarios"
7. IA usa [EDIT_FILE: App.jsx] -> solo modifica lo necesario
8. Usuario: "Deployalo"
9. Se abre DeployDialog automaticamente
```
