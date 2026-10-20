import { useEffect } from 'react'

// Rest alarm: one shared AudioContext unlocked on the first tap, so the sound can
// play later without a gesture (iOS and Chrome both require that).

export type AlarmSound = 'ring' | 'beep' | 'chime' | 'off'
const KEY = 'forma:alarm-sound'
export const ALARM_SOUNDS: { value: AlarmSound; label: string }[] = [
  { value: 'ring', label: 'Ring' }, { value: 'beep', label: 'Beep' }, { value: 'chime', label: 'Soft' }, { value: 'off', label: 'Off' },
]

export function getAlarmSound(): AlarmSound {
  try { const v = localStorage.getItem(KEY) as AlarmSound | null; return v && ALARM_SOUNDS.some((s) => s.value === v) ? v : 'ring' } catch { return 'ring' }
}
export function setAlarmSound(v: AlarmSound) { try { localStorage.setItem(KEY, v) } catch { /* storage blocked */ } }

let ac: AudioContext | null = null
let stopTimer: ReturnType<typeof setTimeout> | undefined
let nodes: AudioScheduledSourceNode[] = []

/** Call from a tap. Creates and resumes the audio context and lets sound play with the iPhone silent switch on. */
export function unlockAudio() {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'
    if (!ac) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ac = new Ctor()
    }
    if (ac.state === 'suspended') void ac.resume()
    // A silent blip finishes the unlock on older iOS.
    const o = ac.createOscillator(), g = ac.createGain()
    g.gain.value = 0; o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.01)
  } catch { /* audio unavailable */ }
}

if (typeof window !== 'undefined') {
  const once = () => unlockAudio()
  window.addEventListener('pointerdown', once, { passive: true })
  window.addEventListener('keydown', once)
}

function tone(f: number, at: number, len: number, vol: number, type: OscillatorType = 'sine') {
  if (!ac) return
  const o = ac.createOscillator(), g = ac.createGain()
  o.type = type; o.frequency.value = f
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(vol, at + 0.015)
  g.gain.setValueAtTime(vol, at + len * 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  o.connect(g).connect(ac.destination)
  o.start(at); o.stop(at + len + 0.02)
  nodes.push(o)
}

/** Plays the chosen alarm. Ring and beep repeat for about 8 seconds unless stopAlarm() is called. */
export function playAlarm(sound: AlarmSound = getAlarmSound()) {
  stopAlarm()
  if (sound !== 'off') {
    unlockAudio()
    if (ac) {
      const t0 = ac.currentTime + 0.05
      if (sound === 'chime') {
        tone(659.25, t0, 0.9, 0.18); tone(987.77, t0 + 0.16, 0.9, 0.18)
      } else if (sound === 'beep') {
        for (let r = 0; r < 5; r++) for (let i = 0; i < 3; i++) tone(1046.5, t0 + r * 1.6 + i * 0.22, 0.14, 0.32, 'square')
      } else {
        // Phone-style ring: two quick trills, a pause, repeated.
        for (let r = 0; r < 4; r++) {
          for (let i = 0; i < 8; i++) {
            const at = t0 + r * 2 + i * 0.1
            tone(i % 2 ? 1318.5 : 1046.5, at, 0.09, 0.28, 'triangle')
            tone(i % 2 ? 1318.5 : 1046.5, at + 0.5, 0.09, 0.28, 'triangle')
          }
        }
      }
      stopTimer = setTimeout(stopAlarm, 8500)
    }
  }
  try { navigator.vibrate?.([400, 150, 400, 150, 400]) } catch { /* no vibration */ }
}

export function stopAlarm() {
  clearTimeout(stopTimer)
  nodes.forEach((n) => { try { n.stop() } catch { /* already stopped */ } })
  nodes = []
  try { navigator.vibrate?.(0) } catch { /* no vibration */ }
}

/** Shows a system notification when the app is in the background, if the user allowed them. */
export async function notify(title: string, body: string) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, tag: 'forma-rest', icon: './icon-192.png' })
    else new Notification(title, { body, tag: 'forma-rest' })
  } catch { /* notifications unavailable */ }
}

/** Shows a notification now, even with the app open. Returns false when notifications aren't allowed. */
export async function notifyNow(title: string, body: string, tag = 'forma-reminder') {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, tag, icon: './icon-192.png' })
    else new Notification(title, { body, tag })
    return true
  } catch { return false }
}

export function askNotifyPermission() {
  try { if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission() } catch { /* unsupported */ }
}

/** Keeps the screen on during a workout so the timer and alarm keep running. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }
    if (!nav.wakeLock) return
    let lock: { release(): Promise<void> } | null = null
    let alive = true
    const get = () => { if (document.visibilityState === 'visible') nav.wakeLock!.request('screen').then((l) => { if (alive) lock = l; else void l.release() }).catch(() => {}) }
    get()
    document.addEventListener('visibilitychange', get)
    return () => { alive = false; document.removeEventListener('visibilitychange', get); void lock?.release().catch(() => {}) }
  }, [active])
}
