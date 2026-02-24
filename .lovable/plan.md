

# Fix: Proyecto No Aparece en el IDE

## Problemas Identificados

### 1. El modelo genera texto descriptivo en lugar de codigo

Este es el problema principal. En los logs de red, la respuesta del modelo empieza con:

```
"Aquí te presento un ejemplo de cómo podría ser la estructura de la landing page..."
```

Esto es solo una descripcion textual. El modelo NO genera los marcadores `// filename:` ni bloques de codigo, asi que `useProjectSync` no tiene nada que parsear y no crea archivos.

**Solucion**: Reforzar el system prompt con instrucciones mas directas:
- Agregar "NUNCA describas lo que vas a hacer. Genera el codigo directamente."
- Agregar "Tu primera linea de respuesta SIEMPRE debe ser un marcador de archivo"
- Incluir un ejemplo completo de output esperado con multiples archivos

### 2. El buffer final no aplica el doble-unwrap SSE

Despues del while loop (lineas 406-418 de `useBinarioAgent.ts`), el codigo procesa el buffer restante pero NO aplica la logica de unwrap del SSE interno de Cloudflare Workers AI. Esto puede perder los ultimos tokens del stream.

**Solucion**: Aplicar la misma logica de unwrap en el procesamiento del buffer final.

### 3. Requests HTTP duplicados

Los logs de red muestran 2 POST identicos al mismo endpoint y timestamp. Esto puede ocurrir por React StrictMode o porque el componente se re-renderiza y dispara dos veces.

**Solucion**: Agregar un guard con un ref `isRequestInFlightRef` que evite enviar si ya hay un request activo.

---

## Cambios Tecnicos

### Archivo: `src/pages/Playground.tsx`

**Reforzar el system prompt (lineas 55-96)**

Agregar al principio del prompt:

```
## MANDATORY: DIRECT CODE OUTPUT
NEVER describe what you will build. NEVER list features as bullet points.
Your response MUST start with a `// filename:` marker followed by actual code.
Generate ALL files needed for a complete, working application.
```

Agregar despues de los RULES un ejemplo completo:

```
## EXAMPLE OUTPUT FORMAT (follow this exactly)
// filename: index.html
```html
<!DOCTYPE html>
<html>...</html>
```

// filename: src/App.jsx
```jsx
function App() { return (...); }
```
```

Incrementar `PROMPT_VERSION` de 4 a 5 para forzar la actualizacion en localStorage.

### Archivo: `src/hooks/useBinarioAgent.ts`

**Fix 1: Buffer final con unwrap (lineas 406-418)**

Aplicar la misma logica de doble-unwrap al buffer final:

```typescript
if (lineBuffer.startsWith('data: ')) {
  const data = lineBuffer.slice(6);
  if (data !== '[DONE]') {
    try {
      const parsed = JSON.parse(data);
      let token = parsed.choices?.[0]?.delta?.content || '';
      // Apply same unwrap logic
      if (typeof token === 'string' && token.startsWith('data: ')) {
        // ... same inner unwrap code
      }
      if (token) {
        streamingContentRef.current += token;
        setStreamingContent(streamingContentRef.current);
      }
    } catch { }
  }
}
```

**Fix 2: Guard contra requests duplicados**

Agregar `isRequestInFlightRef` al hook:

```typescript
const isRequestInFlightRef = useRef(false);
```

En `sendHttpFallback`, verificar antes de enviar:

```typescript
if (isRequestInFlightRef.current) return;
isRequestInFlightRef.current = true;
// ... request ...
// en finally: isRequestInFlightRef.current = false;
```

Y en `performHttpRequest`, agregar `isRequestInFlightRef.current = false` en el `finally`.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Playground.tsx` | Reforzar system prompt, subir PROMPT_VERSION a 5 |
| `src/hooks/useBinarioAgent.ts` | Unwrap en buffer final + guard de duplicados |

## Resultado esperado

- El modelo genera codigo directamente con marcadores `// filename:`
- `useProjectSync` detecta los archivos y los muestra en el explorador, editor y preview
- No se pierden tokens al final del stream
- No hay requests HTTP duplicados

