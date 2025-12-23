// Binario Observability System
// OpenTelemetry-ready hooks for monitoring and debugging

import type { Message, ChatResponse, ToolCall } from './types';

/**
 * Span for tracing individual operations
 */
export interface Span {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'success' | 'error';
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  parentId?: string;
}

/**
 * Event within a span
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

/**
 * Metrics collected during operations
 */
export interface Metrics {
  neuronsUsed: number;
  neuronsRemaining: number;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  cacheHit: boolean;
  retryCount: number;
  model: string;
  provider: string;
}

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log entry
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  spanId?: string;
}

/**
 * Observability hooks for integration with external systems
 */
export interface ObservabilityHooks {
  // Lifecycle hooks
  onRequestStart?: (request: {
    messages: Message[];
    model: string;
    provider: string;
    spanId: string;
  }) => void | Promise<void>;

  onRequestEnd?: (request: {
    messages: Message[];
    response: ChatResponse;
    spanId: string;
    metrics: Metrics;
  }) => void | Promise<void>;

  // Token streaming
  onToken?: (token: string, spanId: string) => void;

  // Tool calling
  onToolCallStart?: (toolCall: {
    name: string;
    args: unknown;
    spanId: string;
  }) => void | Promise<void>;

  onToolCallEnd?: (toolCall: {
    name: string;
    args: unknown;
    result: unknown;
    error?: Error;
    durationMs: number;
    spanId: string;
  }) => void | Promise<void>;

  // Errors
  onError?: (error: {
    error: Error;
    context: Record<string, unknown>;
    spanId?: string;
  }) => void | Promise<void>;

  // Resource usage (Cloudflare neurons)
  onNeuronsUsed?: (usage: {
    neurons: number;
    remaining: number;
    model: string;
    spanId: string;
  }) => void | Promise<void>;

  // Logging
  onLog?: (entry: LogEntry) => void;

  // Spans
  onSpanStart?: (span: Span) => void;
  onSpanEnd?: (span: Span) => void;
}

/**
 * Observability manager for collecting and dispatching metrics
 */
export class ObservabilityManager {
  private hooks: ObservabilityHooks;
  private spans: Map<string, Span> = new Map();
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  constructor(hooks: ObservabilityHooks = {}) {
    this.hooks = hooks;
  }

  /**
   * Start a new span
   */
  startSpan(name: string, attributes: Record<string, unknown> = {}, parentId?: string): Span {
    const span: Span = {
      id: crypto.randomUUID(),
      name,
      startTime: Date.now(),
      status: 'running',
      attributes,
      events: [],
      parentId,
    };
    this.spans.set(span.id, span);
    this.hooks.onSpanStart?.(span);
    return span;
  }

  /**
   * End a span
   */
  endSpan(spanId: string, status: 'success' | 'error' = 'success'): Span | undefined {
    const span = this.spans.get(spanId);
    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
      span.status = status;
      this.hooks.onSpanEnd?.(span);
    }
    return span;
  }

  /**
   * Add event to a span
   */
  addSpanEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.events.push({
        name,
        timestamp: Date.now(),
        attributes,
      });
    }
  }

  /**
   * Log a message
   */
  log(level: LogLevel, message: string, context?: Record<string, unknown>, spanId?: string): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
      spanId,
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    this.hooks.onLog?.(entry);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  /**
   * Track request lifecycle
   */
  async trackRequest<T>(
    fn: () => Promise<T>,
    context: {
      messages: Message[];
      model: string;
      provider: string;
    }
  ): Promise<T> {
    const span = this.startSpan('chat_request', {
      model: context.model,
      provider: context.provider,
      messageCount: context.messages.length,
    });

    await this.hooks.onRequestStart?.({
      ...context,
      spanId: span.id,
    });

    try {
      const result = await fn();
      this.endSpan(span.id, 'success');
      return result;
    } catch (error) {
      this.endSpan(span.id, 'error');
      await this.hooks.onError?.({
        error: error as Error,
        context,
        spanId: span.id,
      });
      throw error;
    }
  }

  /**
   * Track tool call
   */
  async trackToolCall<T>(
    fn: () => Promise<T>,
    context: { name: string; args: unknown },
    parentSpanId?: string
  ): Promise<T> {
    const span = this.startSpan(`tool:${context.name}`, { args: context.args }, parentSpanId);

    await this.hooks.onToolCallStart?.({
      ...context,
      spanId: span.id,
    });

    const startTime = Date.now();

    try {
      const result = await fn();
      this.endSpan(span.id, 'success');

      await this.hooks.onToolCallEnd?.({
        ...context,
        result,
        durationMs: Date.now() - startTime,
        spanId: span.id,
      });

      return result;
    } catch (error) {
      this.endSpan(span.id, 'error');

      await this.hooks.onToolCallEnd?.({
        ...context,
        result: undefined,
        error: error as Error,
        durationMs: Date.now() - startTime,
        spanId: span.id,
      });

      throw error;
    }
  }

  /**
   * Report neurons used
   */
  async reportNeurons(neurons: number, remaining: number, model: string, spanId?: string): Promise<void> {
    await this.hooks.onNeuronsUsed?.({
      neurons,
      remaining,
      model,
      spanId: spanId || 'unknown',
    });
  }

  /**
   * Get all spans
   */
  getSpans(): Span[] {
    return Array.from(this.spans.values());
  }

  /**
   * Get logs
   */
  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter((l) => l.level === level);
    }
    return [...this.logs];
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.spans.clear();
    this.logs = [];
  }

  /**
   * Export data for external systems (e.g., OpenTelemetry)
   */
  export(): { spans: Span[]; logs: LogEntry[] } {
    return {
      spans: this.getSpans(),
      logs: this.getLogs(),
    };
  }
}

/**
 * Create a new observability manager
 */
export function createObservability(hooks?: ObservabilityHooks): ObservabilityManager {
  return new ObservabilityManager(hooks);
}

/**
 * Console-based observability hooks for development
 */
export const consoleHooks: ObservabilityHooks = {
  onRequestStart: ({ model, provider, spanId }) => {
    console.log(`[${spanId.slice(0, 8)}] 🚀 Request started: ${provider}/${model}`);
  },
  onRequestEnd: ({ response, metrics, spanId }) => {
    console.log(
      `[${spanId.slice(0, 8)}] ✅ Request completed: ${metrics.latencyMs}ms, ${metrics.tokensIn}→${metrics.tokensOut} tokens`
    );
  },
  onToolCallStart: ({ name, spanId }) => {
    console.log(`[${spanId.slice(0, 8)}] 🔧 Tool call: ${name}`);
  },
  onToolCallEnd: ({ name, durationMs, error, spanId }) => {
    if (error) {
      console.log(`[${spanId.slice(0, 8)}] ❌ Tool failed: ${name} (${durationMs}ms) - ${error.message}`);
    } else {
      console.log(`[${spanId.slice(0, 8)}] ✓ Tool completed: ${name} (${durationMs}ms)`);
    }
  },
  onError: ({ error, spanId }) => {
    console.error(`[${spanId?.slice(0, 8) || 'unknown'}] ❌ Error: ${error.message}`);
  },
  onNeuronsUsed: ({ neurons, remaining, model }) => {
    console.log(`🧠 Neurons: ${neurons} used, ${remaining} remaining (${model})`);
  },
  onLog: (entry) => {
    const icons = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' };
    console.log(`${icons[entry.level]} [${entry.level.toUpperCase()}] ${entry.message}`);
  },
};
