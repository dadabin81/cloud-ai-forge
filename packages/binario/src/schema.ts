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
  const def = schema._def as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  // Extract description - check both _def.description and schema.description
  const desc = (def && def.description) || (schema as any).description;
  if (desc && typeof desc === 'string') {
    result.description = desc;
  }

  // Use instanceof checks for robustness across zod versions
  if (schema instanceof z.ZodString) {
    result.type = 'string';
  } else if (schema instanceof z.ZodNumber) {
    result.type = 'number';
  } else if (schema instanceof z.ZodBoolean) {
    result.type = 'boolean';
  } else if (schema instanceof z.ZodArray) {
    result.type = 'array';
    // Zod 3.25+ uses 'element', older versions use 'type'
    const innerType = def.type || def.element || (schema as any)._def?.type || (schema as any).element;
    if (innerType) {
      result.items = convertZodToJson(innerType as z.ZodType<unknown>);
    }
  } else if (schema instanceof z.ZodObject) {
    result.type = 'object';
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = convertZodToJson(value as z.ZodType<unknown>);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    result.properties = properties;
    if (required.length > 0) {
      result.required = required;
    }
  } else if (schema instanceof z.ZodEnum) {
    result.type = 'string';
    // Zod 3.25+ may store values differently
    result.enum = (def.values as string[]) || (schema as any).options || (schema as any)._def?.values;
  } else if (schema instanceof z.ZodOptional) {
    return convertZodToJson((schema as z.ZodOptional<z.ZodType<unknown>>)._def.innerType);
  } else if (schema instanceof z.ZodNullable) {
    const inner = convertZodToJson((schema as z.ZodNullable<z.ZodType<unknown>>)._def.innerType);
    return { ...inner, nullable: true };
  } else if (schema instanceof z.ZodDefault) {
    const defaultDef = (schema as z.ZodDefault<z.ZodType<unknown>>)._def;
    const inner = convertZodToJson(defaultDef.innerType);
    return { ...inner, default: defaultDef.defaultValue() };
  } else if (schema instanceof z.ZodUnion) {
    result.oneOf = ((schema as z.ZodUnion<[z.ZodType<unknown>, ...z.ZodType<unknown>[]]>)._def.options as z.ZodType<unknown>[]).map(convertZodToJson);
  } else if (schema instanceof z.ZodLiteral) {
    result.const = (schema as z.ZodLiteral<unknown>)._def.value;
  } else if (schema instanceof z.ZodRecord) {
    result.type = 'object';
    result.additionalProperties = convertZodToJson((schema as z.ZodRecord<z.ZodString, z.ZodType<unknown>>)._def.valueType);
  } else if (schema instanceof z.ZodTuple) {
    result.type = 'array';
    result.items = ((schema as z.ZodTuple)._def.items as z.ZodType<unknown>[]).map(convertZodToJson);
  } else {
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
