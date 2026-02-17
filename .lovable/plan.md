

# Playground Profesional: IDE de Creacion de Apps con IA

## Resumen

Transformar el Playground actual de un simple chat con preview en un **mini-IDE profesional** donde la IA genera proyectos completos con multiples archivos, estructura de carpetas visible, editor de codigo, y preview en vivo. Todo usando el poder gratuito de Cloudflare Workers AI.

## Que se va a construir

```text
+------------------+------------------------+--------------------+
|  FILE EXPLORER   |     CODE EDITOR        |   LIVE PREVIEW     |
|                  |                        |                    |
|  > src/          | // App.jsx             |  [Rendered App]    |
|    App.jsx       | function App() {       |                    |
|    styles.css    |   return <div>...</div> |  [Desktop/Mobile]  |
|  > public/       | }                      |                    |
|    index.html    |                        |  [Download ZIP]    |
|                  |                        |                    |
+------------------+------------------------+--------------------+
|  CHAT - "Crea una landing page para una startup de IA"         |
+----------------------------------------------------------------+
```

## Cambios tecnicos detallados

### 1. Nuevo: `src/lib/projectGenerator.ts` - Motor de proyectos multi-archivo

Utilidad que parsea la respuesta de la IA y extrae multiples archivos con sus rutas:

- Detecta bloques de codigo con nombres de archivo en comentarios o headers (ej: `// src/App.jsx`, `<!-- index.html -->`)
- Funcion `parseProjectFiles(content)` que retorna un mapa `Record<string, { code: string, language: string }>`
- Funcion `buildProjectPreview(files)` que combina todos los archivos en un documento HTML ejecutable
- Funcion `generateFileTree(files)` que crea la estructura de arbol para el explorador
- Soporte para detectar patrones como: `**archivo: src/App.jsx**`, lineas con `// filename:`, headers markdown con rutas

### 2. Nuevo: `src/components/FileExplorer.tsx` - Panel de archivos tipo VS Code

Componente de arbol de archivos con iconos por tipo:

- Arbol colapsable con carpetas y archivos
- Iconos diferenciados: HTML (naranja), CSS (azul), JS/JSX (amarillo), JSON (verde), imagenes (purpura)
- Click en archivo selecciona y muestra su codigo en el editor
- Indicador visual del archivo activo
- Contador de archivos totales
- Animaciones suaves de expansion/colapso usando Radix Collapsible

### 3. Nuevo: `src/components/CodeEditor.tsx` - Visor de codigo con syntax highlighting

Panel de visualizacion de codigo con numeracion de lineas:

- Numeracion de lineas
- Coloreado basico por lenguaje (HTML tags, CSS properties, JS keywords) usando regex simple
- Nombre del archivo activo en la barra superior
- Boton para copiar el archivo actual
- Boton para copiar todo el proyecto
- Scroll independiente

### 4. Nuevo: `src/components/PreviewToolbar.tsx` - Barra de herramientas del preview

Controles profesionales para el preview:

- Botones de viewport: Desktop (1280px), Tablet (768px), Mobile (375px)
- Boton de pantalla completa
- Boton de refrescar
- Boton "Download Project" que genera un ZIP con todos los archivos (usando Blob API, sin dependencias externas)
- Indicador del tamano actual del viewport

### 5. Modificar: `src/components/CodePreview.tsx` - Preview mejorado

Mejorar el componente existente:

- Recibir `files: Record<string, {code, language}>` en vez de solo `content: string`
- Construir el preview combinando todos los archivos del proyecto
- Soporte para viewport responsivo (width configurable)
- Barra de URL simulada mostrando "localhost:3000"
- Fondo blanco por defecto para que el preview se vea limpio

### 6. Modificar: `src/pages/Playground.tsx` - Layout de IDE completo

Reestructurar el layout completo:

- **Layout principal**: Dividir en 3 columnas con `react-resizable-panels` (ya instalado):
  - Izquierda (20%): FileExplorer 
  - Centro (40%): CodeEditor
  - Derecha (40%): LivePreview con toolbar
- **Chat en la parte inferior**: Panel colapsable en la parte baja que contiene el chat actual
- **System prompt mejorado**: Prompt por defecto que instruye a la IA a generar proyectos con multiples archivos, usando el formato `// filename: ruta/archivo.ext`
- **Estado nuevo**: `projectFiles` (mapa de archivos), `activeFile` (archivo seleccionado), `viewport` (desktop/tablet/mobile)
- **Auto-deteccion**: Cuando la IA responde, parsear automaticamente los archivos y poblar el FileExplorer
- **Panel de config**: Mover configuracion de API key, provider, y modelo a un drawer/sheet lateral para maximizar espacio

### 7. Modificar: `src/lib/codeExtractor.ts` - Ampliar extraccion

Agregar soporte para el nuevo formato multi-archivo:

- Mantener compatibilidad con el formato actual de bloques simples
- Agregar deteccion de patrones de nombre de archivo
- Funcion `extractProjectFromMarkdown(content)` que detecta multiples archivos en una sola respuesta
- Fallback: si no se detectan nombres de archivo, usar el comportamiento actual (preview de bloque unico)

### 8. System prompt optimizado para generacion de proyectos

El prompt por defecto se actualizara para instruir a la IA:

```text
You are Binario AI, a professional web development assistant. When the user asks 
you to create an app, website, blog, or any web project:

1. Generate complete, production-ready code
2. Organize code into multiple files with clear paths
3. Use this format for each file:

// filename: src/App.jsx
[code here]

// filename: src/styles.css  
[code here]

// filename: index.html
[code here]

4. Always include: index.html, at least one CSS file, and JS/JSX files as needed
5. Use modern CSS (flexbox, grid, custom properties)
6. Make designs responsive and visually appealing
7. Include comments explaining key sections
```

## Flujo del usuario

```text
1. Usuario abre el Playground
   -> Ve interfaz tipo IDE con 3 paneles + chat abajo

2. Usuario escribe: "Crea un blog moderno sobre tecnologia"
   -> IA genera multiples archivos (index.html, styles.css, app.js, etc.)

3. Auto-deteccion de archivos
   -> FileExplorer se llena con la estructura del proyecto
   -> Preview muestra el resultado renderizado
   -> CodeEditor muestra el primer archivo

4. Usuario navega archivos
   -> Click en styles.css -> ve el CSS con syntax highlighting
   -> Click en app.js -> ve el JavaScript

5. Usuario ajusta viewport
   -> Click en "Mobile" -> preview se reduce a 375px
   -> Click en "Desktop" -> preview vuelve a 1280px

6. Usuario descarga
   -> Click en "Download" -> descarga ZIP con todos los archivos
```

## Monetizacion y valor profesional

- **Free tier**: Usa Cloudflare Workers AI (Llama 3) gratis, 10k neurons/dia
- **Diferenciador**: Ningun otro SDK ofrece un IDE playground gratuito que genera proyectos completos
- **Upsell natural**: Usuarios que necesitan mas generaciones o modelos premium -> plan Pro
- **Valor demostrable**: El Playground mismo demuestra la potencia del SDK, convirtiendo visitantes en usuarios

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `src/lib/projectGenerator.ts` | CREAR - Parser de proyectos multi-archivo |
| `src/components/FileExplorer.tsx` | CREAR - Arbol de archivos |
| `src/components/CodeEditor.tsx` | CREAR - Visor de codigo |
| `src/components/PreviewToolbar.tsx` | CREAR - Controles del preview |
| `src/components/CodePreview.tsx` | MODIFICAR - Soporte multi-archivo + viewport |
| `src/pages/Playground.tsx` | MODIFICAR - Layout IDE completo |
| `src/lib/codeExtractor.ts` | MODIFICAR - Extraccion multi-archivo |

No se requieren dependencias nuevas: se usa `react-resizable-panels` (ya instalado), Radix UI (ya instalado), y Blob API nativa para la descarga ZIP.

