// Subtle UI sounds synthesized with the Web Audio API (no audio files).
// Kept very quiet + short so they feel like soft tactile feedback.

let ctx: AudioContext | null = null
let muted = (() => {
  try {
    return localStorage.getItem('mh.sound') === 'off'
  } catch {
    return false
  }
})()

function getCtx(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface ToneOpts {
  freq: number
  type?: OscillatorType
  dur?: number
  gain?: number
  freqTo?: number
  delay?: number
}

function tone({ freq, type = 'sine', dur = 0.08, gain = 0.05, freqTo, delay = 0 }: ToneOpts) {
  const c = getCtx()
  if (!c) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (freqTo) osc.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur)
  // soft attack + exponential release so there are no clicks/pops
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.03)
}

export const sound = {
  click: () => tone({ freq: 400, type: 'sine', dur: 0.045, gain: 0.05 }),
  toggle: () => tone({ freq: 520, type: 'sine', dur: 0.05, gain: 0.055 }),
  open: () => tone({ freq: 330, freqTo: 520, dur: 0.11, gain: 0.055 }),
  close: () => tone({ freq: 520, freqTo: 320, dur: 0.09, gain: 0.05 }),
  success: () => {
    tone({ freq: 620, dur: 0.08, gain: 0.06 })
    tone({ freq: 820, dur: 0.11, gain: 0.06, delay: 0.07 })
  },
  error: () => tone({ freq: 220, type: 'sine', dur: 0.14, gain: 0.055 }),

  isMuted: () => muted,
  setMuted: (m: boolean) => {
    muted = m
    try {
      localStorage.setItem('mh.sound', m ? 'off' : 'on')
    } catch {
      /* ignore */
    }
    if (!m) getCtx() // warm up the context when unmuting
  },
}
