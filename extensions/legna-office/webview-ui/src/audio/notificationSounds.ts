/**
 * LegnaCode Office — Notification Sounds
 *
 * Plays short audio cues when agent state changes.
 * Uses Web Audio API oscillator tones (no external audio files needed).
 * Respects user sound preference from settings.
 */

let _enabled = true;
let _audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (!_enabled) return null;
  if (!_audioCtx) {
    try { _audioCtx = new AudioContext(); } catch { return null; }
  }
  return _audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15): void {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

/** Agent started working (tool call) */
export function playToolStart(): void {
  playTone(880, 0.08, 'sine', 0.1);
}

/** Agent finished a turn */
export function playTurnEnd(): void {
  playTone(660, 0.12, 'sine', 0.12);
  setTimeout(() => playTone(880, 0.12, 'sine', 0.12), 130);
}

/** Agent encountered an error */
export function playError(): void {
  playTone(220, 0.2, 'square', 0.1);
  setTimeout(() => playTone(180, 0.25, 'square', 0.1), 220);
}

/** Permission request (needs user attention) */
export function playPermission(): void {
  playTone(587, 0.1, 'triangle', 0.15);
  setTimeout(() => playTone(784, 0.1, 'triangle', 0.15), 120);
  setTimeout(() => playTone(1047, 0.15, 'triangle', 0.15), 240);
}

/** Agent went idle */
export function playIdle(): void {
  playTone(440, 0.15, 'sine', 0.06);
}

export function setSoundEnabled(enabled: boolean): void {
  _enabled = enabled;
  if (!enabled && _audioCtx) {
    _audioCtx.close();
    _audioCtx = null;
  }
}

export function isSoundEnabled(): boolean {
  return _enabled;
}
