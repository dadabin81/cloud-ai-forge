
# Fase 5: Deploy a Produccion + Mejoras Finales

## Resumen

Esta fase completa la transformacion del Playground anadiendo la capacidad de **exportar y desplegar proyectos**, junto con mejoras necesarias en la gestion de proyectos guardados y la experiencia de usuario.

---

## Parte A: Gestion de Proyectos Guardados en el Playground

Actualmente los proyectos se guardan en la base de datos pero no hay forma de **listar, abrir o eliminar** proyectos guardados desde el Playground.

### Nuevo componente: `src/components/ProjectManager.tsx`

- Panel lateral o dialog que muestra la lista de proyectos guardados del usuario
- Cada proyecto muestra: nombre, fecha de actualizacion, cantidad de archivos, template
- Acciones: Abrir (carga archivos en el IDE), Renombrar, Eliminar, Duplicar
- Boton "Nuevo Proyecto" que limpia el estado actual
- Se integra en la barra superior del Playground con un boton "Projects"

---

## Parte B: Export del Proyecto

### Nuevo archivo: `src/lib/projectExporter.ts`

Funciones para exportar el proyecto en diferentes formatos:

1. **Export como ZIP**: Empaqueta todos los archivos del proyecto en un archivo ZIP descargable. Se implementara usando la API nativa de Compression Streams o una libreria ligera (`fflate` - 8kb gzipped).
2. **Export como HTML unico**: Ya existe (`downloadProjectAsHtml`), se mejora para incluir todos los assets.
3. **Export como JSON**: Exporta el proyecto completo (files + metadata) como JSON para importar despues.
4. **Importar JSON**: Permite cargar un proyecto exportado previamente.

### Cambios en `src/components/PreviewToolbar.tsx`

- Reemplazar el boton "Download" simple con un dropdown menu con las opciones:
  - "Download as ZIP"
  - "Download as HTML"
  - "Export Project (JSON)"
  - "Import Project (JSON)"
  - Separador
  - "Deploy to Cloudflare" (con badge "Beta")

---

## Parte C: Deploy a Cloudflare Pages

### Nuevo archivo: `src/lib/deployService.ts`

Servicio que permite desplegar el proyecto generado a Cloudflare Pages usando la API directa:

1. El usuario hace click en "Deploy"
2. Se muestra un dialog pidiendo:
   - Nombre del proyecto (slug para la URL)
   - Opcionalmente: API Token de Cloudflare (se guarda encriptado en la DB)
   - Account ID de Cloudflare
3. El deploy se ejecuta via un backend function que:
   - Crea un proyecto en Cloudflare Pages (si no existe)
   - Sube los archivos como un "direct upload" deployment
   - Retorna la URL de produccion (ej: `mi-proyecto.pages.dev`)
4. Se muestra la URL final con un boton para abrir en nueva pestana

### Nuevo backend function: `supabase/functions/deploy-cloudflare/index.ts`

- Recibe: project files, project name, CF API token, CF account ID
- Crea proyecto en CF Pages via API (`POST /accounts/{id}/pages/projects`)
- Sube archivos via Direct Upload (`POST /accounts/{id}/pages/projects/{name}/deployments`)
- Retorna: deployment URL, status
- Se almacena el historial de deploys en una tabla nueva

### Nueva tabla: `deployments`

```text
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  project_id UUID REFERENCES playground_projects(id),
  provider TEXT DEFAULT 'cloudflare-pages',
  project_name TEXT NOT NULL,
  deployment_url TEXT,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Nuevo componente: `src/components/DeployDialog.tsx`

- Dialog modal con formulario para configurar el deploy
- Campos: Project Name (slug), Cloudflare API Token, Account ID
- Boton "Deploy" con progreso en tiempo real
- Una vez deployado, muestra la URL con badge verde "Live"
- Historial de deploys anteriores

---

## Parte D: Mejoras de UX en el Playground

### Cambios en `src/pages/Playground.tsx`

1. Integrar `ProjectManager` en la barra superior (boton "Projects" al lado de "Cloud")
2. Integrar `DeployDialog` accesible desde el toolbar
3. Agregar toggle de auto-correccion en la barra de configuracion (Config Sheet)
4. Mejorar el flujo de Blueprint: cuando el LLM responde con un blueprint, parsearlo automaticamente y mostrar la BlueprintCard (actualmente el parsing esta implementado pero no conectado al flujo de mensajes)

### Cambios en `src/components/CodeEditor.tsx`

- Agregar numeros de linea al editor
- Agregar indicador visual de "archivo modificado" (dot amarillo en la pestana)

---

## Parte E: Almacenamiento de Credenciales de Deploy

### Nueva tabla: `user_deploy_configs`

```text
CREATE TABLE user_deploy_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  provider TEXT DEFAULT 'cloudflare',
  account_id TEXT,
  encrypted_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Esto permite que el usuario configure sus credenciales de Cloudflare una sola vez y se reutilicen en futuros deploys.

---

## Archivos a crear

| Archivo | Proposito |
|---------|-----------|
| `src/components/ProjectManager.tsx` | Panel de gestion de proyectos guardados |
| `src/components/DeployDialog.tsx` | Dialog para configurar y ejecutar deploy |
| `src/lib/projectExporter.ts` | Funciones de export (ZIP, JSON, HTML) |
| `src/lib/deployService.ts` | Servicio de deploy a Cloudflare Pages |
| `supabase/functions/deploy-cloudflare/index.ts` | Backend function para deploy seguro |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Playground.tsx` | Integrar ProjectManager, DeployDialog, toggle auto-correct, conectar blueprint parsing |
| `src/components/PreviewToolbar.tsx` | Dropdown de export con multiples opciones |
| `src/components/CodeEditor.tsx` | Numeros de linea, indicador de modificado |

## Migracion de base de datos

- Crear tabla `deployments` con RLS para que cada usuario vea solo sus deploys
- Crear tabla `user_deploy_configs` con RLS para credenciales de deploy

## Dependencias nuevas

- `fflate` (8kb gzipped) - para generar archivos ZIP en el navegador sin servidor

## Flujo completo del usuario

```text
1. Usuario genera proyecto con AI en el Playground
2. Edita codigo manualmente si lo desea
3. Preview en tiempo real con consola de errores
4. Click "Export" -> elige formato (ZIP/HTML/JSON)
5. Click "Deploy" -> configura Cloudflare credentials (una sola vez)
6. Deploy se ejecuta via backend function
7. Recibe URL de produccion: mi-proyecto.pages.dev
8. Historial de deploys visible en el dialog
9. Puede re-deployar con un click tras hacer cambios
```
