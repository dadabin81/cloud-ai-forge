// Binario Agent Framework
// Multi-step reasoning agents with tool calling and dependency injection

import { z } from 'zod';
import type {
  Provider,
  Message,
  AgentConfig,
  AgentTool,
  AgentRunOptions,
  AgentResult,
  ChatResponse,
} from './types';
import { BinarioAI } from './core';
import { zodToJsonSchema, parseStructuredOutput } from './schema';

/**
 * Create a type-safe agent tool
 * 
 * @example
 * const searchTool = defineTool({
 *   name: 'web_search',
 *   description: 'Search the web for information',
 *   parameters: z.object({
 *     query: z.string().describe('Search query'),
 *     maxResults: z.number().optional().default(5),
 *   }),
 *   execute: async ({ query, maxResults }, context) => {
 *     // Your search implementation
 *     return results;
 *   },
 * });
 */
export function defineTool<TContext = unknown, TArgs = unknown, TResult = unknown>(
  config: {
    name: string;
    description: string;
    parameters: z.ZodType<TArgs>;
    execute: (args: TArgs, context: TContext) => Promise<TResult> | TResult;
  }
): AgentTool<TContext, TArgs, TResult> {
  return config;
}

/**
 * Agent class for multi-step reasoning with tools
 * 
 * @example
 * const agent = createAgent({
 *   model: 'cloudflare:llama-3.3-70b',
 *   systemPrompt: 'You are a helpful assistant',
 *   tools: [searchTool, calculatorTool],
 * });
 * 
 * const result = await agent.run('What is the weather in Tokyo?', {
 *   onToolCall: (tool, args, result) => console.log(`Called ${tool}`)
 * });
 */
export class Agent<TContext = unknown, TDeps = unknown> {
  private binario: BinarioAI;
  private config: AgentConfig<TContext, TDeps>;
  private context: TContext;

  constructor(
    binario: BinarioAI,
    config: AgentConfig<TContext, TDeps>,
    context?: TContext
  ) {
    this.binario = binario;
    this.config = {
      maxIterations: 10,
      ...config,
    };
    this.context = context || ({} as TContext);
  }

  /**
   * Set the agent context (for dependency injection)
   */
  withContext(context: TContext): Agent<TContext, TDeps> {
    return new Agent(this.binario, this.config, context);
  }

  /**
   * Get the system prompt (can be dynamic based on context)
   */
  private getSystemPrompt(): string {
    if (typeof this.config.systemPrompt === 'function') {
      return this.config.systemPrompt(this.context);
    }
    return this.config.systemPrompt || 'You are a helpful AI assistant.';
  }

  /**
   * Convert tools to LLM-compatible format
   */
  private getToolsForLLM() {
    if (!this.config.tools?.length) return undefined;

    return this.config.tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters),
      },
    }));
  }

  /**
   * Execute a tool call
   */
  private async executeTool(
    name: string,
    argsJson: string
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const tool = this.config.tools?.find((t) => t.name === name);
    if (!tool) {
      return { success: false, error: `Tool "${name}" not found` };
    }

    try {
      const args = JSON.parse(argsJson);
      const validated = tool.parameters.parse(args);
      const result = await tool.execute(validated, this.context);
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run the agent with a user message
   */
  async run(
    input: string,
    options: AgentRunOptions = {}
  ): Promise<AgentResult<string>> {
    const maxIterations = options.maxIterations || this.config.maxIterations || 10;
    const toolCalls: AgentResult['toolCalls'] = [];
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const messages: Message[] = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: input },
    ];

    let iterations = 0;
    let finalContent = '';

    while (iterations < maxIterations) {
      if (options.signal?.aborted) {
        throw new Error('Agent run aborted');
      }

      iterations++;

      const response = await this.binario.chat(messages, {
        provider: this.config.provider,
        model: this.config.model,
        tools: this.getToolsForLLM(),
        toolChoice: this.config.tools?.length ? 'auto' : undefined,
      });

      // Accumulate usage
      totalUsage.promptTokens += response.usage.promptTokens;
      totalUsage.completionTokens += response.usage.completionTokens;
      totalUsage.totalTokens += response.usage.totalTokens;

      // Add assistant message
      messages.push({
        role: 'assistant',
        content: response.content,
        tool_calls: response.toolCalls,
      });

      // Check if we need to execute tools
      if (response.toolCalls?.length) {
        for (const toolCall of response.toolCalls) {
          const { success, result, error } = await this.executeTool(
            toolCall.function.name,
            toolCall.function.arguments
          );

          const toolResult = success ? JSON.stringify(result) : `Error: ${error}`;

          toolCalls.push({
            tool: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments),
            result: success ? result : error,
          });

          options.onToolCall?.(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            success ? result : error
          );

          // Add tool result to messages
          messages.push({
            role: 'tool',
            content: toolResult,
            tool_call_id: toolCall.id,
          });
        }
      } else {
        // No tool calls - we have our final answer
        finalContent = response.content;
        options.onThinking?.(finalContent);
        break;
      }
    }

    return {
      output: finalContent,
      messages,
      toolCalls,
      iterations,
      usage: totalUsage,
    };
  }

  /**
   * Run the agent with structured output
   */
  async runStructured<T>(
    input: string,
    schema: z.ZodType<T>,
    options: AgentRunOptions = {}
  ): Promise<AgentResult<T>> {
    const result = await this.run(input, options);

    const parsed = parseStructuredOutput(result.output, schema);
    if (!parsed.success) {
      throw new Error(`Failed to parse structured output: ${(parsed as { error: { message: string } }).error.message}`);
    }

    return {
      ...result,
      output: parsed.data,
    };
  }

  /**
   * Stream the agent's response
   */
  async *stream(
    input: string,
    options: AgentRunOptions = {}
  ): AsyncGenerator<{ type: 'token' | 'tool_call' | 'complete'; content: string; data?: unknown }> {
    const maxIterations = options.maxIterations || this.config.maxIterations || 10;

    const messages: Message[] = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: input },
    ];

    let iterations = 0;

    while (iterations < maxIterations) {
      if (options.signal?.aborted) {
        throw new Error('Agent run aborted');
      }

      iterations++;

      let fullContent = '';
      let response: ChatResponse | null = null;

      const stream = this.binario.streamChat(messages, {
        provider: this.config.provider,
        model: this.config.model,
        tools: this.getToolsForLLM(),
        toolChoice: this.config.tools?.length ? 'auto' : undefined,
      });

      for await (const token of stream) {
        fullContent += token;
        yield { type: 'token', content: token };
      }

      // Get the final response from the generator
      const result = await stream.next();
      if (result.value) {
        response = result.value as ChatResponse;
      }

      messages.push({
        role: 'assistant',
        content: fullContent,
        tool_calls: response?.toolCalls,
      });

      if (response?.toolCalls?.length) {
        for (const toolCall of response.toolCalls) {
          const { success, result, error } = await this.executeTool(
            toolCall.function.name,
            toolCall.function.arguments
          );

          yield {
            type: 'tool_call',
            content: toolCall.function.name,
            data: {
              tool: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments),
              result: success ? result : error,
            },
          };

          messages.push({
            role: 'tool',
            content: success ? JSON.stringify(result) : `Error: ${error}`,
            tool_call_id: toolCall.id,
          });
        }
      } else {
        yield { type: 'complete', content: fullContent };
        break;
      }
    }
  }
}

/**
 * Create a new agent instance
 */
export function createAgent<TContext = unknown, TDeps = unknown>(
  binario: BinarioAI,
  config: AgentConfig<TContext, TDeps>
): Agent<TContext, TDeps> {
  return new Agent(binario, config);
}
