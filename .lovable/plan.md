

# Fix: Proyecto Generado No Aparece en el IDE

## Problemas Encontrados

### Problema 1: Bug critico en el parser SSE - perdida de tokens

El parser SSE en `useBinarioAgent.ts` NO buferea lineas incompletas entre chunks del stream. Cuando un chunk del servidor se corta a mitad de una linea JSON, el `JSON.parse` falla silenciosamente y ese token se pierde. Esto corrompe el contenido acumulado, rompiendo los marcadores de archivo (`**filename.ext**\n\`\`\``) que `useProjectSync` necesita para extraer los archivos del proyecto.

**Codigo actual (lineas 343-394):**
```text
const chunk = decoder.decode(value, { stream: true });
const lines = chunk.split('\n');
for (const line of lines) {
  if (line.startsWith('data: ')) {
    const data = line.slice(6);
    try {
      const parsed = JSON.parse(data); // FALLA si la linea esta cortada
      ...
    } catch { /* token perdido silenciosamente */ }
  }
}
```

**Solucion:** Agregar un buffer que acumule texto entre chunks y solo procese lineas completas (separadas por `\n`). La ultima linea incompleta se guarda para el siguiente chunk.

### Problema 2: Race condition en sendHttpFallback

La funcion `sendHttpFallback` usa `queueMicrotask` dentro del callback de `setMessages` para disparar `performHttpRequest`. Esto es fragil y puede causar requests duplicados (confirmado en los network logs: dos POST identicos al mismo timestamp).

**Solucion:** Mover la llamada a `performHttpRequest` fuera del callback de `setMessages` usando un ref para los mensajes.

### Problema 3: Suggestion chips definidos pero nunca renderizados

Los `suggestionChips` (linea 383-388 de Playground.tsx) estan definidos como array pero NO se renderizan en el JSX. Solo se usan via `handleSuggestionClick` que se pasa a los feature cards. Deberian mostrarse como chips debajo del input del chat.

---

## Cambios Tecnicos

### Archivo: `src/hooks/useBinarioAgent.ts`

**Cambio 1: Buffering SSE correcto**

En `performHttpRequest` (lineas ~340-395), agregar un buffer de lineas:

```typescript
// ANTES del while loop
let lineBuffer = '';

// DENTRO del while loop
const chunk = decoder.decode(value, { stream: true });
lineBuffer += chunk;
const lines = lineBuffer.split('\n');
lineBuffer = lines.pop() || ''; // guardar linea incompleta

for (const line of lines) {
  if (line.startsWith('data: ')) {
    // ... (resto del parsing igual)
  }
}
```

Despues del while loop, procesar el buffer restante si contiene datos.

**Cambio 2: Refactorizar sendHttpFallback**

Reemplazar el patron `queueMicrotask` con un flujo mas directo:

```typescript
const sendHttpFallback = useCallback(async (content: string) => {
  if (!apiKey) { onError?.(new Error('API key required')); return; }

  const userMessage = { id: `msg-${Date.now()}`, role: 'user', content, createdAt: new Date() };
  
  // Primero obtener mensajes actuales y agregar el nuevo
  const allMessages = [...messagesRef.current, userMessage];
  
  setMessages(allMessages);
  setIsLoading(true);
  streamingContentRef.current = '';
  setStreamingContent('');
  
  const controller = new AbortController();
  abortControllerRef.current = controller;
  
  // Ejecutar request directamente, no dentro de setMessages
  await performHttpRequest(allMessages, controller);
}, [apiKey, onError, performHttpRequest]);
```

Esto requiere agregar un `messagesRef` que siempre apunte al estado actual de `messages`.

### Archivo: `src/pages/Playground.tsx`

**Cambio 3: Renderizar suggestion chips**

Agregar los chips debajo del input del chat (despues de linea ~761):

```typescript
{messages.length === 0 && !isStreamingOrLoading && (
  <div className="flex flex-wrap gap-1.5 mt-1.5">
    {suggestionChips.map((chip) => (
      <button
        key={chip}
        onClick={() => handleSuggestionClick(chip)}
        className="text-[11px] px-2.5 py-1 rounded-full border border-border/50 
                   text-muted-foreground hover:text-foreground hover:border-primary/40 
                   transition-colors"
      >
        {chip}
      </button>
    ))}
  </div>
)}
```

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useBinarioAgent.ts` | Agregar buffering SSE + refactorizar sendHttpFallback |
| `src/pages/Playground.tsx` | Renderizar suggestion chips debajo del input |

## Resultado esperado

- Los tokens del stream NUNCA se pierden por cortes de chunk
- Los archivos generados se parsean correctamente y aparecen en el file explorer, code editor y preview
- No hay requests HTTP duplicados
- Los suggestion chips aparecen como ideas rapidas debajo del input

