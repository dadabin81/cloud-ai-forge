

# Limpiar el Playground: Solo VibeCoding

## Problema actual

El chat del Playground muestra 7 cards mezcladas:
- 3 cards que envian prompts al chat (correcto: VibeCoding)
- 4 cards que navegan FUERA del Playground (RAG, Benchmark, AI Tools) - esto confunde porque el usuario sale del IDE sin entender por que

El Playground debe ser exclusivamente el entorno de desarrollo de apps. Las otras herramientas ya tienen sus propias paginas dedicadas (`/ai-tools`, `/rag-example`, `/benchmark`).

## Solucion

### Paso 1: Simplificar PlaygroundFeatureCards - solo templates de apps

**Archivo:** `src/components/PlaygroundFeatureCards.tsx`

Eliminar TODAS las cards que navegan fuera (`href`). Dejar solo cards que generan apps dentro del IDE:

| Card actual | Accion | Destino |
|---|---|---|
| Chat & VibeCoding | prompt | QUEDA (template de blog) |
| RAG Studio | href /rag-example | SE ELIMINA |
| App de Imagenes | prompt | QUEDA (genera app de imagenes) |
| App de Audio | prompt | QUEDA (genera app de audio) |
| App de Traduccion | prompt | QUEDA (genera app de traduccion) |
| Model Benchmark | href /benchmark | SE ELIMINA |
| AI Tools | href /ai-tools | SE ELIMINA |

Se agregan 3 nuevos templates de apps para completar la grilla:

- **Dashboard Analytics** - "Crea un dashboard con graficas de ventas, usuarios activos y metricas clave usando Recharts"
- **E-Commerce** - "Crea una tienda online con catalogo de productos, carrito de compras y checkout"
- **Landing SaaS** - "Crea una landing page profesional para un producto SaaS con hero, features, pricing y CTA"

Resultado: 7 cards, todas generan apps dentro del IDE. Ninguna saca al usuario del Playground.

### Paso 2: Mejorar los suggestion chips del Playground

**Archivo:** `src/pages/Playground.tsx`

Los `suggestionChips` (lineas 383-388) se muestran debajo del input. Actualizar para que complementen las cards con mas ideas de apps:

```
"Chat app con WebSocket"
"Panel de administracion"  
"App de notas con Markdown"
"Portfolio con animaciones"
```

### Paso 3: Texto de bienvenida mas claro

**Archivo:** `src/pages/Playground.tsx` (lineas 641-644)

Cambiar de:
- "Elige una capacidad o describe tu proyecto"

A:
- "Elige un template o describe la app que quieres crear"

Esto refuerza que el Playground es SOLO para crear apps.

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/PlaygroundFeatureCards.tsx` | Eliminar cards con `href`, agregar 3 templates nuevos de apps |
| `src/pages/Playground.tsx` | Actualizar suggestion chips y texto de bienvenida |

## Archivos que NO se tocan

| Archivo | Razon |
|---|---|
| `src/pages/AITools.tsx` | Ya funciona como pagina independiente |
| `src/pages/RAGExample.tsx` | Ya funciona como pagina independiente |
| `src/components/Navigation.tsx` | Ya tiene links a todas las herramientas |

## Resultado esperado

- El Playground es 100% VibeCoding: cada card genera una app dentro del IDE
- No hay confusion: nada navega fuera del entorno de desarrollo
- Las herramientas (AI Tools, RAG, Benchmark) se acceden desde la navegacion principal, no desde el Playground
- Todo lo generado se guarda en el proyecto (ya funciona via `useProjectSync` + `usePlaygroundProject`)

