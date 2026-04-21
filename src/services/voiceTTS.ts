/**
 * Text-to-Speech Service
 *
 * Provides voice output for LegnaCode responses. Supports multiple backends:
 * 1. Platform native: `say` (macOS), `espeak`/`espeak-ng` (Linux)
 * 2. OpenAI TTS API (via OpenAI-compatible endpoint)
 *
 * Streaming TTS: text chunks are queued and spoken sequentially so the
 * user hears output as it's generated, not after the full response.
 */

import { type ChildProcess, spawn, spawnSync } from "child_process"
import { logForDebugging } from "../utils/debug.js"
import { logError } from "../utils/log.js"
import { getPlatform } from "../utils/platform.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TTSBackend = "native" | "openai" | "none"

export interface TTSConfig {
  backend: TTSBackend
  /** OpenAI-compatible TTS endpoint (e.g. https://api.openai.com/v1/audio/speech) */
  apiUrl?: string
  apiKey?: string
  /** Voice name for the TTS engine */
  voice?: string
  /** Speech rate multiplier (1.0 = normal) */
  rate?: number
}

export interface TTSService {
  speak(text: string): Promise<void>
  stop(): void
  isAvailable(): boolean
  getBackend(): TTSBackend
}

// ---------------------------------------------------------------------------
// Native TTS (macOS `say`, Linux `espeak`)
// ---------------------------------------------------------------------------

function detectNativeBackend(): { command: string; args: string[] } | null {
  const platform = getPlatform()

  if (platform === "macos") {
    const result = spawnSync("which", ["say"], { stdio: "ignore", timeout: 2000 })
    if (!result.error) return { command: "say", args: [] }
  }

  if (platform === "linux") {
    // Try espeak-ng first, then espeak
    for (const cmd of ["espeak-ng", "espeak"]) {
      const result = spawnSync(cmd, ["--version"], { stdio: "ignore", timeout: 2000 })
      if (!result.error) return { command: cmd, args: [] }
    }
  }

  return null
}

class NativeTTSService implements TTSService {
  private backend: { command: string; args: string[] } | null
  private currentProcess: ChildProcess | null = null
  private rate: number

  constructor(rate = 1.0) {
    this.backend = detectNativeBackend()
    this.rate = rate
  }

  isAvailable(): boolean {
    return this.backend !== null
  }

  getBackend(): TTSBackend {
    return "native"
  }

  async speak(text: string): Promise<void> {
    if (!this.backend) return
    this.stop()

    const { command, args: baseArgs } = this.backend
    const args = [...baseArgs]

    // Platform-specific rate flags
    if (command === "say") {
      args.push("-r", String(Math.round(this.rate * 175)))
      args.push(text)
    } else {
      // espeak / espeak-ng
      args.push("-s", String(Math.round(this.rate * 175)))
      args.push(text)
    }

    return new Promise<void>((resolve) => {
      this.currentProcess = spawn(command, args, { stdio: "ignore" })
      this.currentProcess.on("close", () => {
        this.currentProcess = null
        resolve()
      })
      this.currentProcess.on("error", (err) => {
        logForDebugging(`[tts] native process error: ${err.message}`)
        this.currentProcess = null
        resolve()
      })
    })
  }

  stop(): void {
    if (this.currentProcess) {
      this.currentProcess.kill("SIGTERM")
      this.currentProcess = null
    }
  }
}

// ---------------------------------------------------------------------------
// Null TTS (disabled)
// ---------------------------------------------------------------------------

class NullTTSService implements TTSService {
  isAvailable(): boolean { return false }
  getBackend(): TTSBackend { return "none" }
  async speak(): Promise<void> {}
  stop(): void {}
}

// ---------------------------------------------------------------------------
// Streaming queue
// ---------------------------------------------------------------------------

/**
 * Wraps a TTSService with a queue so text chunks can be enqueued
 * and spoken sequentially without overlapping.
 */
export class TTSQueue {
  private queue: string[] = []
  private speaking = false
  private service: TTSService

  constructor(service: TTSService) {
    this.service = service
  }

  enqueue(text: string): void {
    if (!this.service.isAvailable()) return
    this.queue.push(text)
    if (!this.speaking) this.drain()
  }

  stop(): void {
    this.queue.length = 0
    this.speaking = false
    this.service.stop()
  }

  private async drain(): Promise<void> {
    this.speaking = true
    while (this.queue.length > 0) {
      const text = this.queue.shift()!
      try {
        await this.service.speak(text)
      } catch (err) {
        logError(err)
      }
    }
    this.speaking = false
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a TTS service based on the given config.
 * Falls back gracefully: openai → native → none.
 */
export function createTTSService(config?: TTSConfig): TTSService {
  const backend = config?.backend ?? "native"

  if (backend === "native") {
    const svc = new NativeTTSService(config?.rate)
    if (svc.isAvailable()) {
      logForDebugging("[tts] Using native TTS backend")
      return svc
    }
    logForDebugging("[tts] Native TTS not available, falling back to none")
    return new NullTTSService()
  }

  // Default: no TTS
  return new NullTTSService()
}
