// Binario Dependency Injection System
// Inspired by Pydantic AI's dependency injection pattern

import { z } from 'zod';

/**
 * Dependency container for type-safe dependency injection in agents
 */
export interface DepsContainer<T extends object = object> {
  deps: T;
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
  clone(): DepsContainer<T>;
  merge<U extends object>(other: DepsContainer<U>): DepsContainer<T & U>;
}

/**
 * Create a type-safe dependency container
 * 
 * @example
 * const deps = createDeps({
 *   customerId: 123,
 *   db: databaseConnection,
 *   cache: cacheInstance,
 * });
 * 
 * const agent = createAgent(binario, {
 *   deps,
 *   systemPrompt: (ctx) => `Customer: ${ctx.deps.get('customerId')}`,
 * });
 */
export function createDeps<T extends object>(initial: T): DepsContainer<T> {
  const state = { ...initial };

  return {
    deps: state,
    get<K extends keyof T>(key: K): T[K] {
      return state[key];
    },
    set<K extends keyof T>(key: K, value: T[K]): void {
      state[key] = value;
    },
    clone(): DepsContainer<T> {
      return createDeps({ ...state });
    },
    merge<U extends object>(other: DepsContainer<U>): DepsContainer<T & U> {
      return createDeps({ ...state, ...other.deps });
    },
  };
}

/**
 * Runtime dependency that can be resolved lazily
 */
export interface RuntimeDep<T> {
  name: string;
  resolve: () => T | Promise<T>;
  cached?: boolean;
}

/**
 * Create a lazily-resolved runtime dependency
 * 
 * @example
 * const dbDep = runtimeDep('database', async () => {
 *   return await DatabasePool.connect();
 * }, { cached: true });
 */
export function runtimeDep<T>(
  name: string,
  resolver: () => T | Promise<T>,
  options: { cached?: boolean } = {}
): RuntimeDep<T> {
  let cachedValue: T | undefined;
  let resolved = false;

  return {
    name,
    cached: options.cached,
    resolve: async () => {
      if (options.cached && resolved) {
        return cachedValue as T;
      }
      const value = await resolver();
      if (options.cached) {
        cachedValue = value;
        resolved = true;
      }
      return value;
    },
  };
}

/**
 * Dependency scope for request-level isolation
 */
export class DepsScope<T extends object = object> {
  private container: DepsContainer<T>;
  private runtimeDeps: Map<string, RuntimeDep<unknown>> = new Map();
  private resolvedDeps: Map<string, unknown> = new Map();

  constructor(initial: T = {} as T) {
    this.container = createDeps(initial);
  }

  /**
   * Register a runtime dependency
   */
  register<V>(dep: RuntimeDep<V>): this {
    this.runtimeDeps.set(dep.name, dep);
    return this;
  }

  /**
   * Resolve all dependencies for a request
   */
  async resolveAll(): Promise<DepsContainer<T & Record<string, unknown>>> {
    const resolved: Record<string, unknown> = {};

    for (const [name, dep] of this.runtimeDeps) {
      if (this.resolvedDeps.has(name)) {
        resolved[name] = this.resolvedDeps.get(name);
      } else {
        const value = await dep.resolve();
        if (dep.cached) {
          this.resolvedDeps.set(name, value);
        }
        resolved[name] = value;
      }
    }

    return this.container.merge(createDeps(resolved));
  }

  /**
   * Get static deps
   */
  getStatic(): DepsContainer<T> {
    return this.container.clone();
  }

  /**
   * Create a child scope that inherits parent deps
   */
  child<U extends object>(additional: U = {} as U): DepsScope<T & U> {
    const childScope = new DepsScope({ ...this.container.deps, ...additional });
    for (const [name, dep] of this.runtimeDeps) {
      childScope.register(dep);
    }
    return childScope as unknown as DepsScope<T & U>;
  }
}

/**
 * Create a new dependency scope
 */
export function createScope<T extends object>(initial?: T): DepsScope<T> {
  return new DepsScope(initial);
}

/**
 * Request context that combines deps with request-specific data
 */
export interface RequestContext<TDeps extends object = object> {
  deps: DepsContainer<TDeps>;
  requestId: string;
  startTime: number;
  metadata: Record<string, unknown>;
}

/**
 * Create a request context with dependencies
 */
export function createRequestContext<TDeps extends object>(
  deps: DepsContainer<TDeps>,
  metadata: Record<string, unknown> = {}
): RequestContext<TDeps> {
  return {
    deps,
    requestId: crypto.randomUUID(),
    startTime: Date.now(),
    metadata,
  };
}

/**
 * Schema for validating dependency configuration
 */
export const DepsConfigSchema = z.object({
  timeout: z.number().optional().default(30000),
  retryOnFailure: z.boolean().optional().default(true),
  maxRetries: z.number().optional().default(3),
});

export type DepsConfig = z.infer<typeof DepsConfigSchema>;
