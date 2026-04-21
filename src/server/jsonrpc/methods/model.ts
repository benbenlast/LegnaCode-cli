/**
 * JSON-RPC model methods — list available models and capabilities.
 */

import type { JsonRpcRouter } from '../router.js'

export function registerModelMethods(router: JsonRpcRouter): void {
  router.register('model/list', async () => {
    return {
      models: [
        {
          id: 'claude-sonnet-4-20250514',
          name: 'Claude Sonnet 4',
          provider: 'anthropic',
          capabilities: ['chat', 'tools', 'vision', 'extended_thinking'],
          contextWindow: 200_000,
          maxOutput: 16_384,
        },
        {
          id: 'claude-opus-4-20250514',
          name: 'Claude Opus 4',
          provider: 'anthropic',
          capabilities: ['chat', 'tools', 'vision', 'extended_thinking'],
          contextWindow: 200_000,
          maxOutput: 32_768,
        },
        {
          id: 'claude-haiku-3-5-20241022',
          name: 'Claude 3.5 Haiku',
          provider: 'anthropic',
          capabilities: ['chat', 'tools', 'vision'],
          contextWindow: 200_000,
          maxOutput: 8_192,
        },
      ],
    }
  })
}
