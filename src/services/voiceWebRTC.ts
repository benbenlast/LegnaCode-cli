/**
 * WebRTC Voice Transport
 *
 * Provides a WebRTC-based transport layer for real-time bidirectional
 * voice communication. This is an alternative to the WebSocket-based
 * voice_stream STT endpoint, enabling lower-latency audio streaming
 * and future support for server-side TTS playback.
 *
 * NOTE: WebRTC in Node.js requires the `wrtc` or `werift` package.
 * This module degrades gracefully when no WebRTC implementation is
 * available — callers should check `isWebRTCAvailable()` first.
 */

import { logForDebugging } from "../utils/debug.js"
import { logError } from "../utils/log.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebRTCTransportConfig {
  /** Signalling server URL (WebSocket) */
  signalUrl: string
  /** ICE servers for NAT traversal */
  iceServers?: Array<{ urls: string; username?: string; credential?: string }>
  /** Audio constraints */
  audio?: {
    sampleRate?: number
    channelCount?: number
    echoCancellation?: boolean
    noiseSuppression?: boolean
  }
}

export interface WebRTCTransport {
  connect(): Promise<void>
  disconnect(): void
  sendAudio(chunk: Buffer): void
  onAudio(callback: (chunk: Buffer) => void): void
  onTranscript(callback: (text: string, isFinal: boolean) => void): void
  isConnected(): boolean
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

let webrtcModule: unknown = null
let webrtcChecked = false

/**
 * Check if a WebRTC implementation is available in the current environment.
 * Returns false in standard Node.js without `wrtc` or `werift` installed.
 */
export function isWebRTCAvailable(): boolean {
  if (webrtcChecked) return webrtcModule !== null
  webrtcChecked = true

  try {
    // Try wrtc (most common Node.js WebRTC binding)
    webrtcModule = require("wrtc")
    logForDebugging("[webrtc] wrtc module available")
    return true
  } catch {
    // Not available
  }

  try {
    // Try werift (pure TypeScript WebRTC)
    webrtcModule = require("werift")
    logForDebugging("[webrtc] werift module available")
    return true
  } catch {
    // Not available
  }

  logForDebugging("[webrtc] No WebRTC module available — WebRTC transport disabled")
  return false
}

// ---------------------------------------------------------------------------
// Stub transport (returned when WebRTC is unavailable)
// ---------------------------------------------------------------------------

class StubWebRTCTransport implements WebRTCTransport {
  async connect(): Promise<void> {
    throw new Error("WebRTC is not available. Install `wrtc` or `werift` package.")
  }
  disconnect(): void {}
  sendAudio(): void {}
  onAudio(): void {}
  onTranscript(): void {}
  isConnected(): boolean { return false }
}

// ---------------------------------------------------------------------------
// Real transport (uses wrtc/werift when available)
// ---------------------------------------------------------------------------

class NodeWebRTCTransport implements WebRTCTransport {
  private config: WebRTCTransportConfig
  private connected = false
  private audioCallbacks: Array<(chunk: Buffer) => void> = []
  private transcriptCallbacks: Array<(text: string, isFinal: boolean) => void> = []
  private ws: import("ws").WebSocket | null = null
  private pc: any = null // RTCPeerConnection

  constructor(config: WebRTCTransportConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    if (!webrtcModule) {
      throw new Error("WebRTC module not loaded")
    }

    const wrtc = webrtcModule as any
    const RTCPeerConnection = wrtc.RTCPeerConnection || wrtc.PeerConnection

    // Create peer connection
    this.pc = new RTCPeerConnection({
      iceServers: this.config.iceServers ?? [
        { urls: "stun:stun.l.google.com:19302" },
      ],
    })

    // Handle incoming audio tracks
    this.pc.ontrack = (event: any) => {
      logForDebugging("[webrtc] Received remote track")
      // In a full implementation, decode audio from the track
      // and pass to audioCallbacks
    }

    // Connect to signalling server
    const WebSocket = (await import("ws")).default
    this.ws = new WebSocket(this.config.signalUrl)

    await new Promise<void>((resolve, reject) => {
      this.ws!.on("open", () => {
        logForDebugging("[webrtc] Signalling WebSocket connected")
        resolve()
      })
      this.ws!.on("error", (err) => {
        logError(err)
        reject(err)
      })
    })

    // Handle signalling messages
    this.ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === "answer" && this.pc) {
          await this.pc.setRemoteDescription(msg.sdp)
        } else if (msg.type === "ice-candidate" && this.pc) {
          await this.pc.addIceCandidate(msg.candidate)
        } else if (msg.type === "transcript") {
          for (const cb of this.transcriptCallbacks) {
            cb(msg.text, msg.isFinal ?? false)
          }
        }
      } catch (err) {
        logForDebugging(`[webrtc] Signalling message parse error: ${err}`)
      }
    })

    // Send ICE candidates to signalling server
    this.pc.onicecandidate = (event: any) => {
      if (event.candidate && this.ws?.readyState === 1) {
        this.ws.send(JSON.stringify({
          type: "ice-candidate",
          candidate: event.candidate,
        }))
      }
    }

    // Create and send offer
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true })
    await this.pc.setLocalDescription(offer)
    this.ws.send(JSON.stringify({ type: "offer", sdp: offer }))

    this.connected = true
    logForDebugging("[webrtc] Transport connected")
  }

  disconnect(): void {
    this.connected = false
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.audioCallbacks = []
    this.transcriptCallbacks = []
    logForDebugging("[webrtc] Transport disconnected")
  }

  sendAudio(chunk: Buffer): void {
    // In a full implementation, send audio through a DataChannel
    // or an audio track on the peer connection
    if (this.ws?.readyState === 1) {
      this.ws.send(chunk)
    }
  }

  onAudio(callback: (chunk: Buffer) => void): void {
    this.audioCallbacks.push(callback)
  }

  onTranscript(callback: (text: string, isFinal: boolean) => void): void {
    this.transcriptCallbacks.push(callback)
  }

  isConnected(): boolean {
    return this.connected
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a WebRTC transport. Returns a stub if WebRTC is not available.
 */
export function createWebRTCTransport(
  config: WebRTCTransportConfig,
): WebRTCTransport {
  if (!isWebRTCAvailable()) {
    return new StubWebRTCTransport()
  }
  return new NodeWebRTCTransport(config)
}
