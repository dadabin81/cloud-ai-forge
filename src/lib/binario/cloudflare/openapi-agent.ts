// OpenAPI Agent Builder
// Create AI agents from OpenAPI specifications
// Uses @cloudflare/ai-utils createToolsFromOpenAPISpec internally

import type { CloudflareModel } from '../types';
import type { CloudflareTool, RunWithToolsResponse } from '../providers/cloudflare';
import { runWithToolsTracked, tool, FUNCTION_CALLING_MODEL } from '../providers/cloudflare';
import type { UsageTracker } from '../usage';
import type { ObservabilityHooks } from '../observability';

/**
 * OpenAPI specification configuration
 */
export interface OpenAPISpec {
  /** URL to the OpenAPI specification JSON/YAML */
  url: string;
  /** Optional regex patterns to filter which endpoints to include */
  matchPatterns?: RegExp[];
  /** Headers to include in API calls (e.g., Authorization) */
  authHeaders?: Record<string, string>;
  /** Optional base URL override */
  baseUrl?: string;
}

/**
 * OpenAPI Agent configuration
 */
export interface OpenAPIAgentConfig {
  /** Cloudflare AI binding */
  binding: { run: (model: string, input: unknown) => Promise<unknown> };
  /** Model to use (defaults to function calling model) */
  model?: CloudflareModel;
  /** OpenAPI specifications to load */
  openApiSpecs: OpenAPISpec[];
  /** System prompt for the agent */
  systemPrompt?: string;
  /** Maximum recursive tool runs */
  maxRecursiveToolRuns?: number;
  /** Usage tracker for neuron monitoring */
  usageTracker?: UsageTracker;
  /** Observability hooks */
  observability?: ObservabilityHooks;
}

/**
 * OpenAPI Agent instance
 */
export interface OpenAPIAgent {
  /** Run the agent with a user message */
  run: (userMessage: string) => Promise<RunWithToolsResponse & { neuronsUsed: number; latency: number }>;
  /** Get loaded tools */
  getTools: () => CloudflareTool[];
  /** Get agent configuration */
  getConfig: () => OpenAPIAgentConfig;
}

/**
 * Parse OpenAPI spec and create tools
 * 
 * NOTE: In production, this would use @cloudflare/ai-utils createToolsFromOpenAPISpec
 * This is a simplified implementation for the SDK documentation site
 */
async function parseOpenAPISpec(spec: OpenAPISpec): Promise<CloudflareTool[]> {
  try {
    const response = await fetch(spec.url);
    const openapi = await response.json() as {
      paths?: Record<string, Record<string, {
        operationId?: string;
        summary?: string;
        description?: string;
        parameters?: Array<{
          name: string;
          in: string;
          description?: string;
          required?: boolean;
          schema?: { type?: string };
        }>;
        requestBody?: {
          content?: {
            'application/json'?: {
              schema?: Record<string, unknown>;
            };
          };
        };
      }>>;
      servers?: Array<{ url: string }>;
    };
    
    const tools: CloudflareTool[] = [];
    const baseUrl = spec.baseUrl || openapi.servers?.[0]?.url || '';
    
    if (!openapi.paths) return tools;
    
    for (const [path, methods] of Object.entries(openapi.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!operation.operationId) continue;
        
        // Check if path matches any patterns
        if (spec.matchPatterns && spec.matchPatterns.length > 0) {
          const matches = spec.matchPatterns.some(p => p.test(path));
          if (!matches) continue;
        }
        
        // Build parameters schema
        const properties: Record<string, unknown> = {};
        const required: string[] = [];
        
        if (operation.parameters) {
          for (const param of operation.parameters) {
            properties[param.name] = {
              type: param.schema?.type || 'string',
              description: param.description || param.name,
            };
            if (param.required) {
              required.push(param.name);
            }
          }
        }
        
        // Add request body if present
        if (operation.requestBody?.content?.['application/json']?.schema) {
          properties['body'] = operation.requestBody.content['application/json'].schema;
        }
        
        const toolDef = tool({
          name: operation.operationId,
          description: operation.summary || operation.description || `${method.toUpperCase()} ${path}`,
          parameters: {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined,
          },
          function: async (args: Record<string, unknown>) => {
            // Build URL with path parameters
            let url = `${baseUrl}${path}`;
            const queryParams: Record<string, string> = {};
            
            for (const [key, value] of Object.entries(args)) {
              if (key === 'body') continue;
              if (url.includes(`{${key}}`)) {
                url = url.replace(`{${key}}`, String(value));
              } else {
                queryParams[key] = String(value);
              }
            }
            
            // Add query parameters
            if (Object.keys(queryParams).length > 0) {
              url += '?' + new URLSearchParams(queryParams).toString();
            }
            
            // Make request
            const fetchOptions: RequestInit = {
              method: method.toUpperCase(),
              headers: {
                'Content-Type': 'application/json',
                ...spec.authHeaders,
              },
            };
            
            if (args['body']) {
              fetchOptions.body = JSON.stringify(args['body']);
            }
            
            const response = await fetch(url, fetchOptions);
            return response.json();
          },
        });
        
        tools.push(toolDef);
      }
    }
    
    return tools;
  } catch (error) {
    console.error(`Failed to parse OpenAPI spec from ${spec.url}:`, error);
    return [];
  }
}

/**
 * Create an AI agent from OpenAPI specifications
 * 
 * This function loads OpenAPI specs and creates tools that the AI can call.
 * Perfect for creating agents that can interact with external APIs.
 * 
 * @example
 * ```typescript
 * import { createOpenAPIAgent } from 'binario';
 * 
 * const agent = await createOpenAPIAgent({
 *   binding: env.AI,
 *   model: '@hf/nousresearch/hermes-2-pro-mistral-7b',
 *   openApiSpecs: [
 *     {
 *       url: 'https://api.github.com/openapi.json',
 *       matchPatterns: [/\/repos\//],
 *       authHeaders: { Authorization: `Bearer ${env.GITHUB_TOKEN}` }
 *     },
 *     {
 *       url: 'https://api.stripe.com/openapi.json',
 *       matchPatterns: [/\/customers/, /\/invoices/],
 *       authHeaders: { Authorization: `Bearer ${env.STRIPE_KEY}` }
 *     }
 *   ],
 *   systemPrompt: 'You are a developer assistant that can interact with GitHub and Stripe APIs.',
 * });
 * 
 * const result = await agent.run('Create a new issue in my repo about the payment bug');
 * ```
 */
export async function createOpenAPIAgent(config: OpenAPIAgentConfig): Promise<OpenAPIAgent> {
  // Load all tools from OpenAPI specs
  const toolArrays = await Promise.all(
    config.openApiSpecs.map(spec => parseOpenAPISpec(spec))
  );
  
  const allTools = toolArrays.flat();
  
  console.log(`[OpenAPI Agent] Loaded ${allTools.length} tools from ${config.openApiSpecs.length} specs`);
  
  return {
    async run(userMessage: string) {
      const messages = [
        {
          role: 'system',
          content: config.systemPrompt || 'You are a helpful assistant with access to external APIs. Use the available tools to help the user.',
        },
        {
          role: 'user',
          content: userMessage,
        },
      ];
      
      return runWithToolsTracked(
        config.binding,
        config.model || FUNCTION_CALLING_MODEL,
        {
          messages,
          tools: allTools,
          maxRecursiveToolRuns: config.maxRecursiveToolRuns || 5,
        },
        {
          usageTracker: config.usageTracker,
          observability: config.observability,
        }
      );
    },
    
    getTools() {
      return allTools;
    },
    
    getConfig() {
      return config;
    },
  };
}

/**
 * Create a multi-API agent with predefined popular APIs
 * 
 * @example
 * ```typescript
 * const agent = await createMultiAPIAgent({
 *   binding: env.AI,
 *   apis: ['github', 'stripe', 'openai'],
 *   credentials: {
 *     github: env.GITHUB_TOKEN,
 *     stripe: env.STRIPE_KEY,
 *     openai: env.OPENAI_KEY,
 *   }
 * });
 * ```
 */
export async function createMultiAPIAgent(config: {
  binding: { run: (model: string, input: unknown) => Promise<unknown> };
  apis: Array<'github' | 'stripe' | 'openai' | 'slack' | 'notion'>;
  credentials: Record<string, string>;
  systemPrompt?: string;
  usageTracker?: UsageTracker;
  observability?: ObservabilityHooks;
}): Promise<OpenAPIAgent> {
  const API_SPECS: Record<string, OpenAPISpec> = {
    github: {
      url: 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json',
      authHeaders: { Authorization: `Bearer ${config.credentials.github}` },
      matchPatterns: [/\/repos\//, /\/issues\//, /\/pulls\//],
    },
    stripe: {
      url: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json',
      authHeaders: { Authorization: `Bearer ${config.credentials.stripe}` },
      matchPatterns: [/\/customers/, /\/invoices/, /\/payments/],
    },
    openai: {
      url: 'https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml',
      authHeaders: { Authorization: `Bearer ${config.credentials.openai}` },
      matchPatterns: [/\/chat\/completions/, /\/embeddings/],
    },
    slack: {
      url: 'https://api.slack.com/specs/openapi/v2/slack_web.json',
      authHeaders: { Authorization: `Bearer ${config.credentials.slack}` },
      matchPatterns: [/\/chat\./, /\/channels\./],
    },
    notion: {
      url: 'https://developers.notion.com/openapi.yaml',
      authHeaders: { 
        Authorization: `Bearer ${config.credentials.notion}`,
        'Notion-Version': '2022-06-28',
      },
      matchPatterns: [/\/pages/, /\/databases/],
    },
  };
  
  const specs = config.apis
    .filter(api => API_SPECS[api] && config.credentials[api])
    .map(api => API_SPECS[api]);
  
  return createOpenAPIAgent({
    binding: config.binding,
    openApiSpecs: specs,
    systemPrompt: config.systemPrompt || `You are a helpful assistant with access to: ${config.apis.join(', ')}. Use the available tools to help the user.`,
    usageTracker: config.usageTracker,
    observability: config.observability,
  });
}
