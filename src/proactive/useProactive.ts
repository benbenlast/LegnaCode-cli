// Proactive tick hook — drives the autonomous <tick> loop in the REPL.
import { useEffect, useRef } from 'react'
import { TICK_TAG } from '../constants/xml.js'
import {
  isProactiveActive,
  isTickingSuppressed,
  getTickInterval,
  subscribeToProactiveChanges,
} from './index.js'

type UseProactiveOptions = {
  isLoading: boolean
  queuedCommandsLength: number
  hasActiveLocalJsxUI: boolean
  isInPlanMode: boolean
  onSubmitTick: (prompt: string) => void
  onQueueTick: (prompt: string) => void
}

export function useProactive(opts: UseProactiveOptions): void {
  const {
    isLoading,
    queuedCommandsLength,
    hasActiveLocalJsxUI,
    isInPlanMode,
    onSubmitTick,
    onQueueTick,
  } = opts

  // Keep latest callbacks in refs so the interval closure always sees them
  const onSubmitRef = useRef(onSubmitTick)
  const onQueueRef = useRef(onQueueTick)
  onSubmitRef.current = onSubmitTick
  onQueueRef.current = onQueueTick

  useEffect(() => {
    if (!isProactiveActive()) return
    if (hasActiveLocalJsxUI || isInPlanMode) return

    // Suppress ticks when paused or context-blocked
    if (isTickingSuppressed()) return

    const interval = getTickInterval()

    const sendTick = () => {
      if (!isProactiveActive() || isTickingSuppressed()) return
      const now = new Date().toLocaleString()
      const tickMessage = `<${TICK_TAG}>${now}</${TICK_TAG}>`

      if (isLoading || queuedCommandsLength > 0) {
        // Model is busy — queue the tick for later
        onQueueRef.current(tickMessage)
      } else {
        // Model is idle — submit directly
        onSubmitRef.current(tickMessage)
      }
    }

    // Send an initial tick when transitioning to idle
    if (!isLoading && queuedCommandsLength === 0) {
      sendTick()
    }

    const handle = setInterval(sendTick, interval)
    // Also listen for proactive state changes to clean up early
    const unsub = subscribeToProactiveChanges(() => {
      if (!isProactiveActive() || isTickingSuppressed()) {
        clearInterval(handle)
      }
    })

    return () => {
      clearInterval(handle)
      unsub()
    }
  }, [isLoading, queuedCommandsLength, hasActiveLocalJsxUI, isInPlanMode])
}
