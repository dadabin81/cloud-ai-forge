

# Plan: Integrar Cloudflare Agents SDK, MCP y Servicios Avanzados en Binario

## Resumen Ejecutivo

Migrar la arquitectura actual de Binario (Durable Objects manuales) al ecosistema oficial de Cloudflare: **Agents SDK** (`agents`, `@cloudflare/ai-chat`), **MCP** (`agents/mcp`), y aprovechar capacidades avanzadas como estado reactivo, scheduling proactivo, human-in-the-loop, y sandboxes. Todo sin salir de Cloudflare.

## Estado Actual vs. Objetivo

```text
ACTUAL                                    OBJETIVO
+---------------------------+             +----------------------------------+
| BinarioAgent              |             | BinarioAgent                     |
| (DurableObject manual)    |             | (extends AIChatAgent)            |
| - WebSocket manual        |  ------>    | - WebSocket nativo               |
| - storage.get/put manual  |             | - this.setState() reactivo       |
| - Sin scheduling          |             | - this.sql (SQLite embebido)     |
| - Sin tool calling        |             | - schedule() / scheduleEvery()   |
| - Sin MCP                 |             | - Tool calling nativo            |
+---------------------------+             | - ResumableStream                |
                                          +----------------------------------+
+---------------------------+
| useAgent hook (manual WS) |             +----------------------------------+
| useWebSocketChat          |  ------>    | useAgent (agents/react)          |
| useHttpChat               |             | useAgentChat (@cloudflare/ai-chat)|
+---------------------------+             +----------------------------------+

                                          +----------------------------------+
         (no existe)         ------>      | BinarioMCP                       |
                                          | (extends McpAgent)               |
                                          | - Expone tools via MCP           |
                                          | - Resources de proyecto          |
                                          | - Conecta con Claude/Cursor      |
                                          +----------------------------------+
```

---

## Fase 1: Migrar BinarioAgent al Agents SDK

### 1.1 Reescribir `cloudflare/src/agent.ts`

Reemplazar la clase `BinarioAgent` que actualmente extiende `DurableObject` manualmente por una que extienda `AIChatAgent` del paquete `@cloudflare/ai-chat`.

**Cambios clave:**
- Importar `AIChatAgent` de `@cloudflare/ai-chat`
- Eliminar todo el manejo manual de WebSocket (onopen, onmessage, onclose)
- Eliminar el manejo manual de `ctx.storage.get/put` para estado
- Usar `this.messages` (array de UIMessage gestionado automaticamente)
- Usar `this.setState()` para estado reactivo (modelo, system prompt, configuracion)
- Usar `this.sql` para consultas SQLite embebidas directas
- Implementar `onChatMessage()` como metodo principal de respuesta
- El streaming se maneja automaticamente via `ResumableStream`

**Estructura nueva:**
```text
export class BinarioAgent extends AIChatAgent<AgentEnv, AgentState> {
  // Estado reactivo sincronizado con clientes
  initialState = { model: '@cf/ibm-granite/granite-4.0-h-micro', ... }

  // Se llama automaticamente cuando el usuario envia un mensaje
  async onChatMessage(onFinish) {
    const result = await generateText({
      model: cloudflare(this.env.AI, this.state.model),
      messages: this.messages,
      tools: this.getActiveTools(),
    });
    return result.toDataStreamResponse();
  }

  // Estado reactivo - se sincroniza con todos los clientes
  onStateUpdate(state, source) { ... }

  // Scheduling proactivo
  async onAlarm() { ... }
}
```

### 1.2 Actualizar `cloudflare/wrangler.toml`

- Agregar dependencia del paquete `agents` y `@cloudflare/ai-chat`
- Mantener los bindings existentes (AI, DB, KV, VECTORIZE_INDEX)
- La clase `BinarioAgent` sigue siendo un Durable Object, pero ahora con las capacidades del SDK

### 1.3 Actualizar el routing en `cloudflare/src/index.ts`

- Las rutas `/v1/agent/` ahora se manejan de forma mas limpia
- El SDK maneja WebSocket upgrade automaticamente
- Mantener las rutas REST existentes para chat HTTP, RAG, workflows, etc.

---

## Fase 2: Implementar MCP Server Nativo

### 2.1 Crear `cloudflare/src/mcp.ts`

Nuevo archivo: Un servidor MCP que expone las capacidades de Binario como herramientas estandar.

**Tools MCP a exponer:**
- `binario_chat` - Enviar mensaje al modelo AI
- `binario_rag_search` - Buscar en documentos vectorizados
- `binario_rag_ingest` - Ingestar documentos
- `binario_embed` - Generar embeddings
- `binario_generate_image` - Generar imagenes con Flux Schnell
- `binario_transcribe` - Transcribir audio con Whisper
- `binario_project_create` - Crear proyecto sandbox
- `binario_project_files` - Leer/escribir archivos de proyecto

**Resources MCP:**
- `binario://models` - Lista de modelos disponibles
- `binario://usage` - Estado de neuronas consumidas
- `binario://project/{id}` - Archivos de un proyecto

**Estructura:**
```text
export class BinarioMCP extends McpAgent<AgentEnv> {
  server = new McpServer({ name: "Binario AI", version: "1.0.0" });

  async init() {
    // Tools
    this.server.tool("chat", { message: z.string(), model: z.string().optional() }, ...);
    this.server.tool("rag_search", { query: z.string(), topK: z.number().optional() }, ...);
    this.server.tool("generate_image", { prompt: z.string() }, ...);
    this.server.tool("transcribe", { audioUrl: z.string() }, ...);

    // Resources
    this.server.resource("models", "binario://models", ...);
    this.server.resource("usage", "binario://usage", ...);
  }
}
```

### 2.2 Actualizar `cloudflare/wrangler.toml`

Agregar el nuevo Durable Object `BinarioMCP` y su ruta SSE (`/mcp/sse`).

### 2.3 Actualizar `cloudflare/src/index.ts`

Agregar ruta `/mcp/` que enruta al MCP server via `McpAgent.serve()`.

---

## Fase 3: Human-in-the-Loop y Scheduling

### 3.1 Agregar tool calling con aprobacion al Agent

En el `BinarioAgent` migrado, implementar herramientas que requieran aprobacion del usuario antes de ejecutarse:

- `deploy_project` - Requiere aprobacion antes de deployar
- `delete_files` - Requiere aprobacion antes de borrar
- `modify_database` - Requiere aprobacion antes de cambios D1

El SDK maneja esto automaticamente con el flujo `addToolResult` del lado del cliente.

### 3.2 Implementar scheduling proactivo

Usar `schedule()` y `scheduleEvery()` del Agent para:

- **Recordatorios de uso**: Notificar cuando quedan pocas neuronas del dia
- **Tareas programadas**: Ejecutar workflows RAG de actualizacion periodica
- **Limpieza**: Limpiar conversaciones antiguas automaticamente

---

## Fase 4: Actualizar Frontend (SDK + Hooks)

### 4.1 Crear `src/hooks/useAgentChat.ts` (nuevo)

Hook que usa `useAgent` de `agents/react` y `useAgentChat` de `@cloudflare/ai-chat/react`:

```text
// Reemplaza useWebSocketChat + useHttpChat + useAgent
export function useBinarioAgent(options) {
  const agent = useAgent({
    agent: "BinarioAgent",
    name: options.conversationId,
  });

  const chat = useAgentChat({
    agent,
    // Mensajes, streaming, tools se manejan automaticamente
  });

  // Estado reactivo del agente (modelo, neuronas, etc.)
  // Se sincroniza automaticamente via WebSocket

  return { ...chat, state: agent.state };
}
```

### 4.2 Actualizar `src/pages/Playground.tsx`

- Reemplazar las importaciones de `useWebSocketChat` y `useHttpChat` por el nuevo `useBinarioAgent`
- Eliminar la logica manual de conexion/reconexion WebSocket
- Eliminar la logica manual de streaming SSE
- Usar el estado reactivo del agente para mostrar modelo actual, neuronas, etc.
- Simplificar significativamente el componente (~200 lineas menos)

### 4.3 Actualizar `src/hooks/useAgent.ts`

Simplificar para que sea un wrapper delgado sobre `useAgent` de `agents/react` en lugar del WebSocket manual actual.

---

## Fase 5: Servicios Gratuitos de Cloudflare en la Plataforma

### 5.1 Endpoint de Generacion de Imagenes

**Archivo**: `cloudflare/src/index.ts` (nuevo endpoint)

Agregar `/v1/images/generate` que usa `@cf/black-forest-labs/FLUX.1-schnell`:
- ~2,000 imagenes gratis por dia
- Exponer como feature premium sin coste adicional

### 5.2 Endpoint de Transcripcion de Audio

Agregar `/v1/audio/transcribe` que usa `@cf/openai/whisper`:
- ~243 minutos gratis por dia
- Exponer como feature de accesibilidad

### 5.3 Endpoint de Traduccion

Agregar `/v1/translate` que usa `@cf/meta/m2m100-1.2b`:
- Traduccion multiidioma gratis
- Integrar en el chat para respuestas automaticas en el idioma del usuario

### 5.4 Tools MCP para estos servicios

Todos estos servicios se exponen automaticamente como tools MCP, permitiendo que agentes externos (Claude, Cursor) los usen.

---

## Fase 6: Actualizar SDK npm (`packages/binario`)

### 6.1 Actualizar exports del paquete

Agregar nuevas exportaciones:
- `BinarioAgentBase` - Clase base para crear agentes con el SDK
- `BinarioMCPBase` - Clase base para crear MCP servers
- `useBinarioAgent` - Hook React para conectar con agentes
- `useBinarioMCP` - Hook React para conectar con MCP servers

### 6.2 Actualizar `packages/binario/src/cloudflare.ts`

Agregar helpers para crear agentes y MCP servers facilmente:
```text
import { createBinarioAgent } from 'binario/cloudflare';

export class MyAgent extends createBinarioAgent({
  model: '@cf/qwen/qwen3-30b-a3b-fp8',
  tools: [searchTool, calculatorTool],
  systemPrompt: 'You are a helpful assistant',
}) { }
```

---

## Seccion Tecnica Detallada

### Dependencias nuevas para `cloudflare/package.json`

```text
"agents": "^0.5.0"
"@cloudflare/ai-chat": "^0.1.0"
"@modelcontextprotocol/sdk": "^1.12.1"
"ai": "^4.3.0"
```

### Archivos a crear

| Archivo | Proposito |
|---------|-----------|
| `cloudflare/src/mcp.ts` | MCP Server (BinarioMCP) |
| `src/hooks/useBinarioAgent.ts` | Hook unificado para frontend |

### Archivos a modificar significativamente

| Archivo | Cambio |
|---------|--------|
| `cloudflare/src/agent.ts` | Reescribir: DurableObject -> AIChatAgent |
| `cloudflare/src/index.ts` | Agregar rutas MCP, imagenes, audio, traduccion |
| `cloudflare/wrangler.toml` | Agregar binding BinarioMCP |
| `cloudflare/package.json` | Agregar dependencias SDK |
| `src/pages/Playground.tsx` | Simplificar con useBinarioAgent |
| `src/hooks/useAgent.ts` | Wrapper sobre agents/react |
| `packages/binario/src/cloudflare.ts` | Agregar helpers Agent/MCP |
| `packages/binario/src/index.ts` | Exportar nuevos modulos |

### Archivos que pueden eliminarse (reemplazados)

| Archivo | Razon |
|---------|-------|
| `src/hooks/useWebSocketChat.ts` | Reemplazado por useBinarioAgent |
| `src/hooks/useHttpChat.ts` | Reemplazado por useBinarioAgent |

### Esquema de rutas final del Worker

```text
/health                    -> Health check
/v1/models                 -> Lista de modelos
/v1/providers/status       -> Estado del proveedor
/v1/auth/*                 -> Autenticacion
/v1/keys/*                 -> Gestion de API keys
/v1/chat/completions       -> Chat HTTP (mantener para SDK)
/v1/chat/stream            -> Chat SSE (mantener para SDK)
/v1/structured             -> Output estructurado
/v1/agent/*                -> BinarioAgent (ahora via Agents SDK)
/v1/rag/*                  -> RAG (Vectorize)
/v1/workflows/*            -> Workflows
/v1/images/generate        -> NUEVO: Flux Schnell
/v1/audio/transcribe       -> NUEVO: Whisper
/v1/translate              -> NUEVO: M2M100
/v1/sandbox/*              -> Sandbox projects
/mcp/sse                   -> NUEVO: MCP Server (SSE transport)
/v1/usage                  -> Uso de neuronas
/v1/account/*              -> Cuenta del usuario
```

### Orden de implementacion recomendado

1. Migrar `BinarioAgent` a `AIChatAgent` (base para todo)
2. Crear `BinarioMCP` (diferenciacion competitiva)
3. Agregar endpoints de imagenes/audio/traduccion
4. Actualizar frontend con `useBinarioAgent`
5. Actualizar SDK npm con exports nuevos
6. Limpiar codigo legacy (useWebSocketChat, useHttpChat)

