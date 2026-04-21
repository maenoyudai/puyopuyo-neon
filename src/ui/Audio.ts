// Procedural audio using Web Audio API
let ctx: AudioContext | null = null
let muted = false

export function setMuted(value: boolean): void { muted = value }
export function isMuted(): boolean { return muted }

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function beep(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15): void {
  if (muted) return
  try {
    const ac = getCtx()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(vol, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur)
    osc.start(ac.currentTime)
    osc.stop(ac.currentTime + dur)
  } catch { /* ignore audio errors */ }
}

export const Audio = {
  move()    { beep(220, 0.05, 'square', 0.08) },
  rotate()  { beep(330, 0.06, 'square', 0.08) },
  land()    { beep(110, 0.12, 'triangle', 0.12) },
  pop(chain: number) {
    const freqs = [523, 659, 784, 988, 1175]
    for (let i = 0; i < Math.min(chain, freqs.length); i++) {
      setTimeout(() => beep(freqs[i], 0.15, 'sine', 0.15), i * 60)
    }
  },
  gameOver() { beep(110, 0.8, 'sawtooth', 0.2) },
}
