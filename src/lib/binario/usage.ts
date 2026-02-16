// Binario Usage Tracking System
// Track Cloudflare neurons and manage free tier limits

import type { CloudflareModel } from './types';
import { NEURON_COSTS, FREE_NEURONS_PER_DAY, calculateNeurons } from './providers/cloudflare';

/**
 * Usage record for a single request
 */
export interface UsageRecord {
  id: string;
  timestamp: number;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  neurons: number;
  cached: boolean;
  latencyMs: number;
}

/**
 * Daily usage summary
 */
export interface DailyUsage {
  date: string; // YYYY-MM-DD
  neuronsUsed: number;
  neuronsLimit: number;
  requestCount: number;
  tokenStats: {
    totalInput: number;
    totalOutput: number;
  };
  modelBreakdown: Record<string, { requests: number; neurons: number }>;
}

/**
 * Usage report with analytics
 */
export interface UsageReport {
  currentDay: DailyUsage;
  last7Days: DailyUsage[];
  totals: {
    neuronsUsed: number;
    requestCount: number;
    avgNeuronsPerRequest: number;
  };
  recommendations: string[];
}

/**
 * Fallback configuration when neurons are exhausted
 */
export interface FallbackConfig {
  enabled: boolean;
  provider: string;
  model: string;
  trigger: 'neurons_exhausted' | 'threshold' | 'always';
  threshold?: number; // Percentage of free tier remaining
}

/**
 * Usage tracker for monitoring and managing Cloudflare neuron consumption
 */
export class UsageTracker {
  private records: UsageRecord[] = [];
  private dailyUsage: Map<string, DailyUsage> = new Map();
  private freeLimit: number = FREE_NEURONS_PER_DAY;
  private maxRecords: number = 10000;
  private fallbackConfig?: FallbackConfig;

  constructor(options: { freeLimit?: number; fallbackConfig?: FallbackConfig } = {}) {
    if (options.freeLimit) {
      this.freeLimit = options.freeLimit;
    }
    if (options.fallbackConfig) {
      this.fallbackConfig = options.fallbackConfig;
    }
  }

  /**
   * Get today's date string
   */
  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Track a request
   */
  trackRequest(record: Omit<UsageRecord, 'id' | 'timestamp'>): UsageRecord {
    const fullRecord: UsageRecord = {
      ...record,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    this.records.push(fullRecord);
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }

    // Update daily usage
    const today = this.getToday();
    let daily = this.dailyUsage.get(today);
    if (!daily) {
      daily = {
        date: today,
        neuronsUsed: 0,
        neuronsLimit: this.freeLimit,
        requestCount: 0,
        tokenStats: { totalInput: 0, totalOutput: 0 },
        modelBreakdown: {},
      };
      this.dailyUsage.set(today, daily);
    }

    daily.neuronsUsed += record.neurons;
    daily.requestCount++;
    daily.tokenStats.totalInput += record.inputTokens;
    daily.tokenStats.totalOutput += record.outputTokens;

    if (!daily.modelBreakdown[record.model]) {
      daily.modelBreakdown[record.model] = { requests: 0, neurons: 0 };
    }
    daily.modelBreakdown[record.model].requests++;
    daily.modelBreakdown[record.model].neurons += record.neurons;

    return fullRecord;
  }

  /**
   * Get remaining neurons for today
   */
  getRemainingNeurons(): number {
    const today = this.getToday();
    const daily = this.dailyUsage.get(today);
    if (!daily) {
      return this.freeLimit;
    }
    return Math.max(0, this.freeLimit - daily.neuronsUsed);
  }

  /**
   * Get neurons used today
   */
  getNeuronsUsedToday(): number {
    const today = this.getToday();
    const daily = this.dailyUsage.get(today);
    return daily?.neuronsUsed || 0;
  }

  /**
   * Check if we should fallback to alternative provider
   */
  shouldFallback(): boolean {
    if (!this.fallbackConfig?.enabled) {
      return false;
    }

    const remaining = this.getRemainingNeurons();

    switch (this.fallbackConfig.trigger) {
      case 'neurons_exhausted':
        return remaining <= 0;
      case 'threshold':
        const threshold = this.fallbackConfig.threshold || 10;
        return (remaining / this.freeLimit) * 100 <= threshold;
      case 'always':
        return true;
      default:
        return false;
    }
  }

  /**
   * Get fallback configuration
   */
  getFallbackConfig(): FallbackConfig | undefined {
    return this.fallbackConfig;
  }

  /**
   * Estimate neurons for a request (before making it)
   */
  estimateNeurons(model: CloudflareModel, estimatedInputTokens: number, estimatedOutputTokens: number): number {
    return calculateNeurons(model, estimatedInputTokens, estimatedOutputTokens);
  }

  /**
   * Check if we can afford a request
   */
  canAffordRequest(model: CloudflareModel, estimatedInputTokens: number, estimatedOutputTokens: number): boolean {
    const estimated = this.estimateNeurons(model, estimatedInputTokens, estimatedOutputTokens);
    return this.getRemainingNeurons() >= estimated;
  }

  /**
   * Get usage report
   */
  getUsageReport(): UsageReport {
    const today = this.getToday();
    const currentDay = this.dailyUsage.get(today) || {
      date: today,
      neuronsUsed: 0,
      neuronsLimit: this.freeLimit,
      requestCount: 0,
      tokenStats: { totalInput: 0, totalOutput: 0 },
      modelBreakdown: {},
    };

    // Get last 7 days
    const last7Days: DailyUsage[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const daily = this.dailyUsage.get(dateStr);
      if (daily) {
        last7Days.push(daily);
      }
    }

    // Calculate totals
    const totals = {
      neuronsUsed: last7Days.reduce((sum, d) => sum + d.neuronsUsed, 0),
      requestCount: last7Days.reduce((sum, d) => sum + d.requestCount, 0),
      avgNeuronsPerRequest: 0,
    };
    if (totals.requestCount > 0) {
      totals.avgNeuronsPerRequest = totals.neuronsUsed / totals.requestCount;
    }

    // Generate recommendations
    const recommendations: string[] = [];
    const remaining = this.getRemainingNeurons();
    const percentUsed = ((this.freeLimit - remaining) / this.freeLimit) * 100;

    if (percentUsed >= 90) {
      recommendations.push('⚠️ You have used 90%+ of your daily free neurons. Consider using smaller models.');
    } else if (percentUsed >= 70) {
      recommendations.push('You have used 70%+ of your daily free neurons.');
    }

    // Find most expensive model
    const modelEntries = Object.entries(currentDay.modelBreakdown);
    if (modelEntries.length > 0) {
      const mostExpensive = modelEntries.sort((a, b) => b[1].neurons - a[1].neurons)[0];
      if (mostExpensive[1].neurons > this.freeLimit * 0.5) {
        recommendations.push(
          `${mostExpensive[0]} is consuming ${Math.round((mostExpensive[1].neurons / currentDay.neuronsUsed) * 100)}% of your neurons. Consider llama-3.2-1b for lower consumption.`
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Usage is healthy. You have plenty of free neurons remaining.');
    }

    return {
      currentDay,
      last7Days,
      totals,
      recommendations,
    };
  }

  /**
   * Get percentage of free tier used today
   */
  getUsagePercentage(): number {
    const used = this.getNeuronsUsedToday();
    return Math.round((used / this.freeLimit) * 100);
  }

  /**
   * Reset daily usage (for testing or manual reset)
   */
  resetDaily(): void {
    const today = this.getToday();
    this.dailyUsage.delete(today);
  }

  /**
   * Export all records
   */
  exportRecords(): UsageRecord[] {
    return [...this.records];
  }

  /**
   * Get records for a specific date range
   */
  getRecordsByDateRange(startDate: Date, endDate: Date): UsageRecord[] {
    const startTs = startDate.getTime();
    const endTs = endDate.getTime();
    return this.records.filter((r) => r.timestamp >= startTs && r.timestamp <= endTs);
  }
}

/**
 * Create a new usage tracker
 */
export function createUsageTracker(options?: {
  freeLimit?: number;
  fallbackConfig?: FallbackConfig;
}): UsageTracker {
  return new UsageTracker(options);
}

/**
 * Pre-configured free models for fallback
 */
export const FREE_FALLBACK_MODELS = {
  // OpenRouter free models
  openrouter: {
    provider: 'openrouter',
    models: [
      'meta-llama/llama-3-8b-instruct:free',
      'google/gemma-7b-it:free',
      'mistralai/mistral-7b-instruct:free',
    ],
  },
  // Groq free tier (very generous)
  groq: {
    provider: 'groq',
    models: ['llama-3.1-8b-instant', 'llama-3.2-3b-preview', 'gemma2-9b-it'],
  },
};

/**
 * Default fallback configuration
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  enabled: true,
  trigger: 'neurons_exhausted',
  provider: 'openrouter',
  model: 'meta-llama/llama-3-8b-instruct:free',
};
