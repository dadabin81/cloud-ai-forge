
# Rediseno del Chat del Playground - Layout Profesional

## Problema Actual

El chat esta aplastado en la parte inferior de la pantalla con solo ~35% de altura. Las respuestas de la IA son practicamente invisibles, y el layout vertical (IDE arriba, chat abajo) desperdicia espacio. El diseno actual se siente como un "panel secundario" en vez de la herramienta principal que es.

## Solucion: Chat como Panel Lateral Izquierdo

Cambiar el layout de **vertical** (IDE arriba / chat abajo) a **horizontal** (chat a la izquierda / IDE a la derecha), similar a como funcionan los IDEs profesionales con asistente AI integrado (como Cursor, Lovable, Windsurf).

```text
ANTES (actual):
+----------------------------------+
| File Explorer | Code | Preview   |  65%
+----------------------------------+
| Chat (aplastado)                 |  35%
+----------------------------------+

DESPUES (propuesto):
+----------+------------------------+
|          | File Exp | Code | Prev |
|  Chat    |          |      |      |
|  (30%)   |     IDE (70%)         |
|          |          |      |      |
+----------+------------------------+
```

## Cambios en Detalle

### Archivo: `src/pages/Playground.tsx`

**Layout principal:**
- Cambiar el `ResizablePanelGroup` principal de `direction="vertical"` a `direction="horizontal"`
- Chat pasa a ser el primer panel (izquierda) con `defaultSize={30}`
- IDE pasa a ser el segundo panel (derecha) con `defaultSize={70}`
- El IDE mantiene su layout interno de 3 columnas (File Explorer, Code, Preview)

**Diseno del Chat (panel izquierdo):**
- Fondo con gradiente sutil para diferenciarlo del IDE
- Header con el logo de Binario AI, indicador de modelo activo, y botones de accion
- Area de mensajes ocupa toda la altura disponible (ya no esta comprimida)
- Mensajes del usuario: burbuja alineada a la derecha con color primario
- Mensajes de la IA: burbuja alineada a la izquierda con avatar, fondo con borde gradiente sutil
- Los bloques de codigo dentro de los mensajes tendran syntax highlighting basico con fondo oscuro
- Input area fija en la parte inferior con textarea mas grande y boton de envio prominente

**Mensajes de la IA - Diseno Premium:**
- Avatar circular con icono de Binario y borde gradiente cyan-to-purple
- Nombre "Binario AI" junto al avatar con badge del modelo activo
- Contenido con tipografia clara, espaciado generoso
- Bloques de codigo con fondo diferenciado y boton de copiar
- Indicador de streaming con animacion de pulso mas elegante (tres puntos animados)
- Tokens/segundo mostrados de forma sutil durante el streaming

**Input area mejorada:**
- Textarea con placeholder mas descriptivo y borde con glow sutil al hacer focus
- Boton de envio mas grande con gradiente primario
- Barra inferior con: modelo activo (clickeable para cambiar), boton Clear, boton Copy
- Indicador visual cuando el chat esta procesando

**Estado vacio mejorado:**
- Logo grande de Binario con animacion sutil
- 3-4 sugerencias clickeables como chips (ej: "Crea un blog moderno", "Landing page SaaS", "Dashboard de analytics")
- Al hacer click en una sugerencia, se envia automaticamente como mensaje

### Detalles Tecnicos

- No se necesitan nuevas dependencias
- Se reutilizan los componentes UI existentes (Badge, Button, Textarea, Avatar)
- Se mantiene toda la logica de WebSocket, HTTP streaming, y procesamiento de acciones sin cambios
- Solo cambia la estructura JSX del return del componente y algunos estilos
- El panel de chat se puede colapsar con un boton toggle que lo reduce a una barra lateral estrecha
- Se eliminan los estados `chatOpen`/`setChatOpen` por un estado `chatCollapsed` que reduce el panel a ~5% en vez de ocultarlo
