

# Guia Paso a Paso - Todas las Fases para Produccion

## Estado Actual

La Fase 1 ya esta parcialmente completada:
- CodeBlock syntax highlighting: HECHO
- Footer copyright 2026: HECHO
- Waitlist conectado a base de datos: HECHO
- Links de GitHub/Twitter: Pendiente (necesitas un repositorio real)

---

## Fase 1 - Fixes Restantes (En Lovable)

### Paso 1: Arreglar links de GitHub y Twitter
- Necesito saber tus URLs reales:
  - Tu repositorio de GitHub (ej: `https://github.com/dadabin81/cloud-ai-forge`)
  - Tu perfil de Twitter/X (si tienes uno)
- Con esa info, actualizare los links en Navigation.tsx y Footer.tsx

### Paso 2: Actualizar textos de marketing falsos
- Cambiar "Join thousands of developers" por algo honesto como "Start building with Binario"
- Quitar metricas inventadas del StatsCard si las hay
- Revisar las paginas About, Privacy, Terms y Contact para asegurar contenido real

---

## Fase 2 - Seguridad (En tu codigo de Cloudflare)

Estos cambios se hacen en tu backend de Cloudflare Workers, NO en Lovable.

### Paso 3: Mejorar hash de contrasenas
- Abrir `cloudflare/src/index.ts` en tu editor local
- Reemplazar la funcion `hashKey` que usa SHA-256 por una implementacion con `bcrypt` o `scrypt`
- Cloudflare Workers soporta `crypto.subtle.deriveBits` con PBKDF2 como alternativa segura

### Paso 4: Restringir CORS
- En el mismo archivo, cambiar `Access-Control-Allow-Origin: '*'` por tu dominio real
- Ejemplo: `'Access-Control-Allow-Origin': 'https://binarioai-sdk.lovable.app'`

### Paso 5: Validar inputs del API
- Agregar validacion de longitud maxima en mensajes
- Sanitizar parametros como `temperature`, `max_tokens`
- Validar que `model` sea uno de los modelos permitidos

---

## Fase 3 - Deployment del Backend (En tu terminal local)

### Paso 6: Generar package-lock.json para Cloudflare
```
cd cloudflare
npm install
```

### Paso 7: Subir a GitHub
```
git add .
git commit -m "Add cloudflare package-lock.json"
git push origin main
```

### Paso 8: Verificar deployment
- Ir al dashboard de Cloudflare Pages
- Confirmar que el build pasa sin errores
- Probar el endpoint: `https://tu-worker.workers.dev/health`
- Debe devolver: `{"status":"ok","version":"1.0.0"}`

---

## Fase 4 - Publicacion NPM (En tu terminal local)

### Paso 9: Ejecutar tests del SDK
```
cd packages/binario
npm install
npx vitest run
```
- Todos los tests deben pasar antes de publicar

### Paso 10: Build del paquete
```
npx tsup
```
- Verificar que se genera la carpeta `dist/` con los archivos compilados

### Paso 11: Publicar en npm
```
npm login
npm publish --access public
```
- Verificar que funciona: `npm info binario`

### Paso 12: Verificar instalacion
```
mkdir /tmp/test-binario && cd /tmp/test-binario
npm init -y
npm install binario
```

---

## Fase 5 - Contenido Legal y Marketing (En Lovable)

### Paso 13: Revisar paginas legales
- Privacy Policy: Necesita contenido legal real sobre datos que recoges
- Terms of Service: Necesita terminos reales sobre uso del SDK
- About: Informacion real sobre el equipo/proyecto

### Paso 14: Pagina Contact funcional
- Conectar el formulario de contacto a la base de datos (igual que hicimos con waitlist)

---

## Resumen de Donde Hacer Cada Cosa

| Fase | Donde | Herramienta |
|------|-------|-------------|
| Fase 1 (links, textos) | Lovable | Pideme que lo haga |
| Fase 2 (seguridad) | Editor local | VS Code + tu terminal |
| Fase 3 (deployment) | Terminal + GitHub | Linea de comandos |
| Fase 4 (npm publish) | Terminal | Linea de comandos |
| Fase 5 (contenido) | Lovable | Pideme que lo haga |

---

## Orden Recomendado

1. Primero: Dime tus URLs de GitHub y Twitter para completar Fase 1
2. Segundo: Yo hago los cambios de Fase 1 y Fase 5 en Lovable
3. Tercero: Tu haces Fase 2 y 3 en tu terminal (seguridad + deployment)
4. Cuarto: Tu haces Fase 4 en tu terminal (publicar en npm)

Una vez completadas las 5 fases, el proyecto estaria listo para lanzar al mercado.

