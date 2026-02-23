// Binario SDK - Cloudflare Workers Entry Point
// Import with: import { runWithTools } from 'binario/cloudflare'

// ============ Agents SDK Integration ============
// Re-export the Agents SDK classes for creating custom agents
// Users can extend these to build their own agents on Cloudflare

/**
 * Create a Binario-flavored AIChatAgent configuration.
 * Usage:
 * ```ts
 * import { createBinarioAgentConfig } from 'binario/cloudflare';
 * 
 * export class MyAgent extends AIChatAgent {
 *   async onChatMessage(onFinish) {
 *     const config = createBinarioAgentConfig(this.env.AI, '@cf/qwen/qwen3-30b-a3b-fp8');
 *     return streamText({ ...config, messages: this.messages, onFinish });
 *   }
 * }
 * ```
 */
export function createBinarioAgentConfig(aiBinding: unknown, model: string = '@cf/ibm-granite/granite-4.0-h-micro') {
  return {
    model: model,
    aiBinding,
    maxSteps: 5,
  };
}

// ============ Core Cloudflare Exports ============

export {
  CLOUDFLARE_MODELS,
  DEFAULT_CLOUDFLARE_MODEL,
  NEURON_COSTS,
  FREE_NEURONS_PER_DAY,
  PAID_NEURON_COST_PER_1K,
  MODEL_CATEGORIES,
  runWithBinding,
  runWithRestAPI,
  streamWithRestAPI,
  calculateNeurons,
  calculateCostUSD,
  estimateFreeTokens,
  supportsToolCalling,
  getRecommendedModel,
  getTierModel,
  runWithTools,
  runWithToolsTracked,
  tool,
  autoTrimTools,
} from './providers/cloudflare';

export type {
  CloudflareTool,
  RunWithToolsOptions,
  RunWithToolsResponse,
  CloudflareOptions,
  TrackerConfig,
} from './providers/cloudflare';
