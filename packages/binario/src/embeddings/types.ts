// Embeddings Types for Binario SDK

/** Embedding result for a single text */
export interface EmbeddingResult {
  /** The input text */
  text: string;
  /** The embedding vector */
  embedding: number[];
  /** Token count used */
  tokenCount?: number;
}

/** Batch embedding result */
export interface BatchEmbeddingResult {
  /** Array of embedding results */
  embeddings: EmbeddingResult[];
  /** Model used */
  model: string;
  /** Total tokens used */
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

/** Embeddings provider interface */
export interface EmbeddingsProvider {
  /** Provider name */
  readonly name: string;
  
  /** Embed a single text */
  embed(text: string): Promise<EmbeddingResult>;
  
  /** Embed multiple texts */
  embedMany(texts: string[]): Promise<BatchEmbeddingResult>;
}

/** Configuration for embeddings providers */
export interface EmbeddingsConfig {
  /** Model to use for embeddings */
  model?: string;
  /** API key (if required) */
  apiKey?: string;
  /** Base URL for API */
  baseUrl?: string;
  /** Embedding dimensions (if configurable) */
  dimensions?: number;
}

/** Cloudflare AI binding interface */
export interface CloudflareAIBinding {
  run(model: string, input: { text: string | string[] }): Promise<{
    data: number[][];
  }>;
}

/** Cloudflare embeddings configuration */
export interface CloudflareEmbeddingsConfig extends EmbeddingsConfig {
  /** Cloudflare AI binding */
  binding?: CloudflareAIBinding;
  /** Cloudflare account ID (for REST API) */
  accountId?: string;
}
