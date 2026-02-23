

# Plan: Optimizar Binario para usar SOLO Cloudflare Workers AI

## Objetivo
Actualizar la plataforma para funcionar exclusivamente con la tecnologia de Cloudflare, sin depender de OpenRouter, OpenAI, Anthropic ni Google como proveedores externos. Maximizar el valor del tier gratuito y ofrecer precios competitivos en el tier de pago.

## Problema actual
1. Los costes de neuronas en el codigo estan desactualizados vs. los precios oficiales de Cloudflare
2. Faltan 6+ modelos nuevos (GPT-OSS, Gemma 3, GLM Flash, Llama 4 Scout)
3. El codigo tiene fallbacks a OpenRouter/OpenAI/Anthropic que deberian eliminarse
4. No se comunica al usuario de forma clara la realidad del tier gratuito (~500-1000 tokens/dia)

## Lo que Cloudflare ofrece GRATIS (por dia)

| Servicio | Cuota gratuita |
|----------|---------------|
| Workers AI (neuronas) | 10,000 neuronas |
| D1 (base de datos) | 5GB almacenamiento, 5M filas leidas |
| KV (cache) | 100,000 lecturas |
| R2 (archivos) | 10GB almacenamiento |
| Workers (requests) | 100,000 invocaciones |
| Vectorize (RAG) | 5M vectores almacenados |
| Flux Schnell (imagenes) | ~2,000 imagenes |
| Whisper (audio) | ~243 minutos transcripcion |
| Embeddings bge-m3 | ~9.3M tokens |

## Tokens de texto gratis por dia (realidad)

| Modelo | Output gratis/dia | Uso ideal |
|--------|-------------------|-----------|
| IBM Granite 4.0 Micro | ~985 tokens | Clasificacion, tareas simples |
| Mistral 7B | ~578 tokens | Codigo, respuestas cortas |
| Llama 3.2 1B | ~548 tokens | Chat rapido |
| GPT-OSS 20B | ~367 tokens | Razonamiento medio |
| Qwen3-30B-A3B | ~328 tokens | Mejor calidad/coste |
| Llama 3.1 8B fast | ~287 tokens | General |
| GPT-OSS 120B | ~147 tokens | Razonamiento complejo |
| Llama 3.3 70B | ~49 tokens | Mejor calidad (casi inutil gratis) |

## Estrategia de costes para el tier de pago

A $0.011 por 1,000 neuronas, un usuario que gaste $1/mes obtiene:

| Modelo | Tokens output con $1/mes |
|--------|--------------------------|
| Qwen3-30B-A3B | ~2.98M tokens |
| GPT-OSS 20B | ~3.33M tokens |
| Llama 3.1 8B fast | ~2.61M tokens |
| Llama 3.3 70B | ~444K tokens |

Esto es extremadamente barato comparado con OpenAI/Anthropic.

---

## Cambios a implementar

### Paso 1: Actualizar catalogo de modelos y precios

**Archivo**: `packages/binario/src/providers/cloudflare.ts`
- Agregar modelos nuevos: `gpt-oss-120b`, `gpt-oss-20b`, `gemma-3-12b`, `glm-4.7-flash`, `llama-4-scout`
- Corregir TODOS los `NEURON_COSTS` con los valores oficiales actuales de Cloudflare
- Agregar categorias: "Mas eficiente", "Mejor calidad", "Mejor para codigo", "Razonamiento"

### Paso 2: Actualizar el Worker backend

**Archivo**: `cloudflare/src/index.ts`
- Eliminar todas las referencias a `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`
- Eliminar las funciones `handleExternalProviderChat`, `handleChatWithOpenRouter`
- Simplificar el routing: todo va por `env.AI.run()`
- Actualizar `MODEL_ROUTING` con los modelos mas eficientes por tier
- Actualizar el endpoint `/v1/models` para mostrar precios reales y categorias

### Paso 3: Implementar routing inteligente por coste

**Archivo**: `cloudflare/src/index.ts` (nuevo modulo de routing)
- Tier gratis: Auto-seleccionar el modelo mas eficiente (`Granite Micro` o `Qwen3-30B-A3B`)
- Tier pro: Permitir cualquier modelo, sugerir el optimo segun la tarea
- Agregar header `X-Neurons-Used` y `X-Neurons-Remaining` en cada respuesta
- Implementar "smart fallback" dentro de Cloudflare: si un modelo grande falla por limites, bajar a uno mas pequeno automaticamente

### Paso 4: Actualizar la UI de modelos

**Archivos**: `src/pages/ModelBenchmark.tsx`, `src/components/CloudPanel.tsx`
- Mostrar precios reales en neuronas y dolares por 1M tokens
- Agregar indicador visual de "eficiencia" (tokens por neuron)
- Mostrar el medidor de neuronas restantes en el dia
- Eliminar referencias a proveedores externos en toda la UI

### Paso 5: Maximizar servicios gratuitos de Cloudflare

**Archivos**: Multiples
- Aprovechar que embeddings (`bge-m3`) son practicamente gratis (~9.3M tokens/dia)
- Aprovechar generacion de imagenes con Flux Schnell (~2,000 imagenes gratis/dia)
- Aprovechar Whisper para transcripcion de audio (~243 min gratis/dia)
- Exponer estos servicios como features premium de la plataforma sin coste adicional

### Paso 6: Actualizar la pagina de precios

**Archivo**: `src/pages/Pricing.tsx`
- Plan Free: ~500-1000 tokens texto/dia + imagenes ilimitadas + audio + embeddings + RAG
- Plan Pro ($5/mes): Workers Paid + ~90K neuronas/mes = millones de tokens
- Plan Enterprise: Sin limites, soporte dedicado
- Ser TRANSPARENTE sobre los limites reales del tier gratuito

---

## Seccion tecnica

### Modelos a agregar al catalogo

```text
'gpt-oss-120b':  '@cf/openai/gpt-oss-120b'         // 31,818 in / 68,182 out neurons per M
'gpt-oss-20b':   '@cf/openai/gpt-oss-20b'           // 18,182 in / 27,273 out neurons per M
'gemma-3-12b':   '@cf/google/gemma-3-12b-it'         // 31,371 in / 50,560 out neurons per M
'glm-4.7-flash': '@cf/zai-org/glm-4.7-flash'        // 5,500 in / 36,400 out neurons per M
'granite-micro':  '@cf/ibm-granite/granite-4.0-h-micro' // 1,542 in / 10,158 out neurons per M
```

### NEURON_COSTS corregidos (valores oficiales Cloudflare)

```text
'@cf/meta/llama-3.2-1b-instruct':                { input: 2457,  output: 18252  }
'@cf/meta/llama-3.2-3b-instruct':                { input: 4625,  output: 30475  }
'@cf/meta/llama-3.1-8b-instruct-fp8-fast':       { input: 4119,  output: 34868  }
'@cf/meta/llama-3.2-11b-vision-instruct':        { input: 4410,  output: 61493  }
'@cf/mistralai/mistral-small-3.1-24b-instruct':  { input: 31876, output: 50488  }
'@cf/qwen/qwen3-30b-a3b-fp8':                    { input: 4625,  output: 30475  }
'@cf/meta/llama-3.3-70b-instruct-fp8-fast':      { input: 26668, output: 204805 }
'@cf/meta/llama-4-scout-17b-16e-instruct':       { input: 24545, output: 77273  }
'@cf/deepseek-ai/deepseek-r1-distill-qwen-32b':  { input: 45170, output: 443756 }
'@cf/qwen/qwq-32b':                              { input: 60000, output: 90909  }
'@cf/openai/gpt-oss-120b':                       { input: 31818, output: 68182  }
'@cf/openai/gpt-oss-20b':                        { input: 18182, output: 27273  }
'@cf/google/gemma-3-12b-it':                     { input: 31371, output: 50560  }
'@cf/zai-org/glm-4.7-flash':                     { input: 5500,  output: 36400  }
'@cf/ibm-granite/granite-4.0-h-micro':           { input: 1542,  output: 10158  }
'@cf/mistral/mistral-7b-instruct-v0.1':          { input: 10000, output: 17300  }
```

### Routing por tier optimizado

```text
free:       '@cf/ibm-granite/granite-4.0-h-micro'   (maximo tokens gratis)
pro:        '@cf/qwen/qwen3-30b-a3b-fp8'            (mejor calidad/coste)
enterprise: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' (maxima calidad)
```

### Variables de entorno a ELIMINAR del Worker

```text
OPENROUTER_API_KEY  (eliminar de Env interface y wrangler.toml)
OPENAI_API_KEY      (eliminar)
ANTHROPIC_API_KEY   (eliminar)
GOOGLE_API_KEY      (eliminar)
```

