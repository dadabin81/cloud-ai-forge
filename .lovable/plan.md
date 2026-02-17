
# Preview en Vivo del Codigo Generado por IA en el Playground

## Que se va a construir

Una funcionalidad que detecta bloques de codigo en las respuestas del chat de IA y los renderiza visualmente en un panel de preview usando un iframe sandboxed. Cuando chateas con la IA y le pides "crea un blog", "haz una landing page", etc., veras el resultado renderizado en tiempo real junto al chat.

## Como funciona

1. **Deteccion automatica de codigo**: Cuando la IA responde con bloques de codigo (HTML, CSS, JS, React/JSX), el sistema los detecta automaticamente usando regex para extraer bloques entre triple backticks.

2. **Panel de Preview**: Se agrega una tercera pestana "Preview" junto a "Chat" y "Code" en el Playground. Al detectar codigo renderizable, se muestra un iframe con el resultado visual.

3. **Iframe Sandboxed**: El codigo se ejecuta dentro de un iframe con `sandbox="allow-scripts"` para seguridad. Se construye un documento HTML completo inyectando el codigo detectado.

4. **Soporte de multiples formatos**:
   - HTML puro: Se renderiza directamente
   - HTML + CSS + JS: Se combinan en un documento completo
   - React/JSX: Se transpila usando un runtime ligero (Babel standalone via CDN) dentro del iframe

## Cambios tecnicos

### 1. Nuevo componente: `src/components/CodePreview.tsx`
- Recibe el contenido de los mensajes del chat
- Extrae bloques de codigo con regex (busca ```html, ```jsx, ```css, ```javascript)
- Construye un documento HTML completo combinando los bloques encontrados
- Renderiza en un iframe con `srcdoc`
- Incluye boton para abrir en pantalla completa y copiar codigo
- Para JSX/React: inyecta React + ReactDOM + Babel standalone desde CDN para transpilacion en el navegador

### 2. Modificar: `src/pages/Playground.tsx`
- Agregar tercera pestana "Preview" con icono Eye al TabsList existente
- Agregar estado `previewContent` que se actualiza cuando llega un mensaje del asistente con codigo
- El TabsContent de "Preview" renderiza el componente `CodePreview`
- Auto-switch a la pestana Preview cuando se detecta codigo renderizable
- Cambiar el grid layout de `lg:grid-cols-3` a `lg:grid-cols-2` cuando el preview esta activo (panel completo)

### 3. Utilidad: `src/lib/codeExtractor.ts`
- Funcion `extractCodeBlocks(content)` que parsea markdown y extrae bloques de codigo con su lenguaje
- Funcion `buildPreviewDocument(blocks)` que combina bloques en un HTML valido
- Funcion `isRenderableCode(blocks)` que determina si el codigo puede previsualizarse
- Soporte para detectar HTML, CSS, JS, JSX, y combinaciones

## Flujo del usuario

```text
Usuario escribe: "Crea una landing page bonita"
    |
    v
IA responde con bloques de codigo HTML/CSS/JS
    |
    v
Sistema detecta codigo renderizable automaticamente
    |
    v
Pestana "Preview" se activa con indicador visual
    |
    v
Usuario hace clic en "Preview" y ve la pagina renderizada
    |
    v
Puede abrir en pantalla completa o copiar el codigo
```

## Seguridad

- El iframe usa `sandbox="allow-scripts"` sin `allow-same-origin` para aislar completamente el codigo generado
- No hay acceso al DOM padre ni a cookies/storage del sitio principal
- Los scripts CDN (React, Babel) se cargan dentro del sandbox

## Limitaciones conocidas

- El codigo React/JSX requiere conexion a internet para cargar Babel desde CDN
- No soporta imports de npm (solo codigo autocontenido)
- El preview se regenera completo cada vez (no hay hot reload)
