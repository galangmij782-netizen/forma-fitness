// Small, dependency-free SVG charts. Lines reveal with a clip that scales on X,
// bars grow with scaleY, dots fade in: transform and opacity only.
import { motion, useReducedMotion } from 'motion/react'
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fmtShort } from '../lib/dates'

export interface Pt { x: string; y: number }

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) { min -= 1; max += 1 }
  const span = max - min
  const step = Math.pow(10, Math.floor(Math.log10(span / count)))
  const err = (count * step) / span
  const s = err <= 0.15 ? step * 10 : err <= 0.35 ? step * 5 : err <= 0.75 ? step * 2 : step
  const lo = Math.floor(min / s) * s
  const hi = Math.ceil(max / s) * s
  const ticks: number[] = []
  for (let v = lo; v <= hi + s / 2; v += s) ticks.push(+v.toFixed(6))
  return ticks
}

interface LineChartProps {
  data: Pt[]
  height?: number
  format?: (v: number) => string
  dots?: Pt[]
  band?: { x: string; lo: number; hi: number }[]
  showArea?: boolean
  delay?: number
}

export function LineChart({ data, height = 220, format = (v) => v.toFixed(0), dots, band, showArea = true, delay = 0 }: LineChartProps) {
  const reduce = useReducedMotion()
  const id = useId().replace(/:/g, '')
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [W, setW] = useState(640)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  const H = height, padL = 44, padR = 12, padT = 12, padB = 26

  const geo = useMemo(() => {
    const all = [...data.map((d) => d.y), ...(dots ?? []).map((d) => d.y), ...(band ?? []).flatMap((b) => [b.lo, b.hi])]
    const xsAll = [...data, ...(dots ?? [])].map((d) => d.x).sort()
    if (!all.length) return null
    const pad = (Math.max(...all) - Math.min(...all)) * 0.08 || 1
    const ticks = niceTicks(Math.min(...all) - pad, Math.max(...all) + pad)
    const y0 = ticks[0], y1 = ticks[ticks.length - 1]
    const t0 = new Date(xsAll[0]).getTime(), t1 = new Date(xsAll[xsAll.length - 1]).getTime()
    const sx = (x: string) => padL + (t1 === t0 ? 0.5 : (new Date(x).getTime() - t0) / (t1 - t0)) * (W - padL - padR)
    const sy = (y: number) => padT + (1 - (y - y0) / (y1 - y0)) * (H - padT - padB)
    return { ticks, sx, sy, first: xsAll[0], last: xsAll[xsAll.length - 1] }
  }, [data, dots, band, H, W])

  if (!geo || data.length === 0) return <div ref={ref} style={{ height }} className="faint t-sm row">Not enough data yet.</div>
  const { ticks, sx, sy } = geo
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${sx(d.x).toFixed(1)},${sy(d.y).toFixed(1)}`).join('')
  const area = `${line}L${sx(data[data.length - 1].x).toFixed(1)},${H - padB}L${sx(data[0].x).toFixed(1)},${H - padB}Z`
  const bandPath = band && band.length > 1
    ? `${band.map((b, i) => `${i ? 'L' : 'M'}${sx(b.x)},${sy(b.hi)}`).join('')}${[...band].reverse().map((b) => `L${sx(b.x)},${sy(b.lo)}`).join('')}Z`
    : null
  const revealT = reduce ? { duration: 0 } : { duration: 1.1, ease: [0.65, 0, 0.35, 1] as const, delay }

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    let best = 0, bd = Infinity
    data.forEach((d, i) => { const dd = Math.abs(sx(d.x) - px); if (dd < bd) { bd = dd; best = i } })
    setHover(best)
  }
  const h = hover !== null ? data[hover] : null

  return (
    <div ref={ref} style={{ position: 'relative' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`c${id}`}>
            <motion.rect x={0} y={0} width={W} height={H} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={revealT} style={{ originX: 0 }} />
          </clipPath>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={sy(t)} y2={sy(t)} stroke="var(--hairline)" vectorEffect="non-scaling-stroke" />
            <text x={padL - 10} y={sy(t)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--text-3)">{format(t)}</text>
          </g>
        ))}
        {bandPath && <motion.path d={bandPath} fill="var(--accent)" initial={{ opacity: 0 }} animate={{ opacity: 0.08 }} transition={{ delay: delay + 0.4, duration: 0.6 }} />}
        {dots?.map((d, i) => (
          <motion.circle key={i} cx={sx(d.x)} cy={sy(d.y)} r={2.6} fill="var(--text-3)" initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} transition={{ delay: reduce ? 0 : delay + (i / dots.length) * 0.8, duration: 0.3 }} />
        ))}
        <g clipPath={`url(#c${id})`}>
          {showArea && <path d={area} fill={`url(#g${id})`} />}
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </g>
        {h && <line x1={sx(h.x)} x2={sx(h.x)} y1={padT} y2={H - padB} stroke="var(--hairline)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </svg>
      {h && (
        <>
          <div style={{ position: 'absolute', left: `${(sx(h.x) / W) * 100}%`, top: sy(h.y), width: 10, height: 10, marginLeft: -5, marginTop: -5, borderRadius: 5, background: 'var(--accent)', boxShadow: '0 0 0 4px var(--accent-soft)', pointerEvents: 'none' }} />
          <div className="toast" style={{ position: 'absolute', left: `${(sx(h.x) / W) * 100}%`, top: sy(h.y) - 52, transform: 'translateX(-50%)', padding: '6px 10px', borderRadius: 10, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
            <span className="t-sm w-600 num">{format(h.y)}</span><span className="t-xs faint">{fmtShort(h.x)}</span>
          </div>
        </>
      )}
      <div className="row between t-xs faint" style={{ position: 'absolute', left: `${(padL / W) * 100}%`, right: 0, bottom: 0 }}>
        <span>{fmtShort(geo.first)}</span><span>{fmtShort(geo.last)}</span>
      </div>
    </div>
  )
}

export function BarChart({ data, height = 160, target, format = (v) => v.toFixed(0), labels }: { data: number[]; height?: number; target?: number; format?: (v: number) => string; labels: string[] }) {
  const reduce = useReducedMotion()
  const max = Math.max(...data, target ?? 0, 1) * 1.12
  return (
    <div style={{ position: 'relative', height: height + 22 }}>
      {target !== undefined && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 22 + (target / max) * height, borderTop: '1px dashed var(--text-3)', opacity: 0.5 }}>
          <span className="t-xs faint" style={{ position: 'absolute', right: 0, top: -18 }}>{format(target)}</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 10, height, alignItems: 'end' }}>
        {data.map((v, i) => (
          <div key={i} style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }} title={format(v)}>
            <motion.div
              style={{ width: '100%', height: `${Math.max(2, (v / max) * 100)}%`, borderRadius: 8, background: v === 0 ? 'var(--track)' : target && v >= target * 0.95 ? 'var(--accent)' : 'var(--accent-3)', originY: 1 }}
              initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 20, delay: i * 0.05 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 10, marginTop: 6 }}>
        {labels.map((l, i) => <span key={i} className="t-xs faint" style={{ textAlign: 'center' }}>{l}</span>)}
      </div>
    </div>
  )
}

/** Tiny trend line for stat tiles. */
export function Sparkline({ values, width = 120, height = 36 }: { values: number[]; width?: number; height?: number }) {
  const reduce = useReducedMotion()
  const id = useId().replace(/:/g, '')
  if (values.length < 2) return null
  const lo = Math.min(...values), hi = Math.max(...values)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 3 - ((v - lo) / (hi - lo || 1)) * (height - 6)}`)
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <clipPath id={`s${id}`}><motion.rect width={width} height={height} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ originX: 0 }} transition={reduce ? { duration: 0 } : { duration: 1, ease: [0.65, 0, 0.35, 1], delay: 0.2 }} /></clipPath>
      <polyline clipPath={`url(#s${id})`} points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
