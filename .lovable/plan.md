

# Fix: Respuesta del Chat Muestra Datos SSE Crudos

## Problema Encontrado

El chat del Playground muestra texto como:
```
data: {"response":"¡","tool_calls":[],"p":"abdef"}
data: {"response":"Claro!","tool_calls":[],"p":"abdefghij"}
```

En lugar de mostrar simplemente: **"¡Claro! ..."**

## Causa Raiz

El backend de Cloudflare Workers devuelve un formato SSE **doblemente envuelto**:

```text
Capa exterior (OpenAI-compatible):
data: {"choices":[{"delta":{"content":"CONTENIDO_AQUI"}}]}

Pero CONTENIDO_AQUI es OTRA capa SSE de Cloudflare Workers AI:
data: {"response":"texto_real","tool_calls":[],"p":"hash"}
```

El parser actual en `useBinarioAgent.ts` (linea 356) solo extrae la capa exterior:
```typescript
const token = parsed.choices?.[0]?.delta?.content || '';
```

Esto devuelve `data: {"response":"texto_real",...}` como el "token", que se concatena directamente al chat.

## Solucion

Modificar el parser en `src/hooks/useBinarioAgent.ts` para detectar y desempaquetar la capa interior cuando el contenido viene en formato SSE de Cloudflare Workers AI.

### Cambio en `performHttpRequest` (lineas 354-358)

Antes:
```typescript
const parsed = JSON.parse(data);
const token = parsed.choices?.[0]?.delta?.content || '';
```

Despues:
```typescript
const parsed = JSON.parse(data);
let token = parsed.choices?.[0]?.delta?.content || '';

// Unwrap double-wrapped SSE from Cloudflare Workers AI
// The backend sometimes wraps the Workers AI SSE response inside an OpenAI-compatible SSE
if (typeof token === 'string' && token.startsWith('data: ')) {
  const innerLines = token.split('\n');
  const extractedTokens: string[] = [];
  for (const innerLine of innerLines) {
    if (innerLine.startsWith('data: ')) {
      const innerData = innerLine.slice(6).trim();
      if (innerData && innerData !== '[DONE]') {
        try {
          const innerParsed = JSON.parse(innerData);
          // Cloudflare Workers AI format: {"response":"text","tool_calls":[],"p":"hash"}
          if (innerParsed.response !== undefined) {
            extractedTokens.push(innerParsed.response);
          }
        } catch { /* skip malformed inner JSON */ }
      }
    }
  }
  if (extractedTokens.length > 0) {
    token = extractedTokens.join('');
  }
}
```

## Seccion Tecnica

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useBinarioAgent.ts` | Agregar logica de unwrapping del SSE doble en `performHttpRequest`, lineas ~354-358 |

### Por que ocurre el doble envoltorio

El worker en `cloudflare/src/index.ts` usa `streamText` de Cloudflare Workers AI y re-envuelve la respuesta en formato OpenAI-compatible. Pero el stream de Workers AI ya tiene su propio formato SSE (`data: {"response":"..."}`) que se inserta como valor de `content` en el wrapper exterior.

### Impacto

- El chat mostrara texto limpio en lugar de datos crudos JSON
- Los archivos generados por el AI se parsearan correctamente (los `// filename:` markers estaran visibles para `useProjectSync`)
- No se modifica ningun otro archivo
