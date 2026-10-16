import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { Pause, Play, SkipForward, Timer } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Ring } from './Ring'
import { IconButton, softSpring, spring } from './ui'

interface TimerState { total: number; endsAt: number; label: string; paused: number | null }
interface TimerApi { start(seconds: number, label: string): void; state: TimerState | null }
const Ctx = createContext<TimerApi>({ start: () => {}, state: null })
export const useRestTimer = () => useContext(Ctx)

/** Soft two-note chime, quiet enough not to startle. */
function chime() {
  try {
    const ac = new AudioContext()
    ;[659.25, 987.77].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain()
      o.type = 'sine'; o.frequency.value = f
      const t = ac.currentTime + i * 0.16
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.12, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      o.connect(g).connect(ac.destination)
      o.start(t); o.stop(t + 1)
    })
    setTimeout(() => ac.close(), 1500)
  } catch { /* audio unavailable */ }
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState | null>(null)
  const [left, setLeft] = useState(0)
  const [done, setDone] = useState(false)
  const progress = useMotionValue(0)
  const anim = useRef<ReturnType<typeof animate> | null>(null)
  const reduce = useReducedMotion()
  const dismiss = useRef<ReturnType<typeof setTimeout>>()

  const run = useCallback((s: TimerState) => {
    anim.current?.stop()
    const remaining = Math.max(0, (s.endsAt - Date.now()) / 1000)
    progress.jump(remaining / s.total)
    if (!reduce) anim.current = animate(progress, 0, { duration: remaining, ease: 'linear' })
  }, [progress, reduce])

  const start = useCallback((seconds: number, label: string) => {
    const s = { total: seconds, endsAt: Date.now() + seconds * 1000, label, paused: null }
    clearTimeout(dismiss.current)
    setDone(false)
    setState(s)
    run(s)
  }, [run])

  useEffect(() => {
    if (!state || state.paused !== null) return
    let t: ReturnType<typeof setInterval> | undefined
    const tick = () => {
      const remaining = Math.ceil((state.endsAt - Date.now()) / 1000)
      setLeft(Math.max(0, remaining))
      if (reduce) progress.jump(Math.max(0, (state.endsAt - Date.now()) / 1000 / state.total))
      if (remaining <= 0) {
        // Chime once, then hide; a timer started meanwhile cancels the hide.
        clearInterval(t)
        setDone(true)
        chime()
        dismiss.current = setTimeout(() => { setState(null); setDone(false) }, 2600)
        return true
      }
    }
    if (tick()) return
    t = setInterval(tick, 200)
    return () => clearInterval(t)
  }, [state, reduce, progress])

  const adjust = (delta: number) => {
    if (!state) return
    const s = { ...state, total: Math.max(5, state.total + delta), endsAt: state.endsAt + delta * 1000 }
    setState(s); run(s)
  }
  const togglePause = () => {
    if (!state) return
    if (state.paused === null) {
      anim.current?.stop()
      setState({ ...state, paused: state.endsAt - Date.now() })
    } else {
      const s = { ...state, endsAt: Date.now() + state.paused, paused: null }
      setState(s); run(s)
    }
  }
  const skip = () => { anim.current?.stop(); clearTimeout(dismiss.current); setState(null); setDone(false) }

  return (
    <Ctx.Provider value={{ start, state }}>
      {children}
      <AnimatePresence>
        {state && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }} transition={softSpring}
            className="rest-timer" style={{ position: 'fixed', right: 32, bottom: 32, zIndex: 90 }}>
            <motion.div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 18, background: 'var(--surface-solid)', boxShadow: 'var(--shadow-lg)' }}
              animate={done && !reduce ? { scale: [1, 1.04, 1] } : { scale: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
              <div style={{ position: 'relative' }}>
                <AnimatePresence>
                  {done && <motion.div initial={{ opacity: 0.6, scale: 1 }} animate={{ opacity: 0, scale: 1.6 }} transition={{ duration: 1.2, ease: 'easeOut' }}
                    style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent-soft)' }} />}
                </AnimatePresence>
                <Ring size={84} thickness={6} progress={progress}>
                  <div>
                    <div className="num w-600" style={{ fontSize: 20 }}>{done ? 'Go' : fmt(state.paused !== null ? Math.ceil(state.paused / 1000) : left)}</div>
                  </div>
                </Ring>
              </div>
              <div className="col" style={{ gap: 8, minWidth: 150 }}>
                <div>
                  <div className="label row" style={{ gap: 6 }}><Timer size={12} /> Rest</div>
                  <div className="w-600 t-sm" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{done ? 'Time for your next set' : state.label}</div>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <motion.button className="btn sm" whileTap={{ scale: 0.94 }} transition={spring} onClick={() => adjust(-15)}>−15s</motion.button>
                  <motion.button className="btn sm" whileTap={{ scale: 0.94 }} transition={spring} onClick={() => adjust(15)}>+15s</motion.button>
                  <IconButton label={state.paused !== null ? 'Resume' : 'Pause'} className="sm" onClick={togglePause}>{state.paused !== null ? <Play size={15} /> : <Pause size={15} />}</IconButton>
                  <IconButton label="Skip rest" className="sm" onClick={skip}><SkipForward size={15} /></IconButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  )
}
