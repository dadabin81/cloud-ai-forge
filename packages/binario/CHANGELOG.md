# Changelog

All notable changes to the Binario SDK will be documented in this file.

## [0.2.0] - 2026-02-18

### Added
- **SaaS Client** (`Binario` class) — connect with just an API key, no infrastructure needed
- **React Hooks** — `useChat`, `useStream`, `useAgent`, `useUsage` for SaaS mode
- **Memory System** — Buffer, Summary, SummaryBuffer, and Vector memory types
- **Embeddings** — Cloudflare `bge-base-en-v1.5` integration with hooks
- **Observability** — `consoleHooks`, `ObservabilityHooks` interface, span tracking
- **Usage Tracker** — Neuron tracking with free-tier fallback
- **Client Hooks** — `BinarioProvider` context for React apps

### Changed
- Renamed `NexusConfig` → `BinarioConfig` (alias kept for backwards compat)
- Improved streaming with proper SSE parsing and error recovery

### Fixed
- Schema validation for nested Zod objects
- Agent max iterations boundary handling

## [0.1.0] - 2026-01-15

### Added
- Initial release
- Core `BinarioAI` class with multi-provider support
- Cloudflare Workers AI provider with neuron cost calculation
- OpenRouter provider
- Agent framework with tool calling
- Structured output with Zod schemas (`zodToJsonSchema`)
- Streaming chat with async iterators
- React hooks (`useBinarioChat`, `useBinarioStream`, `useBinarioAgent`)
- Cloudflare Worker template generator
- Wrangler config generator
