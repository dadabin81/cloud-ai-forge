

# Plan Maestro: De 7/10 a 10/10 -- Nivel Senior Expert

## Resumen Ejecutivo

Este plan esta dividido en 6 fases incrementales. Cada fase se puede completar de forma independiente y aporta valor inmediato. El objetivo es cerrar todas las brechas identificadas en la auditoria previa: seguridad, testing, estabilidad del Playground, documentacion, observabilidad y pulido profesional.

---

## FASE 1: Seguridad y Robustez (Prioridad Critica)

**Por que importa:** Un producto que maneja API keys y datos de usuario sin seguridad solida no puede considerarse profesional.

### 1.1 Corregir RLS policies permisivas
- Las tablas `contact_messages` y `waitlist` tienen politicas INSERT con `WITH CHECK (true)` -- cualquiera puede insertar sin limite
- Agregar rate limiting a nivel de base de datos o validacion en edge functions
- Agregar validacion de longitud y formato a los campos antes de insertar

### 1.2 Corregir el deploy service roto
- `src/lib/deployService.ts` usa `supabase.auth.getUser()` que falla igual que los proyectos (mismo problema de auth dual)
- Migrar a la misma estrategia: edge function con validacion de token Cloudflare

### 1.3 Validacion de inputs en edge functions
- `manage-playground-project`: no valida longitud de `name`, tamano de `files`, ni caracteres peligrosos
- `deploy-cloudflare`: no sanitiza `projectName` antes de enviarlo a la API de Cloudflare
- Agregar validacion con Zod en todas las edge functions

### 1.4 Sanitizar CORS
- Ambas edge functions usan `Access-Control-Allow-Origin: *` -- demasiado permisivo
- Restringir a los dominios conocidos del proyecto

### Archivos afectados:
- `supabase/functions/manage-playground-project/index.ts`
- `supabase/functions/deploy-cloudflare/index.ts`
- `src/lib/deployService.ts`
- Nueva migracion SQL para politicas RLS

---

## FASE 2: Estabilidad del Playground (El Producto Core)

**Por que importa:** El Playground es la experiencia principal del usuario. Si falla, nada mas importa.

### 2.1 Manejo de errores robusto en el chat
- El `Playground.tsx` tiene 1127 lineas en un solo archivo -- dividirlo en hooks y componentes
- Extraer: `useWebSocketChat`, `useHttpChat`, `useProjectSync`, `useErrorCorrection`
- Mover la logica de envio HTTP (lineas 415-572) a un hook dedicado

### 2.2 Manejo de estado del proyecto
- Cuando el usuario recarga, los archivos del proyecto se pierden si no se guardo
- Agregar persistencia local con `localStorage` como fallback
- Agregar indicador visual claro de "guardado/no guardado"

### 2.3 Mejorar la preview con sandbox aislado
- Actualmente la preview usa un iframe con `srcdoc` -- vulnerable a XSS
- Implementar Content Security Policy en el iframe
- Agregar sandbox attributes: `allow-scripts allow-forms`

### 2.4 Auto-correccion de errores funcional
- El sistema de auto-correccion existe (`errorCorrection.ts`) pero esta deshabilitado (`autoCorrectEnabled` siempre es `false`)
- Activarlo con un toggle visible y un limite de 3 intentos ya implementado

### Archivos afectados:
- `src/pages/Playground.tsx` (refactorizar en multiples archivos)
- Nuevos: `src/hooks/useWebSocketChat.ts`, `src/hooks/useHttpChat.ts`, `src/hooks/useProjectSync.ts`
- `src/components/CodePreview.tsx`

---

## FASE 3: Testing Profesional

**Por que importa:** Sin tests, cada cambio puede romper algo. Un SDK serio necesita cobertura de tests.

### 3.1 Tests del SDK (packages/binario)
- Actualmente solo tiene tests triviales que verifican que `typeof method === 'function'`
- Agregar tests reales con mocks para:
  - `client.ts`: chat, stream, agent, error handling, rate limit retry
  - `schema.ts`: zodToJsonSchema con todos los tipos de Zod
  - `memory/buffer.ts`: add, getMessages, maxMessages, token trimming
  - `memory/vector.ts`: search, similarity
  - `agent.ts`: multi-step execution, tool calling, max iterations

### 3.2 Tests de edge functions
- Agregar tests para `manage-playground-project`:
  - Token invalido retorna 401
  - CRUD completo funcional
  - Validacion de inputs
- Agregar tests para `deploy-cloudflare`:
  - Auth check
  - Cloudflare API mocking

### 3.3 Tests de componentes React
- Tests para `usePlaygroundProject` hook
- Tests para `ChatMessage` rendering
- Tests para `CodeEditor` cambios de codigo

### Archivos nuevos:
- `packages/binario/src/client.test.ts`
- `packages/binario/src/memory/buffer.test.ts`
- `packages/binario/src/agent.test.ts`
- `supabase/functions/manage-playground-project/index.test.ts`
- `src/hooks/__tests__/usePlaygroundProject.test.ts`

---

## FASE 4: Observabilidad y Monitoring

**Por que importa:** En produccion, si no puedes ver que esta pasando, no puedes arreglar nada.

### 4.1 Dashboard de metricas en tiempo real
- Crear pagina `/dashboard/analytics` con:
  - Requests por hora/dia
  - Latencia promedio por modelo
  - Errores por tipo
  - Uso de neuronas Cloudflare
- Los datos ya estan en la tabla `usage` de D1, solo falta exponerlos

### 4.2 Logging estructurado en edge functions
- Agregar logs con formato JSON consistente
- Incluir: request_id, user_id, action, duration_ms, status
- Usar `console.log(JSON.stringify({...}))` para que aparezcan en los logs de Lovable Cloud

### 4.3 Health check endpoint
- Agregar ruta `/health` en el Cloudflare Worker que verifique:
  - Conexion a D1
  - Conexion a KV
  - Workers AI disponible
  - Latencia de cada servicio

### Archivos afectados:
- `supabase/functions/manage-playground-project/index.ts` (logging)
- Nuevo: `src/pages/Analytics.tsx`
- `cloudflare/src/index.ts` (health endpoint)

---

## FASE 5: Experiencia de Desarrollador (DX) del SDK

**Por que importa:** Si el SDK es dificil de usar, nadie lo adoptara. La DX es lo que diferencia un proyecto amateur de uno profesional.

### 5.1 Publicar SDK en npm
- El `packages/binario/package.json` ya tiene la configuracion de build (`tsup`)
- Falta: README actualizado con badges, CHANGELOG, version semantica
- Agregar GitHub Action para publicar automaticamente en npm al crear un tag

### 5.2 Documentacion interactiva (upgrade /docs)
- La pagina actual de Docs es estatica con code blocks
- Agregar seccion "Try it live" que conecte al Playground con ejemplos pre-cargados
- Agregar busqueda de documentacion
- Agregar seccion de API Reference generada desde los tipos TypeScript

### 5.3 CLI tool
- Comando `npx create-binario` que genere un proyecto starter
- Templates: chat-app, agent-with-tools, rag-pipeline
- Ya existe `generateProjectStructure()` en `generate-config.ts` -- aprovecharlo

### Archivos afectados:
- `packages/binario/package.json`
- `packages/binario/README.md`
- `src/pages/Docs.tsx`
- Nuevo: `.github/workflows/publish-npm.yml`

---

## FASE 6: Diferenciacion de Mercado

**Por que importa:** Sin algo unico, Binario es "otro SDK de AI mas". Estas features lo posicionan como la opcion profesional para edge computing.

### 6.1 Template Marketplace
- Los usuarios pueden guardar y compartir templates de proyectos
- Nueva tabla `public_templates` con: name, description, files, author, stars, category
- Pagina `/templates` con galeria filtrable
- Boton "Use this template" que carga los archivos en el Playground

### 6.2 Collaboration en tiempo real
- Usar Realtime de Lovable Cloud para sincronizar cambios entre usuarios
- Agregar `ALTER PUBLICATION supabase_realtime ADD TABLE playground_projects`
- Mostrar cursor/edicion de otros usuarios en el CodeEditor

### 6.3 AI Model Benchmarking
- Pagina `/benchmark` que compare modelos side-by-side
- El usuario envia un prompt y ve la respuesta de 2-3 modelos simultaneamente
- Muestra: latencia, tokens/s, calidad subjetiva, costo en neuronas
- Esto es algo que ningun competidor ofrece integrado en el IDE

---

## Seccion Tecnica: Orden de Implementacion

```text
Semana 1-2: FASE 1 (Seguridad)
  - Dia 1-2: RLS policies + validacion de inputs
  - Dia 3-4: Deploy service fix + CORS
  - Dia 5: Auditoria de seguridad final

Semana 3-4: FASE 2 (Estabilidad Playground)
  - Dia 1-3: Refactorizacion de Playground.tsx en hooks
  - Dia 4-5: Persistencia local + auto-save visual
  - Dia 6-7: Sandbox CSP + auto-correccion

Semana 5-6: FASE 3 (Testing)
  - Dia 1-3: Tests del SDK (client, schema, memory, agent)
  - Dia 4-5: Tests de edge functions
  - Dia 6-7: Tests de componentes React

Semana 7-8: FASE 4 (Observabilidad)
  - Dia 1-3: Dashboard de analytics
  - Dia 4-5: Logging estructurado
  - Dia 6: Health check

Semana 9-10: FASE 5 (DX del SDK)
  - Dia 1-2: Publicar en npm
  - Dia 3-5: Docs interactivos
  - Dia 6-7: CLI tool

Semana 11-12: FASE 6 (Diferenciacion)
  - Dia 1-3: Template marketplace
  - Dia 4-5: Collaboration
  - Dia 6-7: Model benchmarking
```

## Resultado Esperado

Al completar las 6 fases:
- **Seguridad**: Input validation, CORS restrictivo, RLS correctas, auth unificada
- **Estabilidad**: Playground robusto, auto-save, error recovery
- **Testing**: +50 tests cubriendo SDK, edge functions y componentes
- **Observabilidad**: Dashboard de metricas, logging estructurado, health checks
- **DX**: SDK publicado en npm, docs interactivos, CLI
- **Diferenciacion**: Templates compartidos, collaboration, model benchmarking

Esto posiciona a Binario como un producto de nivel **senior/expert (9-10/10)** que compite directamente con Vercel AI SDK y LangChain, pero con la ventaja unica de ser edge-native y tener un IDE integrado.

