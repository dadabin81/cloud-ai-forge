// Binario SDK - Observability Hooks

import type { Message, ChatResponse } from './types';

export interface RequestStartEvent {
  messages: Message[];
  model: string;
  provider: string;
  spanId: string;
}

export interface RequestEndEvent {
  messages: Message[];
  response: ChatResponse;
  spanId: string;
  metrics: {
    neuronsUsed: number;
    neuronsRemaining: number;
    tokensIn: number;
    tokensOut: number;
    latencyMs: number;
    cacheHit: boolean;
    retryCount: number;
    model: string;
    provider: string;
  };
}

export interface ObservabilityHooks {
  onRequestStart?: (event: RequestStartEvent) => void;
  onRequestEnd?: (event: RequestEndEvent) => void;
}

/** Console-based observability hooks for development */
export const consoleHooks: ObservabilityHooks = {
  onRequestStart: (event) => {
    console.log(`[binario] Request started: model=${event.model} provider=${event.provider} spanId=${event.spanId}`);
  },
  onRequestEnd: (event) => {
    console.log(`[binario] Request ended: model=${event.metrics.model} latency=${event.metrics.latencyMs}ms neurons=${event.metrics.neuronsUsed}`);
  },
};
