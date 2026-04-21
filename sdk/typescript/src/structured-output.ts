/**
 * Structured output helpers — Zod and raw JSON Schema support.
 *
 * Validates that the LLM response conforms to the provided schema.
 */

import type { ThreadConfig, TurnResult } from './types.js'

type ZodType<T = unknown> = {
  parse(data: unknown): T
  _output: T
}

/**
 * Create a ThreadConfig with Zod-based structured output.
 * The schema is converted to JSON Schema for the wire protocol,
 * and the response is validated with Zod on the client side.
 */
export function withStructuredOutput<T>(
  schema: ZodType<T>,
  base?: Partial<ThreadConfig>,
): ThreadConfig & { __zodSchema: ZodType<T> } {
  // Attempt to use zod-to-json-schema if available, otherwise pass raw
  let jsonSchema: Record<string, unknown>
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { zodToJsonSchema } = require('zod-to-json-schema')
    jsonSchema = zodToJsonSchema(schema) as Record<string, unknown>
  } catch {
    // Fallback: caller must ensure schema has a .jsonSchema property
    jsonSchema = (schema as unknown as { jsonSchema: Record<string, unknown> }).jsonSchema ?? {}
  }

  return {
    ...base,
    structuredOutput: { schema: jsonSchema },
    __zodSchema: schema,
  }
}

/**
 * Create a ThreadConfig with raw JSON Schema structured output.
 */
export function withJsonSchema(
  schema: Record<string, unknown>,
  base?: Partial<ThreadConfig>,
): ThreadConfig {
  return {
    ...base,
    structuredOutput: { schema },
  }
}

/**
 * Validate a TurnResult's structured output against a Zod schema.
 * Returns the parsed value or throws a ZodError.
 */
export function validateStructuredOutput<T>(
  result: TurnResult,
  schema: ZodType<T>,
): T {
  if (result.structuredOutput === undefined) {
    throw new Error('No structured output in turn result')
  }
  return schema.parse(result.structuredOutput)
}
