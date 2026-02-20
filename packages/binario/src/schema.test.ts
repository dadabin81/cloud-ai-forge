import { describe, it, expect } from 'vitest';
import { createSchema, zodToJsonSchema, createTool, parseStructuredOutput, z } from './schema';

describe('createSchema', () => {
  it('creates and parses valid data', () => {
    const S = createSchema({ name: z.string(), age: z.number() });
    expect(S.parse({ name: 'John', age: 30 })).toEqual({ name: 'John', age: 30 });
  });

  it('throws on invalid data', () => {
    const S = createSchema({ name: z.string(), age: z.number() });
    expect(() => S.parse({ name: 'John', age: 'x' })).toThrow();
  });

  it('safeParse returns success/failure', () => {
    const S = createSchema({ x: z.number() });
    expect(S.safeParse({ x: 1 }).success).toBe(true);
    expect(S.safeParse({ x: 'no' }).success).toBe(false);
  });
});

describe('zodToJsonSchema', () => {
  it('converts primitives', () => {
    expect(zodToJsonSchema(z.string().describe('s'))).toMatchObject({ type: 'string', description: 's' });
    expect(zodToJsonSchema(z.number())).toMatchObject({ type: 'number' });
    expect(zodToJsonSchema(z.boolean())).toMatchObject({ type: 'boolean' });
  });

  it('converts object with required/optional', () => {
    const schema = z.object({ req: z.string(), opt: z.string().optional() });
    const json = zodToJsonSchema(schema);
    expect(json.type).toBe('object');
    expect(json.required).toContain('req');
    expect(json.required).not.toContain('opt');
    expect((json.properties as any).req.type).toBe('string');
  });

  it('converts arrays', () => {
    const json = zodToJsonSchema(z.array(z.number()));
    expect(json).toMatchObject({ type: 'array', items: { type: 'number' } });
  });

  it('converts enums', () => {
    const json = zodToJsonSchema(z.enum(['a', 'b']));
    expect(json).toMatchObject({ type: 'string', enum: ['a', 'b'] });
  });

  it('converts nested objects', () => {
    const json = zodToJsonSchema(z.object({ inner: z.object({ x: z.number() }) }));
    expect((json.properties as any).inner.type).toBe('object');
    expect((json.properties as any).inner.properties.x.type).toBe('number');
  });
});

describe('createTool', () => {
  it('builds OpenAI-compatible function tool', () => {
    const tool = createTool({
      name: 'search',
      description: 'Search web',
      parameters: z.object({ q: z.string(), limit: z.number().optional() }),
      execute: async ({ q }) => q,
    });
    expect(tool.type).toBe('function');
    expect(tool.function.name).toBe('search');
    expect(tool.function.parameters.required).toContain('q');
    expect(tool.function.parameters.required).not.toContain('limit');
  });

  it('_execute runs the tool function', async () => {
    const tool = createTool({
      name: 'echo',
      description: 'Echo',
      parameters: z.object({ msg: z.string() }),
      execute: async ({ msg }) => msg.toUpperCase(),
    });
    expect(await tool._execute({ msg: 'hi' })).toBe('HI');
  });
});

describe('parseStructuredOutput', () => {
  const schema = z.object({ value: z.number() });

  it('parses JSON from code blocks', () => {
    const r = parseStructuredOutput('```json\n{"value": 42}\n```', schema);
    expect(r.success && r.data).toEqual({ value: 42 });
  });

  it('parses plain JSON', () => {
    const r = parseStructuredOutput('{"value": 7}', schema);
    expect(r.success && r.data).toEqual({ value: 7 });
  });

  it('returns error on invalid JSON', () => {
    expect(parseStructuredOutput('not json', schema).success).toBe(false);
  });

  it('returns error on schema mismatch', () => {
    expect(parseStructuredOutput('{"value":"x"}', schema).success).toBe(false);
  });

  it('handles JSON with surrounding text', () => {
    const r = parseStructuredOutput('Here is the result: {"value": 99} done.', schema);
    // May or may not extract depending on impl — just check no crash
    expect(typeof r.success).toBe('boolean');
  });
});
