

## Plan: Eliminar código duplicado en `cloudflare/src/index.ts`

### Cambio único

**Archivo:** `cloudflare/src/index.ts` (líneas 883-895)

Eliminar las líneas 883-895 que contienen código huérfano (fragmento de ternario suelto y llamada duplicada a `env.AI.run`). El flujo correcto ya está en las líneas 878-882, y debe continuar directamente en la línea 897 (`let content = ...`).

**Antes (líneas 878-896):**
```typescript
    const response = await env.AI.run(cfModel as any, {
      messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 1024,
    });
          : msg                          // ← BASURA
      );                                 // ← BASURA
                                         // ← BASURA
      if (messages[0]?.role !== 'system') // ← BASURA
        ...                              // ← BASURA
      }                                  // ← BASURA
    }                                    // ← BASURA
                                         // ← BASURA
    const response = await env.AI.run(   // ← DUPLICADO
      ...                                // ← DUPLICADO
    });                                  // ← DUPLICADO

    let content = (response as any).response || '';
```

**Después:**
```typescript
    const response = await env.AI.run(cfModel as any, {
      messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 1024,
    });

    let content = (response as any).response || '';
```

### Después del cambio
El build (`npm run build`) debería pasar sin errores y el deploy a Cloudflare funcionará.

