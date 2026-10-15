import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type HTMLMotionProps } from 'motion/react'
import { Minus, Plus, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'

// ---------- motion presets ----------
export const spring = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 } as const
export const softSpring = { type: 'spring', stiffness: 220, damping: 28 } as const
export const press = { whileHover: { scale: 1.015, y: -1 }, whileTap: { scale: 0.97 }, transition: spring }
export const cardPress = { whileHover: { y: -3 }, whileTap: { scale: 0.985 }, transition: spring }

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
}
export const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: softSpring },
}

// ---------- buttons ----------
type BtnProps = HTMLMotionProps<'button'> & { variant?: 'primary' | 'ghost' | 'danger' | 'default'; size?: 'sm' | 'lg' }
export function Button({ variant = 'default', size, className = '', ...rest }: BtnProps) {
  return <motion.button {...press} className={`btn ${variant !== 'default' ? variant : ''} ${size ?? ''} ${className}`} {...rest} />
}
export function IconButton({ className = '', label, ...rest }: HTMLMotionProps<'button'> & { label: string }) {
  return <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }} transition={spring} aria-label={label} title={label} className={`icon-btn ${className}`} {...rest} />
}

// ---------- cards ----------
export function Card({ interactive, className = '', children, ...rest }: HTMLMotionProps<'div'> & { interactive?: boolean }) {
  return (
    <motion.div variants={rise} {...(interactive ? cardPress : {})} className={`card ${interactive ? 'interactive' : ''} ${className}`} {...rest}>
      {children}
    </motion.div>
  )
}

// ---------- numbers that count up ----------
export function CountUp({ value, decimals = 0, duration = 0.9, className = '', prefix = '', suffix = '' }: { value: number; decimals?: number; duration?: number; className?: string; prefix?: string; suffix?: string }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(0)
  const text = useTransform(mv, (v) => `${prefix}${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`)
  useEffect(() => {
    if (reduce || !Number.isFinite(value)) { mv.jump(Number.isFinite(value) ? value : 0); return }
    const c = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] })
    return () => c.stop()
  }, [value, reduce, duration, mv])
  return <motion.span className={`num ${className}`}>{text}</motion.span>
}

// ---------- segmented control with a sliding pill ----------
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  const id = useId()
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <motion.button key={o.value} role="tab" aria-selected={o.value === value} data-active={o.value === value} onClick={() => onChange(o.value)} whileTap={{ scale: 0.96 }}>
          {o.value === value && <motion.div layoutId={`seg-${id}`} className="seg-pill" transition={spring} />}
          <span>{o.label}</span>
        </motion.button>
      ))}
    </div>
  )
}

// ---------- numeric stepper ----------
export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, width }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; width?: number }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)))
  return (
    <div className="stepper">
      <motion.button whileTap={{ scale: 0.85 }} onClick={() => commit(value - step)} aria-label="Decrease"><Minus size={14} /></motion.button>
      <input style={width ? { width } : undefined} value={text} inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { const n = parseFloat(text); if (Number.isFinite(n)) commit(n); else setText(String(value)) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      <motion.button whileTap={{ scale: 0.85 }} onClick={() => commit(value + step)} aria-label="Increase"><Plus size={14} /></motion.button>
    </div>
  )
}

// ---------- modal sheet ----------
export function Sheet({ open, onClose, children, wide, xwide, title }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean; xwide?: boolean; title?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div className={`sheet ${wide ? 'wide' : ''} ${xwide ? 'xwide' : ''}`} role="dialog" aria-modal="true"
            initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={softSpring}>
            {title && (
              <div className="row between" style={{ marginBottom: 24 }}>
                <h2 className="t-lg w-600" style={{ letterSpacing: '-0.02em' }}>{title}</h2>
                <IconButton label="Close" onClick={onClose}><X size={18} /></IconButton>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const Skeleton = ({ w = '100%', h = 14, r = 10, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) =>
  <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <motion.div className="page-head" variants={rise}>
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </motion.div>
  )
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <motion.div className="empty" variants={rise}>
      <div className="empty-icon">{icon}</div>
      <div className="w-600" style={{ color: 'var(--text)', marginBottom: 6 }}>{title}</div>
      <p className="t-sm" style={{ maxWidth: 360, margin: '0 auto 20px' }}>{body}</p>
      {action}
    </motion.div>
  )
}

export function Bar({ value, delay = 0, color }: { value: number; delay?: number; color?: string }) {
  const reduce = useReducedMotion()
  return (
    <div className="bar-track">
      <motion.div className="bar-fill" style={{ background: color }} initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0, Math.min(1, value)) }}
        transition={reduce ? { duration: 0 } : { ...softSpring, delay }} />
    </div>
  )
}

// ---------- toasts ----------
interface Toast { id: number; icon?: ReactNode; title: string; body?: string }
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const n = useRef(0)
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++n.current
    setToasts((x) => [...x, { ...t, id }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        <AnimatePresence>
          {toasts.slice(-1).map((t) => (
            <motion.div key={t.id} className="toast" initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={softSpring}>
              {t.icon && <div className="avatar">{t.icon}</div>}
              <div>
                <div className="w-600 t-sm">{t.title}</div>
                {t.body && <div className="t-xs muted">{t.body}</div>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
