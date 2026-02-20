import { describe, it, expect, vi } from 'vitest';
import { defineTool, Agent, createAgent } from './agent';
import { BinarioAI } from './core';
import { z } from './schema';
import type { ChatResponse } from './types';

function makeMockBinario(responses: Partial<ChatResponse>[]) {
  let callIndex = 0;
  return {
    chat: vi.fn().mockImplementation(async () => {
      const resp = responses[callIndex++] || responses[responses.length - 1];
      return {
        id: 'r' + callIndex,
        provider: 'cloudflare',
        model: 'test',
        content: resp.content ?? '',
        toolCalls: resp.toolCalls,
        usage: resp.usage ?? { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        latency: 10,
        cached: false,
        ...resp,
      };
    }),
    streamChat: vi.fn(),
    clearCache: vi.fn(),
  } as unknown as BinarioAI;
}

describe('defineTool', () => {
  it('creates a tool with all properties', () => {
    const tool = defineTool({
      name: 'calc',
      description: 'Calculate',
      parameters: z.object({ a: z.number(), b: z.number() }),
      execute: async ({ a, b }) => a + b,
    });
    expect(tool.name).toBe('calc');
    expect(typeof tool.execute).toBe('function');
  });

  it('executes correctly', async () => {
    const tool = defineTool({
      name: 'add',
      description: 'Add',
      parameters: z.object({ a: z.number(), b: z.number() }),
      execute: async ({ a, b }) => a + b,
    });
    expect(await tool.execute({ a: 3, b: 7 }, {})).toBe(10);
  });
});

describe('Agent', () => {
  it('runs single-step without tools', async () => {
    const binario = makeMockBinario([{ content: 'Hello there!' }]);
    const agent = new Agent(binario, { systemPrompt: 'Be nice', tools: [] });
    const result = await agent.run('Hi');
    expect(result.output).toBe('Hello there!');
    expect(result.iterations).toBe(1);
    expect(binario.chat).toHaveBeenCalledTimes(1);
  });

  it('executes tool calls in multi-step', async () => {
    const calcTool = defineTool({
      name: 'add',
      description: 'Add two numbers',
      parameters: z.object({ a: z.number(), b: z.number() }),
      execute: async ({ a, b }) => a + b,
    });

    const binario = makeMockBinario([
      {
        content: 'Let me calculate.',
        toolCalls: [{ id: 'tc1', type: 'function', function: { name: 'add', arguments: '{"a":2,"b":3}' } }],
      },
      { content: 'The answer is 5.' },
    ]);

    const onToolCall = vi.fn();
    const agent = new Agent(binario, { systemPrompt: 'Calculator', tools: [calcTool] });
    const result = await agent.run('2+3', { onToolCall });

    expect(result.output).toBe('The answer is 5.');
    expect(result.iterations).toBe(2);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].result).toBe(5);
    expect(onToolCall).toHaveBeenCalledWith('add', { a: 2, b: 3 }, 5);
  });

  it('handles tool not found gracefully', async () => {
    const binario = makeMockBinario([
      {
        content: '',
        toolCalls: [{ id: 'tc1', type: 'function', function: { name: 'missing', arguments: '{}' } }],
      },
      { content: 'Tool not found, sorry.' },
    ]);

    const agent = new Agent(binario, { systemPrompt: 'Test', tools: [] });
    const result = await agent.run('Use missing tool');
    expect(result.toolCalls[0].result).toContain('not found');
  });

  it('respects maxIterations', async () => {
    // Always returns tool calls → should stop after max
    const tool = defineTool({
      name: 'loop',
      description: 'Loop',
      parameters: z.object({}),
      execute: async () => 'looped',
    });

    const binario = makeMockBinario([
      { content: '', toolCalls: [{ id: 'tc', type: 'function', function: { name: 'loop', arguments: '{}' } }] },
    ]);

    const agent = new Agent(binario, { systemPrompt: 'Test', tools: [tool], maxIterations: 3 });
    const result = await agent.run('Loop forever');
    expect(result.iterations).toBeLessThanOrEqual(3);
  });

  it('accumulates usage across iterations', async () => {
    const tool = defineTool({
      name: 't',
      description: 't',
      parameters: z.object({}),
      execute: async () => 'ok',
    });

    const binario = makeMockBinario([
      {
        content: '',
        toolCalls: [{ id: 'tc', type: 'function', function: { name: 't', arguments: '{}' } }],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      },
      {
        content: 'Done',
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
      },
    ]);

    const agent = new Agent(binario, { systemPrompt: 'Test', tools: [tool] });
    const result = await agent.run('Go');
    expect(result.usage.totalTokens).toBe(450);
  });

  it('supports abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const binario = makeMockBinario([{ content: 'nope' }]);
    const agent = new Agent(binario, { systemPrompt: 'Test', tools: [] });
    await expect(agent.run('Hi', { signal: controller.signal })).rejects.toThrow('aborted');
  });

  it('withContext creates new agent with context', async () => {
    const binario = makeMockBinario([{ content: 'ok' }]);
    const agent = new Agent(binario, {
      systemPrompt: (ctx: { name: string }) => `Hello ${ctx.name}`,
      tools: [],
    });
    const contextual = agent.withContext({ name: 'Alice' });
    expect(contextual).toBeInstanceOf(Agent);
    expect(contextual).not.toBe(agent);
  });

  it('runStructured parses JSON output', async () => {
    const binario = makeMockBinario([{ content: '```json\n{"value": 42}\n```' }]);
    const agent = new Agent(binario, { systemPrompt: 'Respond JSON', tools: [] });
    const result = await agent.runStructured('Give me a number', z.object({ value: z.number() }));
    expect(result.output).toEqual({ value: 42 });
  });

  it('runStructured throws on invalid output', async () => {
    const binario = makeMockBinario([{ content: 'not json' }]);
    const agent = new Agent(binario, { systemPrompt: 'Test', tools: [] });
    await expect(agent.runStructured('x', z.object({ v: z.number() }))).rejects.toThrow('parse');
  });
});

describe('createAgent', () => {
  it('returns Agent instance', () => {
    const binario = makeMockBinario([]);
    expect(createAgent(binario, { systemPrompt: 'Test', tools: [] })).toBeInstanceOf(Agent);
  });
});
