// Binario Schema System - Pydantic-style type-safe validation
import { z } from 'zod';

/**
 * Create a type-safe output schema for structured LLM responses
 * Similar to Pydantic models in Python
 * 
 * @example
 * const RecipeSchema = createSchema({
 *   name: z.string().describe('Recipe name'),
 *   ingredients: z.array(z.string()).describe('List of ingredients'),
 *   cookTime: z.number().describe('Cooking time in minutes'),
 *   difficulty: z.enum(['easy', 'medium', 'hard']),
 * });
 * 
 * const result = await binario.chat(messages, {
 *   outputSchema: RecipeSchema,
 * });
 * // result.data is typed as { name: string; ingredients: string[]; ... }
 */
export function createSchema<T extends z.ZodRawShape>(shape: T): z.ZodObject<T> {
  return z.object(shape);
}

/**
 * Convert a Zod schema to JSON Schema for LLM function calling
 */
export function zodToJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
  return convertZodToJson(schema);
}

function convertZodToJson(schema: z.ZodType<unknown>): Record<string, unknown> {
  const def = schema._def as { typeName?: string; description?: string };
  const typeName = def.typeName;

  const result: Record<string, unknown> = {};

  if (def.description) {
    result.description = def.description;
  }

  switch (typeName) {
    case 'ZodString':
      result.type = 'string';
      break;

    case 'ZodNumber':
      result.type = 'number';
      break;

    case 'ZodBoolean':
      result.type = 'boolean';
      break;

    case 'ZodArray': {
      const arrayDef = def as { typeName: string; type: z.ZodType<unknown> };
      result.type = 'array';
      result.items = convertZodToJson(arrayDef.type);
      break;
    }

    case 'ZodObject': {
      const objectDef = def as { typeName: string; shape: () => Record<string, z.ZodType<unknown>> };
      result.type = 'object';
      const shape = objectDef.shape();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convertZodToJson(value);
        // Check if the field is optional
        const valueDef = (value as z.ZodType<unknown>)._def as { typeName?: string };
        if (valueDef.typeName !== 'ZodOptional') {
          required.push(key);
        }
      }

      result.properties = properties;
      if (required.length > 0) {
        result.required = required;
      }
      break;
    }

    case 'ZodEnum': {
      const enumDef = def as { typeName: string; values: string[] };
      result.type = 'string';
      result.enum = enumDef.values;
      break;
    }

    case 'ZodOptional': {
      const optionalDef = def as { typeName: string; innerType: z.ZodType<unknown> };
      return convertZodToJson(optionalDef.innerType);
    }

    case 'ZodNullable': {
      const nullableDef = def as { typeName: string; innerType: z.ZodType<unknown> };
      const inner = convertZodToJson(nullableDef.innerType);
      return { ...inner, nullable: true };
    }

    case 'ZodDefault': {
      const defaultDef = def as { typeName: string; innerType: z.ZodType<unknown>; defaultValue: () => unknown };
      const inner = convertZodToJson(defaultDef.innerType);
      return { ...inner, default: defaultDef.defaultValue() };
    }

    case 'ZodUnion': {
      const unionDef = def as { typeName: string; options: z.ZodType<unknown>[] };
      result.oneOf = unionDef.options.map(convertZodToJson);
      break;
    }

    case 'ZodLiteral': {
      const literalDef = def as { typeName: string; value: unknown };
      result.const = literalDef.value;
      break;
    }

    case 'ZodRecord': {
      const recordDef = def as { typeName: string; valueType: z.ZodType<unknown> };
      result.type = 'object';
      result.additionalProperties = convertZodToJson(recordDef.valueType);
      break;
    }

    case 'ZodTuple': {
      const tupleDef = def as { typeName: string; items: z.ZodType<unknown>[] };
      result.type = 'array';
      result.items = tupleDef.items.map(convertZodToJson);
      break;
    }

    default:
      result.type = 'string'; // Fallback
  }

  return result;
}

/**
 * Create a function tool from a Zod schema
 * For use with LLM function calling
 */
export function createTool<T>(config: {
  name: string;
  description: string;
  parameters: z.ZodType<T>;
  execute: (args: T) => Promise<unknown> | unknown;
}) {
  return {
    type: 'function' as const,
    function: {
      name: config.name,
      description: config.description,
      parameters: zodToJsonSchema(config.parameters),
    },
    _execute: config.execute,
    _schema: config.parameters,
  };
}

/**
 * Parse and validate LLM response against schema
 */
export function parseStructuredOutput<T>(
  content: string,
  schema: z.ZodType<T>
): { success: true; data: T } | { success: false; error: z.ZodError } {
  try {
    // Try to extract JSON from markdown code blocks
    let jsonStr = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    const validated = schema.parse(parsed);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error };
    }
    // JSON parse error - wrap in ZodError
    return {
      success: false,
      error: new z.ZodError([
        {
          code: 'custom',
          message: `Failed to parse JSON: ${(error as Error).message}`,
          path: [],
        },
      ]),
    };
  }
}

/**
 * Infer TypeScript type from Zod schema
 */
export type InferSchema<T extends z.ZodType> = z.infer<T>;

// Re-export zod for convenience
export { z };
