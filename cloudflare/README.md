# Binario API - Cloudflare Worker

Production-ready API backend for the Binario SDK.

## 🚀 Quick Start

### Prerequisites

- [Cloudflare Account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Node.js 18+

### 1. Install Dependencies

```bash
cd cloudflare
npm install
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create D1 Database

```bash
npm run d1:create
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "binario-db"
database_id = "YOUR_DATABASE_ID_HERE"  # ← Paste here
```

### 4. Create KV Namespace

```bash
npm run kv:create
```

Copy the `id` from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_NAMESPACE_ID_HERE"  # ← Paste here
```

### 5. Run Database Migrations

```bash
npm run d1:migrate
```

### 6. (Optional) Add OpenRouter API Key

For fallback AI provider:

```bash
wrangler secret put OPENROUTER_API_KEY
```

### 7. Deploy

```bash
npm run deploy
```

Your API will be available at: `https://binario-api.YOUR_SUBDOMAIN.workers.dev`

## 📡 API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/v1/models` | GET | No | List available models |
| `/v1/chat/completions` | POST | Yes | Chat completion |
| `/v1/chat/stream` | POST | Yes | Streaming chat |
| `/v1/agents/run` | POST | Yes | Run agent |
| `/v1/usage` | GET | Yes | Usage statistics |

### Authentication

Include your API key in requests:

```bash
curl -X POST https://binario-api.xxx.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: bnr_live_xxxx" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
```

## 🔧 Development

### Local Development

```bash
npm run dev
```

### Local Database

```bash
npm run d1:migrate:local
```

### View Logs

```bash
npm run tail
```

## 🔐 GitHub Actions Setup

1. Go to your GitHub repo → Settings → Secrets → Actions
2. Add secret: `CLOUDFLARE_API_TOKEN`
   - Create token at: https://dash.cloudflare.com/profile/api-tokens
   - Template: "Edit Cloudflare Workers"

## 📊 Rate Limits

| Plan | Requests/min | Requests/day | Tokens/day |
|------|-------------|--------------|------------|
| Free | 10 | 100 | 50,000 |
| Pro | 60 | 1,000 | 500,000 |
| Enterprise | 300 | 10,000 | 5,000,000 |

## 🧠 Models

| Model | Tier | Best For |
|-------|------|----------|
| Llama 3.1 8B | Free | Quick responses |
| Llama 3.3 70B | Pro | Complex tasks |
| Mistral 7B | Free | Code generation |
| Qwen 1.5 14B | Pro | Multilingual |

## 📁 Project Structure

```
cloudflare/
├── src/
│   └── index.ts      # Main worker code
├── schema.sql        # D1 database schema
├── wrangler.toml     # Cloudflare configuration
├── package.json      # Dependencies
└── tsconfig.json     # TypeScript config
```

## 🔗 Links

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
- 
