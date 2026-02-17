

# Fase 6: VibeCoding Profesional Completo - Blueprint Avanzado, Sandbox Cloudflare, Templates y Gestion Full-Stack

## Resumen

Esta fase transforma el Playground de Binario en una plataforma VibeCoding profesional completa, integrando todas las capacidades de Cloudflare (AI, RAG, Sandbox, Workflows, D1, KV, Vectorize) con un sistema de blueprints mejorado que incluye previsualizacion de disenos, templates predefinidos, gestion completa de proyectos desde el chat, y desarrollo full-stack real en Cloudflare.

---

## Problema Actual

1. **Blueprint basico**: Solo genera JSON con lista de archivos, sin previsualizacion visual, sin templates, sin opciones de diseno
2. **Preview limitado**: El iframe usa CDN de React/Babel (no full-stack), no puede ejecutar Node.js, Express, ni bases de datos
3. **Sandbox no conectado**: El Durable Object `SandboxProject` en Cloudflare tiene templates (react-vite, node-express, python-flask, vanilla-js) pero NO esta conectado al frontend
4. **RAG desconectado del chat**: El sistema RAG (Vectorize) da error 500 en busqueda, y no se usa para mejorar generacion de codigo
5. **Proyectos no se guardan en Cloudflare**: Se guardan solo en la base de datos local, no en el Sandbox de Cloudflare para ejecucion real
6. **Sin templates visuales**: No hay galeria de templates para que el usuario elija un punto de partida

---

## Parte A: Sistema de Templates con Previsualizacion

### Nuevo archivo: `src/lib/templates.ts`

Catalogo de templates profesionales con metadata visual:

- **Cada template incluye**: nombre, descripcion, categoria (landing, dashboard, ecommerce, blog, api, portfolio), captura de pantalla (URL placeholder), stack tecnologico, archivos base, dependencias CDN
- **Categorias**: Landing Page, Dashboard, E-commerce, Blog, API Backend, Portfolio, SaaS, Admin Panel
- **Templates iniciales** (8-10):
  1. Landing Page SaaS (Tailwind + animaciones)
  2. Dashboard Analytics (Chart.js + grid)
  3. E-commerce Product Page (carrito + imagenes)
  4. Blog con Markdown (renderizado de posts)
  5. Portfolio Minimalista (galeria + contacto)
  6. Admin Panel (tablas + formularios)
  7. API REST + Frontend (Express + React)
  8. Chat App (WebSocket + UI)

### Nuevo componente: `src/components/TemplateGallery.tsx`

- Grid de tarjetas visuales con previsualizacion de cada template
- Filtro por categoria
- Al seleccionar un template, se pre-cargan los archivos base en el IDE
- Boton "Usar Template" que crea el proyecto con los archivos del template
- Boton "Personalizar con AI" que abre el chat con el template como contexto

---

## Parte B: Blueprint Avanzado con Diseno Visual

### Modificar: `src/lib/blueprintSystem.ts`

Ampliar el sistema de blueprint para incluir:

- **Opciones de diseno**: color scheme (light/dark/custom), tipografia, layout (sidebar, topnav, fullwidth), estilo (minimal, corporate, playful)
- **Secciones del proyecto**: hero, features, pricing, footer, sidebar, navbar -- el usuario puede seleccionar cuales incluir
- **CDN inteligente**: deteccion automatica de dependencias necesarias segun las secciones elegidas
- **Preview placeholder**: generar un wireframe ASCII o descripcion visual del layout

### Nuevo componente: `src/components/BlueprintDesigner.tsx`

Reemplaza al `BlueprintCard` basico con un designer interactivo:

- **Paso 1 - Template**: Seleccionar template base o "desde cero"
- **Paso 2 - Secciones**: Checkboxes para elegir secciones (Hero, Features, Pricing, Contact, etc.)
- **Paso 3 - Estilo**: Selector de color scheme, tipografia, layout
- **Paso 4 - Preview**: Wireframe visual del layout seleccionado (generado con divs y CSS)
- **Paso 5 - Confirmar**: Resumen del blueprint con boton "Generar"

### Nuevo componente: `src/components/WireframePreview.tsx`

- Genera un wireframe visual simplificado del layout del blueprint
- Muestra bloques de color representando cada seccion (header, hero, features, footer)
- Se actualiza en tiempo real al cambiar opciones en el designer
- Usa CSS Grid/Flexbox para representar layouts de sidebar, topnav, fullwidth

---

## Parte C: Conexion del Sandbox de Cloudflare al Frontend

### Nuevo archivo: `src/lib/sandboxService.ts`

Servicio que conecta el frontend con el Durable Object `SandboxProject`:

- `createSandboxProject(name, template, apiKey)`: Crea un proyecto en el Sandbox DO
- `getSandboxStatus(projectId, apiKey)`: Obtiene estado del sandbox
- `writeSandboxFiles(projectId, files, apiKey)`: Escribe archivos al sandbox
- `readSandboxFiles(projectId, apiKey)`: Lee archivos del sandbox
- `execCommand(projectId, command, apiKey)`: Ejecuta comandos en el sandbox
- `startDevServer(projectId, apiKey)`: Inicia servidor de desarrollo
- `stopDevServer(projectId, apiKey)`: Detiene servidor
- `getPreviewUrl(projectId, apiKey)`: Obtiene URL de preview

### Modificar: `src/hooks/usePlaygroundProject.ts`

- Agregar opcion de guardar proyectos tanto en la DB local como en el Sandbox de Cloudflare
- Nuevo campo `sandboxId` en `PlaygroundProject` para vincular con el DO
- Funcion `syncToSandbox`: sincroniza archivos locales al sandbox de Cloudflare
- Funcion `syncFromSandbox`: descarga archivos del sandbox al estado local

### Modificar: `src/pages/Playground.tsx`

- Agregar boton "Run in Cloud" que crea/actualiza el proyecto en el Sandbox
- Mostrar preview URL del sandbox cuando esta disponible
- Toggle entre "Local Preview" (iframe actual) y "Cloud Preview" (Sandbox URL)
- Indicador visual de sincronizacion con el sandbox

---

## Parte D: Chat como Centro de Desarrollo Full-Stack

### Modificar: `src/lib/chatActions.ts`

Agregar nuevas acciones que el AI puede ejecutar desde el chat:

- `sandbox_create`: Crear un proyecto en el sandbox desde el chat
- `sandbox_deploy`: Deployar el proyecto actual
- `sandbox_exec`: Ejecutar comandos (npm install, npm run build, etc.)
- `sandbox_start`: Iniciar servidor de desarrollo
- `sandbox_stop`: Detener servidor
- `template_select`: Seleccionar y aplicar un template
- `blueprint_generate`: Generar un blueprint con opciones de diseno
- `rag_learn`: Ingestar documentacion/contexto para mejorar generacion futura
- `project_rename`: Renombrar proyecto
- `project_export`: Exportar proyecto en formato elegido

### Modificar: `src/pages/Playground.tsx` (System Prompt)

Actualizar el system prompt `DEFAULT_SYSTEM_PROMPT` para incluir:

- Instrucciones sobre las acciones disponibles (sandbox, deploy, template, etc.)
- Contexto sobre las capacidades full-stack de Cloudflare
- Instrucciones para generar blueprints con opciones de diseno cuando se detecta un proyecto nuevo
- Instrucciones para usar RAG search cuando hay contexto relevante

---

## Parte E: Gestion Completa de Proyectos desde el Chat

### Nuevo componente: `src/components/ProjectDashboard.tsx`

Panel lateral expandible que muestra:

- **Proyecto actual**: nombre, estado, sandbox status, preview URL, ultimo deploy
- **Archivos**: lista con indicadores de modificado/sincronizado
- **Historial**: commits/cambios recientes del AI
- **Deploys**: historial de deploys con URLs
- **Metricas**: tokens usados, archivos generados, errores corregidos

### Modificar: `src/components/ProjectManager.tsx`

Mejorar para incluir:

- Busqueda/filtro de proyectos
- Ordenar por fecha, nombre, template
- Badge de estado del sandbox (ready, running, stopped)
- Boton "Duplicar" proyecto
- Boton "Sync to Cloud" para sincronizar con sandbox
- Preview thumbnail de cada proyecto (captura del ultimo preview)

---

## Parte F: Integracion RAG para Generacion Mejorada

### Modificar: `src/lib/chatActions.ts` (enrichWithRAG)

Mejorar la funcion `enrichWithRAG` para:

- Buscar en la base de conocimiento antes de generar codigo
- Incluir ejemplos de codigo relevantes como contexto
- Buscar patrones similares en proyectos anteriores del usuario
- Manejar el error 500 actual del RAG search con fallback graceful

### Nuevo: Ingestar documentacion de Cloudflare

- Al inicializar, pre-cargar documentacion de las APIs de Cloudflare (Workers, D1, KV, R2) en el indice vectorial
- Esto permite que el AI genere codigo que usa correctamente las APIs de Cloudflare
- El usuario puede agregar su propia documentacion via el chat ("aprende esta documentacion: [URL]")

---

## Detalles Tecnicos

### Archivos a crear

| Archivo | Proposito |
|---------|-----------|
| `src/lib/templates.ts` | Catalogo de templates con metadata |
| `src/lib/sandboxService.ts` | Cliente para Sandbox Durable Object |
| `src/components/TemplateGallery.tsx` | Galeria visual de templates |
| `src/components/BlueprintDesigner.tsx` | Designer interactivo de blueprints |
| `src/components/WireframePreview.tsx` | Preview visual de wireframes |
| `src/components/ProjectDashboard.tsx` | Panel de gestion del proyecto actual |

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/lib/blueprintSystem.ts` | Opciones de diseno, secciones, estilos |
| `src/lib/chatActions.ts` | Nuevas acciones: sandbox, template, deploy, rag |
| `src/hooks/usePlaygroundProject.ts` | Sync con sandbox, campo sandboxId |
| `src/pages/Playground.tsx` | TemplateGallery, BlueprintDesigner, ProjectDashboard, Cloud Preview toggle, system prompt mejorado |
| `src/components/ProjectManager.tsx` | Busqueda, filtro, duplicar, sync, thumbnails |
| `src/components/BlueprintCard.tsx` | Simplificar (la logica compleja va a BlueprintDesigner) |

### Migracion de base de datos

```text
ALTER TABLE playground_projects
  ADD COLUMN sandbox_id TEXT,
  ADD COLUMN sandbox_status TEXT DEFAULT 'none',
  ADD COLUMN preview_url TEXT,
  ADD COLUMN template_id TEXT,
  ADD COLUMN design_options JSONB DEFAULT '{}';
```

### No se necesitan nuevas dependencias npm

Todo se implementa con React, componentes UI existentes, y las APIs de Cloudflare ya disponibles.

### Flujo completo del usuario

```text
FLUJO 1: Proyecto nuevo con Template
  1. Usuario abre Playground
  2. Ve galeria de templates (8-10 opciones)
  3. Selecciona "Dashboard Analytics"
  4. Los archivos base se cargan en el IDE
  5. Preview se actualiza automaticamente
  6. Usuario pide cambios al AI via chat
  7. AI modifica archivos incrementalmente
  8. Click "Run in Cloud" -> se crea sandbox en CF
  9. Preview real via URL del sandbox
  10. Click "Deploy" -> Cloudflare Pages

FLUJO 2: Proyecto desde cero con Blueprint
  1. Usuario escribe "Crea un SaaS de gestion de tareas"
  2. AI genera blueprint con opciones de diseno
  3. Se muestra BlueprintDesigner:
     - Secciones: [x]Hero [x]Features [x]Pricing [ ]Blog
     - Estilo: Dark mode, Sans-serif, Sidebar layout
     - Template base: SaaS Landing
  4. Usuario ajusta opciones y aprueba
  5. WireframePreview muestra layout visual
  6. AI genera codigo completo basado en blueprint
  7. Preview en tiempo real
  8. Auto-fix de errores
  9. Export/Deploy

FLUJO 3: Gestion desde el chat
  1. "Renombra el proyecto a 'TaskFlow'"
  2. "Agrega una seccion de precios"
  3. "Deploya a Cloudflare"
  4. "Exporta como ZIP"
  5. "Busca en mi base de conocimiento sobre auth"
  6. "Instala Chart.js y agrega graficos"
  7. "Muestra el estado del sandbox"
```

### Arquitectura de la integracion Cloudflare

```text
+------------------+     +------------------+     +------------------+
|   Frontend       |     |  Cloudflare API  |     |  Cloudflare      |
|   (Playground)   | --> |  Worker Gateway  | --> |  Services        |
|                  |     |                  |     |                  |
|  TemplateGallery |     |  /v1/projects/*  |     |  Sandbox DO      |
|  BlueprintDesign |     |  /v1/chat/*      |     |  (Templates)     |
|  CodeEditor      |     |  /v1/rag/*       |     |  AI (Llama/etc)  |
|  CodePreview     |     |  /v1/workflows/* |     |  D1 Database     |
|  ProjectManager  |     |                  |     |  KV Store        |
|  DeployDialog    |     |                  |     |  Vectorize (RAG) |
+------------------+     +------------------+     +------------------+
         |                                                 |
         +--- DB local (playground_projects) ----+         |
         +--- Sandbox sync (sandboxService) -----+---------+
         +--- Deploy (deploy-cloudflare fn) -----+---------+
```

