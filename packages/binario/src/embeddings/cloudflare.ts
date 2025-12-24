// Cloudflare Embeddings Provider for Binario SDK

import type { 
  EmbeddingsProvider, 
  EmbeddingResult, 
  BatchEmbeddingResult,
  CloudflareEmbeddingsConfig,
  CloudflareAIBinding
} from './types';
import { countTokens } from '../memory/utils';

/** Available Cloudflare embedding models */
export const CLOUDFLARE_EMBEDDING_MODELS = {
  'bge-base-en': '@cf/baai/bge-base-en-v1.5',
  'bge-large-en': '@cf/baai/bge-large-en-v1.5',
  'bge-small-en': '@cf/baai/bge-small-en-v1.5',
} as const;

export type CloudflareEmbeddingModel = keyof typeof CLOUDFLARE_EMBEDDING_MODELS | string;

const DEFAULT_MODEL = CLOUDFLARE_EMBEDDING_MODELS['bge-base-en'];

/**
 * Cloudflare AI Embeddings Provider.
 * Uses Cloudflare Workers AI for generating embeddings.
 * 
 * @example
 * ```ts
 * // In a Cloudflare Worker with binding
 * const embeddings = new CloudflareEmbeddings({ binding: env.AI });
 * const result = await embeddings.embed('Hello world');
 * console.log(result.embedding); // [0.1, 0.2, ...]
 * 
 * // Using REST API
 * const embeddings = new CloudflareEmbeddings({
 *   accountId: 'your-account-id',
 *   apiKey: 'your-api-key'
 * });
 * ```
 */
export class CloudflareEmbeddings implements EmbeddingsProvider {
  readonly name = 'cloudflare';
  
  private binding?: CloudflareAIBinding;
  private accountId?: string;
  private apiKey?: string;
  private model: string;

  constructor(config: CloudflareEmbeddingsConfig = {}) {
    this.binding = config.binding;
    this.accountId = config.accountId;
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    
    // Resolve model alias
    if (this.model in CLOUDFLARE_EMBEDDING_MODELS) {
      this.model = CLOUDFLARE_EMBEDDING_MODELS[this.model as keyof typeof CLOUDFLARE_EMBEDDING_MODELS];
    }
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const result = await this.embedMany([text]);
    return result.embeddings[0];
  }

  async embedMany(texts: string[]): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      return {
        embeddings: [],
        model: this.model,
        usage: { promptTokens: 0, totalTokens: 0 },
      };
    }

    let embeddings: number[][];
    
    if (this.binding) {
      // Use binding (faster in Workers)
      const response = await this.binding.run(this.model, { text: texts });
      embeddings = response.data;
    } else if (this.accountId && this.apiKey) {
      // Use REST API
      embeddings = await this.embedViaRest(texts);
    } else {
      throw new Error('CloudflareEmbeddings requires either a binding or accountId + apiKey');
    }

    // Calculate token usage
    const promptTokens = texts.reduce((sum, t) => sum + countTokens(t), 0);

    return {
      embeddings: texts.map((text, i) => ({
        text,
        embedding: embeddings[i],
        tokenCount: countTokens(text),
      })),
      model: this.model,
      usage: {
        promptTokens,
        totalTokens: promptTokens,
      },
    };
  }

  private async embedViaRest(texts: string[]): Promise<number[][]> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: texts }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare embeddings failed: ${response.status} ${error}`);
    }

    const data = await response.json() as { result: { data: number[][] } };
    return data.result.data;
  }

  /** Get the current model */
  getModel(): string {
    return this.model;
  }

  /** Set a new model */
  setModel(model: string): void {
    this.model = model in CLOUDFLARE_EMBEDDING_MODELS
      ? CLOUDFLARE_EMBEDDING_MODELS[model as keyof typeof CLOUDFLARE_EMBEDDING_MODELS]
      : model;
  }
}

/** Create a new Cloudflare embeddings provider */
export function createCloudflareEmbeddings(
  config: CloudflareEmbeddingsConfig = {}
): CloudflareEmbeddings {
  return new CloudflareEmbeddings(config);
}
