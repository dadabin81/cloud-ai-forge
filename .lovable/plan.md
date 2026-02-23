
# Separar "Probar Capacidades AI" del "Creador de Apps"

## Problema Detectado

El Playground mezcla dos experiencias completamente diferentes en una sola interfaz:

1. **Creador de Apps (VibeCoding)**: El chat genera codigo para construir aplicaciones web
2. **Capacidades AI**: El usuario espera probar directamente funciones como transcripcion, traduccion, generacion de imagenes

Cuando el usuario hace clic en "Audio Transcription", espera grabar y transcribir audio. En cambio, recibe codigo JSX que crea un componente de transcripcion. Esto genera confusion.

Ademas, el RAG Studio tiene su propio campo de API key separado, desconectado del sistema de autenticacion del Playground.

---

## Solucion: Dos Experiencias Claras

### Opcion elegida: Feature Cards como guias de VibeCoding + pagina separada "AI Playground" para probar capacidades

Las feature cards del Playground se re-enfocan en lo que realmente hacen (pedir al AI que construya apps), y se crea una nueva pagina `/ai-tools` donde el usuario puede probar las capacidades directamente.

---

## Cambios Tecnicos

### Paso 1: Corregir PlaygroundFeatureCards para reflejar que son templates de apps

**Archivo:** `src/components/PlaygroundFeatureCards.tsx`

- Cambiar los titulos y descripciones para que quede claro que son PROYECTOS a crear
- Ejemplo: "Audio Transcription" se convierte en "App de Transcripcion" con descripcion "Crea una app con Whisper"
- RAG y Benchmark siguen navegando a sus paginas dedicadas

Cambios especificos:
- "Chat & VibeCoding" queda igual (ya es correcto)
- "RAG Pipeline" queda como link a /rag-example (correcto)
- "Image Generation" se renombra a "App de Imagenes" con prompt mas claro
- "Audio Transcription" se renombra a "App de Audio" 
- "Translation" se renombra a "App de Traduccion"
- "Model Benchmark" queda como link a /benchmark (correcto)

### Paso 2: Conectar RAG Studio al sistema de auth existente

**Archivo:** `src/pages/RAGExample.tsx`

- Eliminar el campo manual de API key
- Usar el hook `useAuth()` para obtener `apiKey` y `isAuthenticated` automaticamente
- Mostrar mensaje "Inicia sesion" si no hay API key, en lugar de un input manual
- Esto unifica la experiencia: el usuario se autentica una vez y todo funciona

### Paso 3: Crear pagina "AI Tools" para probar capacidades directamente

**Archivo nuevo:** `src/pages/AITools.tsx`

Pagina simple con tabs para probar cada capacidad AI en vivo:
- **Chat**: Input de texto, respuesta del modelo (ya existe en Playground, aqui es version simplificada sin IDE)
- **Imagenes**: Prompt de texto, muestra la imagen generada por Flux
- **Audio**: Boton de grabar/subir audio, muestra la transcripcion de Whisper
- **Traduccion**: Input de texto + selector de idioma, muestra resultado de M2M100
- **Embeddings**: Input de texto, muestra el vector generado

Cada tab usa el API key del auth context (no pide API key manual).

### Paso 4: Actualizar navegacion

**Archivo:** `src/components/Navigation.tsx`

- Agregar "AI Tools" en la seccion "Build" como enlace a `/ai-tools`
- Descripcion: "Prueba las capacidades AI directamente"

### Paso 5: Agregar ruta

**Archivo:** `src/App.tsx`

- Agregar ruta `/ai-tools` apuntando al nuevo componente

### Paso 6: Actualizar PlaygroundFeatureCards con link a AI Tools

Agregar una septima card o un link visible que diga "Probar capacidades AI directamente" apuntando a `/ai-tools`

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/PlaygroundFeatureCards.tsx` | Renombrar cards para que reflejen "crear app con X", no "probar X" |
| `src/pages/RAGExample.tsx` | Reemplazar input manual de API key por `useAuth()` |
| `src/pages/AITools.tsx` | **NUEVO** - Pagina para probar capacidades AI directamente |
| `src/components/Navigation.tsx` | Agregar "AI Tools" en seccion Build |
| `src/App.tsx` | Agregar ruta `/ai-tools` |

## Archivos que NO se modifican

| Archivo | Razon |
|---------|-------|
| `src/pages/Playground.tsx` | La estructura IDE esta bien, solo cambian las cards (componente separado) |
| `src/pages/ModelBenchmark.tsx` | Funciona correctamente |
| `src/hooks/useBinarioAgent.ts` | Ya corregido en el paso anterior |

## Resultado esperado

- El usuario entiende que el Playground es para CREAR APPS
- El usuario tiene una pagina dedicada (/ai-tools) para PROBAR capacidades AI
- RAG Studio usa el mismo auth que todo lo demas (sin campo de API key manual)
- La navegacion guia claramente: "quiero construir" va al Playground, "quiero probar" va a AI Tools
