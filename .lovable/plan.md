
# Plan: Integrar Cloudflare Agents SDK, MCP y Servicios Avanzados en Binario

## Estado de Implementación

| Fase | Estado | Descripción |
|------|--------|-------------|
| Fase 1 | ✅ COMPLETADA | Migrar BinarioAgent al Agents SDK (AIChatAgent) |
| Fase 2 | ✅ COMPLETADA | MCP Server Nativo (BinarioMCP) |
| Fase 3 | ✅ COMPLETADA | Human-in-the-Loop y Scheduling (tools con aprobación) |
| Fase 4 | ✅ COMPLETADA | Frontend unificado (useBinarioAgent hook) |
| Fase 5 | ✅ COMPLETADA | Servicios gratuitos (imágenes, audio, traducción) |
| Fase 6 | ✅ COMPLETADA | Limpieza de código legacy y migración de Playground |

## Archivos Creados/Modificados

### Creados
- `cloudflare/src/mcp.ts` - MCP Server (BinarioMCP extends McpAgent)
- `src/hooks/useBinarioAgent.ts` - Hook unificado (reemplaza 3 hooks legacy)

### Modificados
- `cloudflare/src/agent.ts` - Reescrito: DurableObject → AIChatAgent con tools nativos
- `cloudflare/src/index.ts` - Rutas MCP + endpoints media (images, audio, translate)
- `cloudflare/wrangler.toml` - Bindings BINARIO_AGENT + BINARIO_MCP
- `cloudflare/package.json` - Deps: agents, @cloudflare/ai-chat, @modelcontextprotocol/sdk, ai
- `src/pages/Playground.tsx` - Migrado a useBinarioAgent (eliminó useWebSocketChat/useHttpChat)
- `src/hooks/index.ts` - Exports actualizados
- `packages/binario/src/cloudflare.ts` - Helper createBinarioAgentConfig
- `packages/binario/src/index.ts` - Exports actualizados

### Eliminados
- `src/hooks/useWebSocketChat.ts` - Reemplazado por useBinarioAgent
- `src/hooks/useHttpChat.ts` - Reemplazado por useBinarioAgent
- `src/hooks/useAgent.ts` - Reemplazado por useBinarioAgent

## Arquitectura Final

```text
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  useBinarioAgent() - Unified Hook                    │    │
│  │  • WebSocket (Agents SDK) + HTTP fallback           │    │
│  │  • Reactive state sync (model, neurons, features)   │    │
│  │  • Streaming with tok/s metrics                     │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Worker (Edge)                        │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  BinarioAgent     │  │  BinarioMCP      │                │
│  │  (AIChatAgent)    │  │  (McpAgent)      │                │
│  │  • onChatMessage  │  │  • chat tool     │                │
│  │  • setState()     │  │  • rag_search    │                │
│  │  • schedule()     │  │  • gen_image     │                │
│  │  • tools:         │  │  • transcribe    │                │
│  │    - gen_image    │  │  • translate     │                │
│  │    - transcribe   │  │  • resources     │                │
│  │    - rag_search   │  │                  │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                             │
│  Endpoints:                                                 │
│  /v1/agent/*          → BinarioAgent (WS + REST)           │
│  /v1/chat/*           → HTTP streaming                     │
│  /v1/images/generate  → Flux Schnell (free)                │
│  /v1/audio/transcribe → Whisper (free)                     │
│  /v1/translate        → M2M100 (free)                      │
│  /v1/rag/*            → Vectorize                          │
│  /mcp/sse             → MCP Server (SSE)                   │
└─────────────────────────────────────────────────────────────┘
```

## Próximos Pasos (Post-MVP)

- [ ] Integrar `agents/react` + `@cloudflare/ai-chat/react` nativos cuando el frontend pueda importar directamente
- [ ] Implementar `waitForApproval()` completo en tools sensibles
- [ ] Agregar MCP client para conectar con servers externos (GitHub, Slack)
- [ ] Dashboard de uso de neuronas con datos del scheduling
- [ ] Tests E2E para el flujo Agent → MCP → Media services
