
# Fix: Playground en Produccion - URLs, Polling y Generacion de Codigo

## Problemas Detectados

### 1. Todas las llamadas a la API de Cloud van a localhost:8787 y fallan
El archivo `src/config/api.ts` usa `import.meta.env.PROD` para decidir la URL. En el entorno de preview de Lovable, esto resulta en `http://localhost:8787`, que no existe. Por eso TODAS las funciones de Cloud (health checks, RAG, workflows, ResourceBadges) fallan constantemente.

Mientras tanto, `src/contexts/AuthContext.tsx` tiene la URL de produccion hardcodeada correctamente: `https://binario-api.databin81.workers.dev`. Por eso el chat SI funciona pero el Cloud Panel NO.

### 2. La IA no genera codigo con el formato multi-archivo
El usuario pidio "crea una app de restaurante" y la IA (Llama 3.1 8B) respondio con texto descriptivo generico en vez de codigo real con marcadores `// filename:`. Resultado: el File Explorer y el Preview quedan vacios. La IA basicamente ignoro las instrucciones del system prompt.

### 3. Health checks cada 30 segundos saturan la red
Los ResourceBadges y el CloudPanel hacen polling constante a `/health` que siempre falla, generando docenas de requests fallidos.

## Plan de Correccion

### Cambio 1: `src/config/api.ts` - Hardcodear la URL de produccion
- Cambiar `baseUrl` para que SIEMPRE use `https://binario-api.databin81.workers.dev` (igual que AuthContext)
- Eliminar la logica condicional `import.meta.env.PROD` que causa el problema
- Esto arregla instantaneamente: CloudPanel, ResourceBadges, RAG enrichment, y chat actions

### Cambio 2: `src/pages/Playground.tsx` - Mejorar el system prompt
- Simplificar el system prompt para que sea mas directo y efectivo con modelos pequenos como Llama 3.1 8B
- Agregar ejemplos concretos de output esperado (few-shot) dentro del prompt
- Eliminar las instrucciones de ACTION markers del prompt por defecto (el modelo las ignora y confunden)
- Enfocarse en: "Siempre genera codigo completo con el formato `// filename: ruta`"

### Cambio 3: `src/components/ResourceBadges.tsx` - Fetch una sola vez
- Eliminar el polling periodico de health check
- Hacer un solo fetch cuando el componente se monta y cuando el usuario cambia la API key
- Agregar un boton manual de "refresh" en vez de auto-polling

### Cambio 4: `src/lib/chatActions.ts` - Usar la URL correcta
- Este archivo ya usa `cloudflareApi.ts` que usa `API_CONFIG`, asi que se corrige automaticamente con el Cambio 1
- Agregar manejo de errores mas silencioso para `enrichWithRAG` cuando el backend no tiene documentos indexados

### Cambio 5: `src/components/CloudPanel.tsx` - Parar polling excesivo
- Reducir los auto-fetches que se disparan en cada tab change
- Cachear los resultados de health/models por al menos 60 segundos

## Detalles Tecnicos

### src/config/api.ts
```text
baseUrl: 'https://binario-api.databin81.workers.dev'
wsUrl: 'wss://binario-api.databin81.workers.dev'
```
Sin condicional - siempre apunta a produccion. Para desarrollo local, se puede usar una variable de entorno override.

### System Prompt optimizado (en Playground.tsx)
El prompt actual tiene demasiadas instrucciones ACTION que el modelo no entiende. Se simplificara a:
- Instrucciones claras de generacion de codigo
- Un ejemplo concreto de output con `// filename:`
- Sin ACTION markers (se pueden re-habilitar con modelos mas potentes)

### ResourceBadges.tsx
- Quitar el `setInterval` de health check
- Un solo `useEffect` con fetch al mount
- Boton de refresh manual

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/config/api.ts` | Hardcodear URL de produccion |
| `src/pages/Playground.tsx` | Simplificar system prompt, eliminar ACTION markers |
| `src/components/ResourceBadges.tsx` | Eliminar polling, fetch una vez |
| `src/components/CloudPanel.tsx` | Reducir auto-fetches, cachear resultados |
