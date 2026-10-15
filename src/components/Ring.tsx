// Progress ring built from two rotating half-rings, so filling it only ever
// animates `transform` (no stroke-dashoffset repaints).
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useEffect, type ReactNode } from 'react'

interface RingProps {
  size: number
  thickness: number
  value?: number
  progress?: MotionValue<number>
  color?: string
  delay?: number
  children?: ReactNode
}

export function Ring({ size, thickness, value = 0, progress, color = 'var(--accent)', delay = 0, children }: RingProps) {
  const reduce = useReducedMotion()
  const target = useMotionValue(0)
  const sprung = useSpring(target, { stiffness: 55, damping: 17, mass: 1 })

  useEffect(() => {
    const v = Math.max(0, Math.min(1, value))
    if (reduce) { target.jump(v); sprung.jump(v); return }
    const t = setTimeout(() => target.set(v), delay * 1000)
    return () => clearTimeout(t)
  }, [value, reduce, delay, target, sprung])

  const p = progress ?? sprung
  const firstHalf = useTransform(p, (v) => Math.min(Math.max(v, 0), 0.5) * 360)
  const secondHalf = useTransform(p, (v) => 180 + Math.max(Math.min(v, 1) - 0.5, 0) * 360)
  const capRotate = useTransform(p, (v) => Math.min(Math.max(v, 0), 1) * 360)
  const capOpacity = useTransform(p, (v) => (v > 0.004 ? 1 : 0))

  const mask = `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 calc(100% - ${thickness - 0.5}px))`
  const ringBase: React.CSSProperties = { position: 'absolute', top: 0, width: size, height: size, borderRadius: '50%', WebkitMaskImage: mask, maskImage: mask }
  const half: React.CSSProperties = { ...ringBase, background: color, clipPath: 'inset(0 50% 0 0)' }
  const dot: React.CSSProperties = { position: 'absolute', left: size / 2 - thickness / 2, top: 0, width: thickness, height: thickness, borderRadius: '50%', background: color }

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <div style={{ ...ringBase, left: 0, background: 'var(--track)' }} />
      <div style={{ position: 'absolute', left: size / 2, top: 0, width: size / 2, height: size, overflow: 'hidden' }}>
        <motion.div style={{ ...half, left: -size / 2, rotate: firstHalf }} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: size / 2, height: size, overflow: 'hidden' }}>
        <motion.div style={{ ...half, left: 0, rotate: secondHalf }} />
      </div>
      <motion.div style={{ ...dot, opacity: capOpacity }} />
      <motion.div style={{ position: 'absolute', inset: 0, rotate: capRotate, opacity: capOpacity }}>
        <div style={dot} />
      </motion.div>
      {children && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
      )}
    </div>
  )
}
