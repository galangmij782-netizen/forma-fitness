import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownRight, CheckCircle2, Minus, Plus, Repeat, Target, Trash2, TrendingUp, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { LineChart, Sparkline } from '../components/Charts'
import { Button, Card, CountUp, Empty, IconButton, PageHeader, Segmented, Stepper, rise, spring, stagger } from '../components/ui'
import { useQuery } from '../lib/db'
import { addDays, daysBetween, fmtDay, today } from '../lib/dates'
import { useTargets } from '../lib/hooks'
import { useNav } from '../lib/nav'
import { PHASES } from '../lib/nutrition'
import { allSets, deleteWeight, exerciseHistory, listWeights, logWeight, splitMuscles, trainedExercises } from '../lib/repo'
import { analyzeTraining, personalRecords, sessionStats, type Flag } from '../lib/training'
import { weeklyRate } from '../lib/trend'
import { useUnits } from '../lib/units'

type Tab = 'lifts' | 'body' | 'work'
const tabVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { ...spring, staggerChildren: 0.04 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12 } },
}

export function Progress() {
  const { params } = useNav()
  const [tab, setTab] = useState<Tab>((params.tab as Tab) ?? 'lifts')
  return (
    <motion.div className="page-inner" variants={stagger} initial="hidden" animate="show">
      <PageHeader title="Progress" sub="Strength, body weight and what to change next."
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'lifts', label: 'Lifts' }, { value: 'body', label: 'Body weight' }, { value: 'work', label: 'What needs work' }]} />} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} variants={tabVariants} initial="hidden" animate="show" exit="exit">
          {tab === 'lifts' && <Lifts />}
          {tab === 'body' && <Body />}
          {tab === 'work' && <NeedsWork />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

type Metric = 'top' | 'e1rm' | 'volume'

function Lifts() {
  const u = useUnits()
  const exercises = useQuery(() => trainedExercises(), [])
  const [exId, setExId] = useState<number | null>(null)
  const [metric, setMetric] = useState<Metric>('e1rm')
  useEffect(() => { if (exercises?.length && exId === null) setExId(exercises[0].id) }, [exercises, exId])
  const sets = useQuery(() => (exId ? exerciseHistory(exId) : []), [exId])
  const stats = useMemo(() => sessionStats(sets ?? []), [sets])
  const prs = useMemo(() => personalRecords(stats, sets ?? []), [stats, sets])
  const spark = useQuery(() => Object.fromEntries((exercises ?? []).map((e) => [e.id, sessionStats(exerciseHistory(e.id)).slice(-10).map((s) => s.e1rm)])), [exercises])
  if (!exercises) return null
  if (!exercises.length) return <Card><Empty icon={<TrendingUp size={22} />} title="No lifts logged yet" body="Finish a workout and your charts and personal records show up here." /></Card>
  const ex = exercises.find((e) => e.id === exId)
  const series = stats.map((s) => ({ x: s.date, y: u.toDisplay(metric === 'top' ? s.top.weight : metric === 'e1rm' ? s.e1rm : s.volume) }))
  const first = series[0]?.y ?? 0, lastV = series[series.length - 1]?.y ?? 0
  const change = first ? ((lastV - first) / first) * 100 : 0

  return (
    <div className="grid stack-md" style={{ gridTemplateColumns: '280px 1fr', alignItems: 'start' }}>
      <motion.div className="col card flat lift-list" style={{ gap: 2, padding: 8, maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }} variants={stagger} initial="hidden" animate="show">
        {exercises.map((e) => (
          <motion.button key={e.id} variants={rise} onClick={() => setExId(e.id)} whileTap={{ scale: 0.98 }}
            className="list-row" style={{ position: 'relative', textAlign: 'left', padding: '10px 12px' }}>
            {e.id === exId && <motion.div layoutId="lift-pill" className="nav-pill" transition={spring} />}
            <div className="grow" style={{ position: 'relative' }}>
              <div className="t-sm w-500">{e.name}</div>
              <div className="t-xs faint">{e.sessions} sessions · {e.muscle}</div>
            </div>
            <div style={{ position: 'relative' }}><Sparkline values={spark?.[e.id] ?? []} width={56} height={22} /></div>
          </motion.button>
        ))}
      </motion.div>

      <div className="col" style={{ gap: 16 }}>
        <div className="grid g-3 keep-3 pr-grid">
          {prs.map((p, i) => (
            <Card key={p.kind + exId} transition={{ delay: i * 0.05 }}>
              <div className="row between"><div className="label">{p.kind === 'e1rm' ? 'Est. 1RM' : p.kind === 'weight' ? 'Heaviest set' : 'Best volume'}</div><Trophy size={14} className="accent" /></div>
              <div className="t-xl w-600" style={{ marginTop: 6 }}><CountUp value={u.toDisplay(p.value)} decimals={p.kind === 'volume' ? 0 : 1} /> <span className="t-sm muted">{u.unit}</span></div>
              <div className="t-xs faint">{p.kind === 'volume' ? p.detail : p.kind === 'weight' ? p.detail : `${+u.toDisplay(+p.detail.split(' × ')[0]).toFixed(1)} × ${p.detail.split(' × ')[1]}`} · {fmtDay(p.date, { month: 'short', day: 'numeric' })}</div>
            </Card>
          ))}
        </div>
        <Card key={`chart-${exId}-${metric}`}>
          <div className="row between wrap-md" style={{ marginBottom: 20 }}>
            <div>
              <div className="card-title">{ex?.name}</div>
              <div className="t-xs muted">{change >= 0 ? '+' : ''}{change.toFixed(1)}% since {series[0] ? fmtDay(series[0].x, { month: 'short', day: 'numeric' }) : ''}</div>
            </div>
            <Segmented value={metric} onChange={setMetric} options={[{ value: 'top', label: 'Top set' }, { value: 'e1rm', label: 'Est. 1RM' }, { value: 'volume', label: 'Volume' }]} />
          </div>
          <LineChart data={series} height={260} format={(v) => (metric === 'volume' ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0))} />
        </Card>
        <Card>
          <div className="card-title" style={{ marginBottom: 12 }}>Recent sessions</div>
          <table className="clean">
            <thead><tr><th>Date</th><th>Top set</th><th>Est. 1RM</th><th>Sets</th><th style={{ textAlign: 'right' }}>Volume</th></tr></thead>
            <tbody>
              {[...stats].reverse().slice(0, 8).map((s) => (
                <tr key={s.session_id}>
                  <td className="muted">{fmtDay(s.date)}</td>
                  <td className="num">{+u.toDisplay(s.top.weight).toFixed(1)} × {s.top.reps}</td>
                  <td className="num">{u.toDisplay(s.e1rm).toFixed(1)}</td>
                  <td className="num">{s.sets}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{Math.round(u.toDisplay(s.volume)).toLocaleString()} {u.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

function Body() {
  const u = useUnits()
  const t = useTargets()
  const entries = useQuery(() => listWeights(), [])
  const [val, setVal] = useState<number | null>(null)
  const [range, setRange] = useState<'30' | '90' | 'all'>('90')
  if (!t || !entries) return null
  const latest = entries[entries.length - 1]
  const current = val ?? +u.toDisplay(latest?.kg ?? 75).toFixed(1)
  const phase = PHASES[t.profile.phase]
  const rate = weeklyRate(t.trend)
  const from = range === 'all' ? '0000' : addDays(today(), -Number(range))
  const trend = t.trend.filter((p) => p.date >= from)

  // Expected band: where the trend should be if it moved at the phase's rate, starting 4 weeks back.
  const anchor = t.trend.find((p) => p.date >= addDays(today(), -28)) ?? trend[0]
  const band = anchor ? Array.from({ length: Math.max(2, daysBetween(anchor.date, today()) + 1) }, (_, i) => {
    const d = addDays(anchor.date, i)
    const w = i / 7
    return { x: d, lo: u.toDisplay(anchor.trend * (1 + (phase.rate[0] / 100) * w)), hi: u.toDisplay(anchor.trend * (1 + (phase.rate[1] / 100) * w)) }
  }) : undefined
  const inRange = rate && rate.pctPerWeek >= phase.rate[0] && rate.pctPerWeek <= phase.rate[1]

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="grid g-4">
        <Card>
          <div className="label">Log today</div>
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <Stepper value={current} step={0.1} min={20} max={400} onChange={setVal} />
            <Button variant="primary" size="sm" onClick={() => { logWeight(today(), u.fromDisplay(current)); setVal(null) }}>Save</Button>
          </div>
        </Card>
        <Card><div className="label">Trend weight</div><div className="t-xl w-600" style={{ marginTop: 6 }}><CountUp value={u.toDisplay(t.kg)} decimals={1} /> <span className="t-sm muted">{u.unit}</span></div></Card>
        <Card>
          <div className="label">Weekly rate</div>
          <div className="t-xl w-600" style={{ marginTop: 6 }}>{rate ? <><CountUp value={rate.pctPerWeek} decimals={2} prefix={rate.pctPerWeek >= 0 ? '+' : ''} /><span className="t-sm muted">%</span></> : '—'}</div>
          <div className="t-xs muted num">{rate ? `${rate.kgPerWeek >= 0 ? '+' : ''}${u.toDisplay(rate.kgPerWeek).toFixed(2)} ${u.unit} a week` : 'Needs a week of data'}</div>
        </Card>
        <Card>
          <div className="label">{phase.label} expects</div>
          <div className="t-xl w-600" style={{ marginTop: 6 }}>{phase.rate[0] > 0 ? '+' : ''}{phase.rate[0]} to {phase.rate[1] > 0 ? '+' : ''}{phase.rate[1]}<span className="t-sm muted">%</span></div>
          {rate && <span className={`chip ${inRange ? 'accent' : 'warn'}`} style={{ marginTop: 4 }}>{inRange ? 'On pace' : rate.pctPerWeek > phase.rate[1] ? 'Faster than planned' : 'Slower than planned'}</span>}
        </Card>
      </div>
      <Card key={range}>
        <div className="row between wrap-md" style={{ marginBottom: 16 }}>
          <div>
            <div className="card-title">Body weight</div>
            <div className="t-xs muted row wrap" style={{ gap: 14, marginTop: 4 }}>
              <span className="row" style={{ gap: 6 }}><span style={{ width: 14, height: 2, background: 'var(--accent)', borderRadius: 1 }} /> Trend</span>
              <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--text-3)', width: 6, height: 6 }} /> Daily weigh-in</span>
              <span className="row" style={{ gap: 6 }}><span style={{ width: 14, height: 8, background: 'var(--accent-soft)', borderRadius: 2 }} /> Expected range for {phase.label.toLowerCase()}</span>
            </div>
          </div>
          <Segmented value={range} onChange={setRange} options={[{ value: '30', label: '30d' }, { value: '90', label: '90d' }, { value: 'all', label: 'All' }]} />
        </div>
        <LineChart data={trend.map((p) => ({ x: p.date, y: u.toDisplay(p.trend) }))} dots={trend.map((p) => ({ x: p.date, y: u.toDisplay(p.kg) }))}
          band={band?.filter((b) => b.x >= from)} height={280} showArea={false} format={(v) => v.toFixed(1)} />
      </Card>
      <Card>
        <div className="card-title" style={{ marginBottom: 8 }}>Entries</div>
        <motion.div className="col" style={{ gap: 0, maxHeight: 280, overflow: 'auto' }}>
          <AnimatePresence initial={false}>
            {[...entries].reverse().slice(0, 30).map((e) => (
              <motion.div key={e.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="list-row" style={{ padding: '6px 4px' }}>
                <span className="grow t-sm muted">{fmtDay(e.date)}</span>
                <span className="t-sm num w-500">{u.fmt(e.kg)}</span>
                <IconButton label="Delete entry" className="sm" onClick={() => deleteWeight(e.id)}><Trash2 size={13} /></IconButton>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </Card>
    </div>
  )
}

const FLAG_META: Record<Flag['kind'], { icon: typeof Plus; label: string; color: string }> = {
  regressing: { icon: ArrowDownRight, label: 'Going down', color: 'var(--danger)' },
  stalled: { icon: Minus, label: 'Stalled', color: 'var(--warn)' },
  missed_reps: { icon: Target, label: 'Missing reps', color: 'var(--warn)' },
  undertrained: { icon: Repeat, label: 'Low volume', color: 'var(--warn)' },
  ready: { icon: TrendingUp, label: 'Ready to progress', color: 'var(--accent)' },
}

function NeedsWork() {
  const t = useTargets()
  const u = useUnits()
  const flags = useQuery(() => t && analyzeTraining({
    sets: allSets(), today: today(), cutting: t.profile.phase === 'cut', unit: u.unit,
    plannedMuscles: t.profile.active_split_id ? splitMuscles(t.profile.active_split_id) : [],
  }), [t?.profile.phase, u.unit])
  if (!flags) return null
  if (!flags.length) return <Card><Empty icon={<CheckCircle2 size={22} />} title="Nothing needs attention" body="Your lifts are moving, rep targets are being hit and volume is balanced. Keep logging so this stays accurate." /></Card>
  const issues = flags.filter((f) => f.kind !== 'ready')
  const wins = flags.filter((f) => f.kind === 'ready')
  return (
    <div className="col" style={{ gap: 24 }}>
      {issues.length > 0 && (
        <motion.div className="col" style={{ gap: 12 }} variants={stagger} initial="hidden" animate="show">
          <div className="label">Fix these first</div>
          {issues.map((f, i) => <FlagCard key={i} f={f} />)}
        </motion.div>
      )}
      {wins.length > 0 && (
        <motion.div className="col" style={{ gap: 12 }} variants={stagger} initial="hidden" animate="show">
          <div className="label">Ready to push</div>
          <div className="grid g-2">{wins.map((f, i) => <FlagCard key={i} f={f} />)}</div>
        </motion.div>
      )}
      <p className="t-xs faint">Based on the last 8 weeks: estimated 1RM trend (last 2 weeks vs the 4 before), rep targets over the last 4 sessions, and weekly hard sets per muscle group over 4 weeks.</p>
    </div>
  )
}

function FlagCard({ f }: { f: Flag }) {
  const m = FLAG_META[f.kind]
  const Icon = m.icon
  return (
    <Card className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', flex: 'none', background: `color-mix(in oklab, ${m.color} 14%, transparent)`, color: m.color }}><Icon size={18} /></div>
      <div className="grow">
        <div className="row" style={{ gap: 8, marginBottom: 2 }}>
          <span className="w-600">{f.title}</span>
          <span className="chip" style={{ height: 22, color: m.color, background: `color-mix(in oklab, ${m.color} 12%, transparent)` }}>{m.label}</span>
        </div>
        <div className="t-sm muted" style={{ marginBottom: 10 }}>{f.detail}</div>
        <div className="t-sm row" style={{ gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: 'var(--surface)' }}>
          <span className="w-600 accent" style={{ flex: 'none' }}>Do this:</span><span>{f.suggestion}</span>
        </div>
      </div>
    </Card>
  )
}
