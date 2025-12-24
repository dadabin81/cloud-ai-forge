import { describe, it, expect } from 'vitest';
import { createSchema, zodToJsonSchema, createTool, parseStructuredOutput, z } from './schema';

describe('Schema System', () => {
  describe('createSchema', () => {
    it('should create a schema with name and description', () => {
      const UserSchema = createSchema('User', z.object({
        name: z.string().describe('User name'),
        age: z.number().describe('User age'),
      }));

      expect(UserSchema.name).toBe('User');
      expect(UserSchema.schema).toBeDefined();
    });

    it('should parse valid data', () => {
      const UserSchema = createSchema('User', z.object({
        name: z.string(),
        age: z.number(),
      }));

      const result = UserSchema.parse({ name: 'John', age: 30 });
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should throw on invalid data', () => {
      const UserSchema = createSchema('User', z.object({
        name: z.string(),
        age: z.number(),
      }));

      expect(() => UserSchema.parse({ name: 'John', age: 'invalid' })).toThrow();
    });

    it('should safely parse with safeParse', () => {
      const UserSchema = createSchema('User', z.object({
        name: z.string(),
        age: z.number(),
      }));

      const success = UserSchema.safeParse({ name: 'John', age: 30 });
      expect(success.success).toBe(true);

      const failure = UserSchema.safeParse({ name: 'John', age: 'invalid' });
      expect(failure.success).toBe(false);
    });
  });

  describe('zodToJsonSchema', () => {
    it('should convert string schema', () => {
      const schema = z.string().describe('A test string');
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.type).toBe('string');
      expect(jsonSchema.description).toBe('A test string');
    });

    it('should convert number schema', () => {
      const schema = z.number().describe('A test number');
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.type).toBe('number');
    });

    it('should convert boolean schema', () => {
      const schema = z.boolean();
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.type).toBe('boolean');
    });

    it('should convert object schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toBeDefined();
      expect(jsonSchema.properties.name.type).toBe('string');
      expect(jsonSchema.properties.age.type).toBe('number');
    });

    it('should handle optional fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.required).toContain('required');
      expect(jsonSchema.required).not.toContain('optional');
    });

    it('should convert array schema', () => {
      const schema = z.array(z.string());
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.type).toBe('array');
      expect(jsonSchema.items.type).toBe('string');
    });

    it('should convert enum schema', () => {
      const schema = z.enum(['a', 'b', 'c']);
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.type).toBe('string');
      expect(jsonSchema.enum).toEqual(['a', 'b', 'c']);
    });
  });

  describe('createTool', () => {
    it('should create a tool with correct structure', () => {
      const tool = createTool({
        name: 'test_tool',
        description: 'A test tool',
        parameters: z.object({
          input: z.string().describe('Input value'),
        }),
      });

      expect(tool.name).toBe('test_tool');
      expect(tool.description).toBe('A test tool');
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.properties.input).toBeDefined();
    });

    it('should include required fields', () => {
      const tool = createTool({
        name: 'test',
        description: 'Test',
        parameters: z.object({
          required: z.string(),
          optional: z.number().optional(),
        }),
      });

      expect(tool.parameters.required).toContain('required');
      expect(tool.parameters.required).not.toContain('optional');
    });
  });

  describe('parseStructuredOutput', () => {
    it('should parse JSON from code blocks', () => {
      const schema = z.object({ value: z.number() });
      const input = '```json\n{"value": 42}\n```';
      
      const result = parseStructuredOutput(input, schema);
      expect(result).toEqual({ value: 42 });
    });

    it('should parse plain JSON', () => {
      const schema = z.object({ value: z.number() });
      const input = '{"value": 42}';
      
      const result = parseStructuredOutput(input, schema);
      expect(result).toEqual({ value: 42 });
    });

    it('should throw on invalid JSON', () => {
      const schema = z.object({ value: z.number() });
      const input = 'not json at all';
      
      expect(() => parseStructuredOutput(input, schema)).toThrow();
    });

    it('should validate against schema', () => {
      const schema = z.object({ value: z.number() });
      const input = '{"value": "not a number"}';
      
      expect(() => parseStructuredOutput(input, schema)).toThrow();
    });
  });
});
