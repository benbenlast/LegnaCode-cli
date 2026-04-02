import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { SLEEP_TOOL_NAME, DESCRIPTION, SLEEP_TOOL_PROMPT } from './prompt.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { hasCommandsInQueue } from '../../utils/messageQueueManager.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    duration_ms: z
      .number()
      .int()
      .min(1000)
      .max(3_600_000)
      .describe('Duration to sleep in milliseconds (1s–1h)'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    message: z.string(),
    slept_ms: z.number(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
type Output = z.infer<OutputSchema>

export const SleepTool = buildTool({
  name: SLEEP_TOOL_NAME,
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isEnabled() {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { isProactiveActive } =
      require('../../proactive/index.js') as typeof import('../../proactive/index.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    return isProactiveActive()
  },
  interruptBehavior() {
    return 'cancel' as const
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return SLEEP_TOOL_PROMPT
  },
  async call({ duration_ms }, context) {
    const { signal } = context.abortController
    const start = Date.now()

    return new Promise<{ data: Output }>(resolve => {
      const done = (reason: string) => {
        clearInterval(poll)
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        resolve({ data: { message: reason, slept_ms: Date.now() - start } })
      }

      const onAbort = () => done(`Interrupted by user after ${Date.now() - start}ms`)

      if (signal.aborted) {
        resolve({ data: { message: 'Interrupted immediately', slept_ms: 0 } })
        return
      }

      signal.addEventListener('abort', onAbort, { once: true })

      const timer = setTimeout(
        () => done(`Woke up after ${duration_ms}ms`),
        duration_ms,
      )

      // Poll every second — wake early if commands arrive in the queue
      const poll = setInterval(() => {
        if (hasCommandsInQueue()) {
          done(`Woke up early after ${Date.now() - start}ms — commands in queue`)
        }
      }, 1_000)
    })
  },
} satisfies ToolDef<InputSchema, Output>)
