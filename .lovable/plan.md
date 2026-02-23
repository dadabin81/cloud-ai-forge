

# Audit y Correcciones: 6 Fases del Plan Agents SDK + MCP

## Resumen del Audit

Tras investigar a fondo todo el codigo implementado en las 6 fases, he encontrado **7 problemas criticos** y **5 mejoras importantes** que necesitan correccion para que todo funcione correctamente en produccion.

---

## Problemas Criticos Encontrados

### 1. Backend NO desplegado - Datos legacy en produccion

**Severidad: CRITICA**

El worker desplegado en `binario-api.databin81.workers.dev` NO refleja los cambios del codigo. La respuesta actual de `/v1/providers/status` sigue mostrando:

```text
OpenAI: available: true
Anthropic: available: true
Google: available: true
OpenRouter: available: true
```

Pero el codigo ya solo devuelve Cloudflare. **El worker necesita ser re-desplegado** con `npx wrangler deploy` desde la carpeta `cloudflare/`.

**Impacto:** Los usuarios ven proveedores fantasma que no funcionan. Si seleccionan OpenAI en el Playground, el sistema falla silenciosamente.


### 2. Playground muestra selector de Providers innecesario

**Severidad: ALTA**

El Playground (lineas 536-555) muestra un `<Select>` para elegir proveedor, pero Binario es exclusivamente Cloudflare. El usuario puede seleccionar un proveedor que no existe y la lista de modelos queda vacia.

**Solucion:** Eliminar el selector de "Provider" del Config Sheet. Solo mostrar el selector de modelos (todos son Cloudflare).


### 3. Sincronizacion de mensajes rota entre Agent y Playground

**Severidad: ALTA**

El `useBinarioAgent` hook mantiene su propia lista de `messages`, pero el Playground TAMBIEN mantiene una lista local de `messages` (linea 112). Los mensajes se duplican o se pierden:

- Cuando el usuario envia via HTTP fallback, el hook agrega el mensaje a SU estado (linea 319) Y el Playground agrega el mensaje a SU estado (linea 295).
- El `streamingContent` se acumula en el hook, pero cuando completa, el hook agrega el mensaje final (linea 225), y ADEMAS el Playground potencialmente lo agrega otra vez.

**Solucion:** El Playground debe usar directamente `messages` del hook en lugar de mantener su propio estado. Sincronizar en una sola fuente de verdad.


### 4. Hook `sendHttpFallback` usa closure stale de `messages`

**Severidad: ALTA**

En `useBinarioAgent.ts` linea 341, el `sendHttpFallback` envia `messages` del closure, pero como el Playground tambien mantiene sus propios mensajes, el contexto enviado al backend puede estar desactualizado o incompleto.

**Solucion:** Unificar la fuente de mensajes. El hook debe ser la unica fuente de verdad.


### 5. STORAGE_KEYS.provider persiste un provider legacy

**Severidad: MEDIA**

Si un usuario tenia `openrouter` guardado en localStorage de sesiones anteriores, al cargar la pagina el `selectedProvider` sera `openrouter`, que no tiene modelos, y el chat queda inutilizable hasta que el usuario cambie manualmente.

**Solucion:** Forzar `cloudflare` como unico provider, ignorar valores legacy en localStorage.


### 6. El `sendHttp` del hook no incluye `systemPrompt`

**Severidad: MEDIA**

En `useBinarioAgent.ts` linea 334-348, el body del request HTTP no incluye el `systemPrompt`. El modelo responde sin contexto del sistema, produciendo respuestas genericas en vez de actuar como "Binario AI VibeCoding assistant".

**Solucion:** Agregar `system_prompt: agentState.systemPrompt` al body del POST.


### 7. `onComplete` del Playground no sincroniza el mensaje final

**Severidad: MEDIA**

El callback `onComplete` en la configuracion del hook (linea 158) esta vacio. Cuando el streaming termina, el ultimo mensaje del asistente debe agregarse al estado local del Playground, pero no hay logica para eso. El efecto en linea 315-319 tampoco hace nada util.

**Solucion:** En el `onComplete` callback, capturar el ultimo mensaje del hook y sincronizarlo.

---

## Mejoras Importantes

### A. Eliminar referencia a `useWebSocketChat` y `useHttpChat` en imports

Los archivos fueron eliminados correctamente, pero verificar que no hay imports rotos en ningun lado.

### B. El `useProviders` hook sigue siendo necesario para el selector de modelos

Aunque el provider selector se eliminara, el `useProviders` hook se usa para obtener la lista de modelos del backend. Mantenerlo pero simplificarlo.

### C. Modelos del Benchmark no coinciden con modelos del backend

El `ModelBenchmark.tsx` tiene 7 modelos hardcoded, pero el backend expone 16 modelos. Sincronizar para que el benchmark use los modelos del endpoint `/v1/models`.

### D. ConnectionStatus component - verificar compatibilidad con nuevo hook

El componente `ConnectionStatus` recibe `wsStatus` que es un cast directo del `agentStatus` del hook. Verificar que los valores coincidan.

### E. Playground no muestra el estado de neuronas del agente

El hook expone `agentState.neuronsUsed` y `agentState.neuronsLimit`, pero el Playground no los muestra. Agregar un indicador visual.

---

## Plan de Correccion

### Paso 1: Unificar fuente de mensajes en Playground

Eliminar el estado local `messages` del Playground y usar directamente `messages` del `useBinarioAgent` hook. Esto resuelve los problemas 3, 4 y 7.

**Archivo:** `src/pages/Playground.tsx`
- Eliminar `const [messages, setMessages] = useState<Message[]>([])` (linea 112)
- Usar `messages` del hook directamente
- Adaptar `handleSend`, `handleSendMessage`, `handleStop`, `clearChat` para no duplicar mensajes
- Mapear `AgentMessage` del hook al formato que espera `ChatMessage`

### Paso 2: Eliminar Provider Selector del Playground

**Archivo:** `src/pages/Playground.tsx`
- Eliminar el estado `selectedProvider` y su persistencia
- Eliminar el `<Select>` de Provider en el Config Sheet (lineas 542-555)
- Hardcodear `selectedProvider = 'cloudflare'`
- Simplificar `currentModels` para apuntar siempre a `models['cloudflare']`

### Paso 3: Corregir HTTP fallback - agregar systemPrompt

**Archivo:** `src/hooks/useBinarioAgent.ts`
- En `sendHttpFallback`, agregar `system_prompt` al body del POST
- Asegurar que el `messages` array usado en el request es el estado actual del hook, no un closure stale

### Paso 4: Limpiar localStorage legacy

**Archivo:** `src/pages/Playground.tsx`
- En el init de `selectedProvider`, forzar `'cloudflare'`
- Eliminar `STORAGE_KEYS.provider` ya que no hay opcion

### Paso 5: Sincronizar modelos del Benchmark con el backend

**Archivo:** `src/pages/ModelBenchmark.tsx`
- Usar el hook `useProviders` o fetch directo a `/v1/models` para obtener modelos dinamicamente
- Eliminar la lista hardcoded `MODELS`

### Paso 6: Agregar indicador de neuronas en el Playground

**Archivo:** `src/pages/Playground.tsx`
- Mostrar `agentState.neuronsUsed / agentState.neuronsLimit` en el top bar
- Indicador visual (progress bar o badge) del consumo de neuronas

### Paso 7: Nota sobre re-deploy del Worker

El worker de Cloudflare debe ser re-desplegado manualmente por el usuario ejecutando:
```text
cd cloudflare && npx wrangler deploy
```
Esto no se puede hacer desde Lovable, pero es critico para que los cambios del backend surtan efecto.

---

## Seccion Tecnica

### Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/Playground.tsx` | Eliminar estado local de mensajes, eliminar provider selector, agregar indicador de neuronas, limpiar localStorage legacy |
| `src/hooks/useBinarioAgent.ts` | Agregar systemPrompt al HTTP fallback, asegurar messages no-stale |
| `src/pages/ModelBenchmark.tsx` | Usar modelos dinamicos del backend en vez de hardcoded |

### Orden de implementacion

1. Corregir `useBinarioAgent.ts` (systemPrompt en HTTP)
2. Unificar mensajes en `Playground.tsx` (fuente unica de verdad)
3. Eliminar provider selector (solo Cloudflare)
4. Agregar indicador de neuronas
5. Sincronizar modelos del Benchmark

