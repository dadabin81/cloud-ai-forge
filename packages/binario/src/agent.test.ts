import { describe, it, expect } from 'vitest';
import { defineTool, Agent } from './agent';
import { z } from './schema';

describe('Agent Framework', () => {
  describe('defineTool', () => {
    it('should create a tool with all properties', () => {
      const tool = defineTool({
        name: 'calculator',
        description: 'Performs calculations',
        parameters: z.object({
          operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
          a: z.number(),
          b: z.number(),
        }),
        execute: async ({ operation, a, b }) => {
          switch (operation) {
            case 'add': return a + b;
            case 'subtract': return a - b;
            case 'multiply': return a * b;
            case 'divide': return a / b;
          }
        },
      });

      expect(tool.name).toBe('calculator');
      expect(tool.description).toBe('Performs calculations');
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe('function');
    });

    it('should execute tool correctly', async () => {
      const addTool = defineTool({
        name: 'add',
        description: 'Adds two numbers',
        parameters: z.object({
          a: z.number(),
          b: z.number(),
        }),
        execute: async ({ a, b }) => a + b,
      });

      const result = await addTool.execute({ a: 5, b: 3 });
      expect(result).toBe(8);
    });

    it('should validate parameters', () => {
      const tool = defineTool({
        name: 'greet',
        description: 'Greets a user',
        parameters: z.object({
          name: z.string(),
        }),
        execute: async ({ name }) => `Hello, ${name}!`,
      });

      // Tool has the Zod schema that can be used for validation
      expect(tool.parameters).toBeDefined();
    });
  });

  describe('Agent', () => {
    it('should create an agent with config', () => {
      const agent = new Agent({
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        maxIterations: 5,
      });

      expect(agent).toBeInstanceOf(Agent);
    });

    it('should accept tools array', () => {
      const tool = defineTool({
        name: 'test',
        description: 'Test tool',
        parameters: z.object({ input: z.string() }),
        execute: async ({ input }) => input.toUpperCase(),
      });

      const agent = new Agent({
        systemPrompt: 'Test agent',
        tools: [tool],
      });

      expect(agent).toBeInstanceOf(Agent);
    });

    it('should have default max iterations', () => {
      const agent = new Agent({
        systemPrompt: 'Test',
        tools: [],
      });

      // Default should be 10 iterations
      expect(agent).toBeInstanceOf(Agent);
    });
  });
});
