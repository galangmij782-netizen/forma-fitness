// A short, restrained celebration for PRs and hitting the protein target.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CountUp } from './ui'

interface Moment { id: number; icon: ReactNode; title: string; value?: number; decimals?: number; unit?: string; caption?: string }
const Ctx = createContext<(m: Omit<Moment, 'id'>) => void>(() => {})
export const useCelebrate = () => useContext(Ctx)

const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : 0)
  const d = 70 + (i % 3) * 22
  return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: 0.6 + (i % 3) * 0.25 }
})

export function CelebrateProvider({ children }: { children: ReactNode }) {
  const [m, setM] = useState<Moment | null>(null)
  const reduce = useReducedMotion()
  const show = useCallback((x: Omit<Moment, 'id'>) => {
    const id = Date.now()
    setM({ ...x, id })
    setTimeout(() => setM((cur) => (cur?.id === id ? null : cur)), 2600)
  }, [])

  return (
    <Ctx.Provider value={show}>
      {children}
      <AnimatePresence>
        {m && (
          <motion.div key={m.id} style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', zIndex: 150, pointerEvents: 'none' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}>
            <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
              {!reduce && (
                <>
                  <motion.div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(closest-side, var(--accent-soft), transparent)' }}
                    initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1.4, opacity: [0, 1, 0] }} transition={{ duration: 1.6, ease: 'easeOut' }} />
                  {PARTICLES.map((p, i) => (
                    <motion.div key={i} style={{ position: 'absolute', width: 6, height: 6, borderRadius: 3, background: 'var(--accent)' }}
                      initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                      animate={{ x: p.x, y: p.y, scale: p.s, opacity: [0, 1, 0] }}
                      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.12 + (i % 4) * 0.02 }} />
                  ))}
                </>
              )}
              <motion.div className="card" style={{ background: 'var(--surface-solid)', boxShadow: 'var(--shadow-lg)', padding: '22px 28px', textAlign: 'center', minWidth: 220 }}
                initial={{ scale: 0.85, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 20 }}>
                <motion.div className="empty-icon" style={{ marginBottom: 12 }} initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.08 }}>
                  {m.icon}
                </motion.div>
                <div className="label" style={{ marginBottom: 4 }}>{m.title}</div>
                {m.value !== undefined && (
                  <div className="t-xl w-600"><CountUp value={m.value} decimals={m.decimals ?? 0} duration={1} /> <span className="t-sm muted">{m.unit}</span></div>
                )}
                {m.caption && <div className="t-sm muted" style={{ marginTop: 4 }}>{m.caption}</div>}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  )
}
