// Binario SDK - Usage Tracker

export interface TrackRequestParams {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  neurons: number;
  cached: boolean;
  latencyMs: number;
}

export interface UsageTracker {
  trackRequest(params: TrackRequestParams): void;
  getTotalNeurons(): number;
  getTotalTokens(): number;
  reset(): void;
}

/** Create a simple in-memory usage tracker */
export function createUsageTracker(): UsageTracker {
  let totalNeurons = 0;
  let totalTokens = 0;

  return {
    trackRequest(params: TrackRequestParams) {
      totalNeurons += params.neurons;
      totalTokens += params.inputTokens + params.outputTokens;
    },
    getTotalNeurons() {
      return totalNeurons;
    },
    getTotalTokens() {
      return totalTokens;
    },
    reset() {
      totalNeurons = 0;
      totalTokens = 0;
    },
  };
}
