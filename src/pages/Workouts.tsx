import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, Clock, Dumbbell, Flag, Plus, Timer, Trash2, Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useCelebrate } from '../components/Celebrate'
import { useRestTimer } from '../components/RestTimer'
import { Button, Card, CountUp, Empty, PageHeader, rise, spring, stagger } from '../components/ui'
import { all, useQuery } from '../lib/db'
import { fmtDay } from '../lib/dates'
import { useNav } from '../lib/nav'
import {
  activeSession, dayExercises, deleteSession, deleteSet, exerciseHistory, finishSession, getProfile, lastPerformance,
  listDays, listSessions, listSplits, logSet, nextDay, sessionSets, startSession,
} from '../lib/repo'
import { isNewPR } from '../lib/training'
import type { DayExercise, SetRow } from '../lib/types'
import { useUnits } from '../lib/units'

export function Workouts() {
  const { params, go } = useNav()
  const live = useQuery(() => activeSession(), [])
  const started = useRef(false)
  useEffect(() => {
    if (!started.current && params.startDay && !activeSession()) { started.current = true; startSession(params.startDay as number) }
  }, [params.startDay])
  if (live === undefined && params.startDay && !started.current) return null
  return live ? <LiveSession key={live.id} sessionId={live.id} /> : <StartView onSplits={() => go('splits')} />
}

function StartView({ onSplits }: { onSplits: () => void }) {
  const data = useQuery(() => {
    const p = getProfile()
    const splits = listSplits()
    const sid = p.active_split_id ?? splits[0]?.id
    return { splits, sid, days: sid ? listDays(sid).map((d) => ({ ...d, ex: dayExercises(d.id) })) : [], next: sid ? nextDay(sid) : undefined, history: listSessions(40) }
  }, [])
  const [splitId, setSplitId] = useState<number | null>(null)
  const days = useQuery(() => (splitId ? listDays(splitId).map((d) => ({ ...d, ex: dayExercises(d.id) })) : null), [splitId])
  const u = useUnits()
  if (!data) return null
  const shownDays = days ?? data.days
  const current = splitId ?? data.sid

  return (
    <motion.div className="page-inner" variants={stagger} initial="hidden" animate="show">
      <PageHeader title="Workouts" sub="Pick today's session and log every set."
        actions={data.splits.length > 1 && (
          <select className="input" style={{ width: 220 }} value={current ?? ''} onChange={(e) => setSplitId(Number(e.target.value))}>
            {data.splits.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )} />
      {shownDays.length === 0 ? (
        <Card><Empty icon={<Dumbbell size={22} />} title="No split to train from" body="Create a split with at least one day, then start your first session here." action={<Button variant="primary" onClick={onSplits}>Set up a split</Button>} /></Card>
      ) : (
        <div className="grid g-3" style={{ marginBottom: 40 }}>
          {shownDays.map((d) => {
            const isNext = !splitId && data.next?.id === d.id
            return (
              <Card key={d.id} interactive onClick={() => startSession(d.id)} style={isNext ? { boxShadow: '0 0 0 1.5px var(--accent), var(--shadow-md)' } : undefined}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <div className="t-lg w-600">{d.name}</div>
                  {isNext && <span className="chip accent">Up next</span>}
                </div>
                <div className="t-sm muted" style={{ marginBottom: 16 }}>{d.ex.length} exercises · {d.ex.reduce((a, e) => a + e.sets, 0)} sets</div>
                <div className="col" style={{ gap: 6 }}>
                  {d.ex.slice(0, 5).map((e) => <div key={e.id} className="t-sm row between"><span>{e.name}</span><span className="faint num t-xs">{e.sets}×{e.reps_min}–{e.reps_max}</span></div>)}
                </div>
                <div className="row accent t-sm w-500" style={{ marginTop: 18, gap: 6 }}>Start <Dumbbell size={14} /></div>
              </Card>
            )
          })}
        </div>
      )}

      <motion.div variants={rise} className="row between" style={{ marginBottom: 12 }}>
        <h2 className="t-lg w-600">History</h2>
        <span className="t-sm faint">{data.history.length} sessions</span>
      </motion.div>
      <motion.div className="col" style={{ gap: 8 }} variants={stagger}>
        {data.history.map((s) => <HistoryRow key={s.id} s={s} fmt={u.fmt} />)}
        {!data.history.length && <motion.p variants={rise} className="muted t-sm">Finished sessions show up here.</motion.p>}
      </motion.div>
    </motion.div>
  )
}

function HistoryRow({ s, fmt }: { s: ReturnType<typeof listSessions>[number]; fmt: (kg: number, d?: number) => string }) {
  const [open, setOpen] = useState(false)
  const sets = useQuery(() => (open ? sessionSets(s.id) : []), [open, s.id])
  const names = useQuery(() => Object.fromEntries((open ? listSetsNames(s.id) : []).map((r) => [r.id, r.name])), [open])
  const groups = new Map<number, SetRow[]>()
  sets?.forEach((x) => { if (!groups.has(x.exercise_id)) groups.set(x.exercise_id, []); groups.get(x.exercise_id)!.push(x) })
  return (
    <motion.div variants={rise} className="card flat pad-sm" layout transition={spring}>
      <button className="row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen(!open)}>
        <div style={{ width: 92, flex: 'none' }} className="t-sm muted">{fmtDay(s.date)}</div>
        <div className="grow w-600 t-sm">{s.day_name} <span className="faint w-500">· {s.split_name}</span></div>
        <span className="t-sm num muted hide-md" style={{ width: 70 }}>{s.sets} sets</span>
        <span className="t-sm num" style={{ width: 110, textAlign: 'right' }}>{fmt(s.volume, 0)}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring} className="faint" style={{ marginLeft: 8, display: 'grid' }}><ChevronDown size={16} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ paddingTop: 12 }}>
            {[...groups.entries()].map(([exId, rows]) => (
              <div key={exId} className="row t-sm" style={{ padding: '6px 0', borderTop: '1px solid var(--hairline)' }}>
                <span className="grow">{names?.[exId]}</span>
                <span className="faint num">{rows.map((r) => `${fmt(r.weight).replace(/ (kg|lb)$/, '')}×${r.reps}`).join('  ')}</span>
              </div>
            ))}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <Button size="sm" variant="danger" onClick={() => deleteSession(s.id)}><Trash2 size={13} /> Delete session</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
const listSetsNames = (sid: number) => all<{ id: number; name: string }>('SELECT DISTINCT e.id, e.name FROM sets x JOIN exercises e ON e.id = x.exercise_id WHERE x.session_id = ?', [sid])

function useElapsed(startIso: string) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const s = Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function LiveSession({ sessionId }: { sessionId: number }) {
  const data = useQuery(() => {
    const s = activeSession()
    if (!s || s.id !== sessionId) return null
    return { s, ex: s.day_id ? dayExercises(s.day_id) : [], sets: sessionSets(sessionId) }
  }, [sessionId])
  const elapsed = useElapsed(data?.s.started_at ?? new Date().toISOString())
  const u = useUnits()
  if (!data) return null
  const { s, ex, sets } = data
  const done = sets.length
  const planned = ex.reduce((a, e) => a + e.sets, 0)
  const volume = sets.reduce((a, x) => a + x.weight * x.reps, 0)

  return (
    <motion.div className="page-inner" variants={stagger} initial="hidden" animate="show">
      <PageHeader title={s.day_name} sub={<span className="row" style={{ gap: 14 }}><span>{s.split_name}</span><span className="row" style={{ gap: 5 }}><Clock size={13} /> <span className="num">{elapsed}</span></span></span>}
        actions={<>
          <Button variant="ghost" onClick={() => deleteSession(s.id)}>Discard</Button>
          <Button variant="primary" onClick={() => finishSession(s.id)}><Flag size={15} /> Finish workout</Button>
        </>} />
      <motion.div variants={rise} className="grid g-3 keep-3" style={{ marginBottom: 20 }}>
        <div className="card flat pad-sm"><div className="label">Sets done</div><div className="t-lg w-600"><CountUp value={done} /> <span className="t-sm muted">/ {planned}</span></div></div>
        <div className="card flat pad-sm"><div className="label">Volume</div><div className="t-lg w-600"><CountUp value={Math.round(u.toDisplay(volume))} /> <span className="t-sm muted">{u.unit}</span></div></div>
        <div className="card flat pad-sm"><div className="label">Exercises</div><div className="t-lg w-600"><CountUp value={new Set(sets.map((x) => x.exercise_id)).size} /> <span className="t-sm muted">/ {ex.length}</span></div></div>
      </motion.div>
      <div className="col" style={{ gap: 14 }}>
        {ex.map((e) => <ExerciseLog key={e.id} sessionId={s.id} e={e} logged={sets.filter((x) => x.exercise_id === e.exercise_id)} />)}
      </div>
    </motion.div>
  )
}

function ExerciseLog({ sessionId, e, logged }: { sessionId: number; e: DayExercise; logged: SetRow[] }) {
  const u = useUnits()
  const timer = useRestTimer()
  const celebrate = useCelebrate()
  const last = useQuery(() => lastPerformance(e.exercise_id, sessionId), [e.exercise_id, sessionId]) ?? []
  const [extra, setExtra] = useState(0)
  const rows = Math.max(e.sets + extra, logged.length)
  const complete = logged.length >= e.sets

  const onLog = (idx: number, weightDisplay: number, reps: number) => {
    const kg = Math.round(u.fromDisplay(weightDisplay) * 100) / 100
    const prev = exerciseHistory(e.exercise_id, sessionId).concat(logged).map((x) => ({ weight: x.weight, reps: x.reps }))
    logSet(sessionId, e.exercise_id, idx, kg, reps, e.reps_min, e.reps_max)
    const pr = isNewPR(kg, reps, prev)
    if (pr) {
      celebrate({
        icon: <Trophy size={22} />, title: `New ${pr.kind === 'weight' ? 'heaviest' : 'estimated 1RM'} PR`,
        value: +u.toDisplay(pr.value).toFixed(1), decimals: 1, unit: u.unit, caption: e.name,
      })
    }
    timer.start(e.rest_sec, idx + 1 < e.sets ? `${e.name} · next: set ${idx + 2}` : `${e.name} · last set done`)
  }

  return (
    <Card style={{ padding: 22 }}>
      <div className="row between wrap-md" style={{ marginBottom: 14 }}>
        <div>
          <div className="row" style={{ gap: 10 }}>
            <div className="t-lg w-600" style={{ letterSpacing: '-0.02em' }}>{e.name}</div>
            <AnimatePresence>{complete && <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0 }} transition={spring} className="chip accent"><Check size={12} /> Done</motion.span>}</AnimatePresence>
          </div>
          <div className="t-sm muted row wrap" style={{ gap: 12, marginTop: 2 }}>
            <span>{e.sets} × {e.reps_min}–{e.reps_max}</span>
            <span className="row" style={{ gap: 4 }}><Timer size={13} /> {Math.floor(e.rest_sec / 60)}:{String(e.rest_sec % 60).padStart(2, '0')} rest</span>
            <span className="chip" style={{ height: 22 }}>{e.muscle}</span>
          </div>
        </div>
        {last.length > 0 && <div className="t-xs faint" style={{ textAlign: 'right' }}>Last time<br /><span className="num muted">{last.map((x) => `${+u.toDisplay(x.weight).toFixed(1)}×${x.reps}`).join(' · ')}</span></div>}
      </div>
      <div className="row t-xs faint" style={{ padding: '0 6px 6px', gap: 12 }}>
        <span style={{ width: 34 }}>Set</span><span className="hide-md" style={{ width: 96 }}>Previous</span><span style={{ width: 110 }}>{u.unit}</span><span style={{ width: 90 }}>Reps</span><span className="grow" />
      </div>
      <div className="col" style={{ gap: 4 }}>
        {Array.from({ length: rows }, (_, i) => (
          <SetLine key={i} idx={i} logged={logged.find((x) => x.set_index === i)} prev={last[i]} lastLogged={logged[logged.length - 1]}
            target={[e.reps_min, e.reps_max]} step={u.step} toDisplay={u.toDisplay} onLog={onLog} />
        ))}
      </div>
      <Button size="sm" variant="ghost" style={{ marginTop: 6 }} onClick={() => setExtra(extra + 1)}><Plus size={14} /> Add set</Button>
    </Card>
  )
}

function SetLine({ idx, logged, prev, lastLogged, target, step, toDisplay, onLog }: {
  idx: number; logged?: SetRow; prev?: SetRow; lastLogged?: SetRow; target: [number, number]; step: number
  toDisplay: (kg: number) => number; onLog: (idx: number, w: number, reps: number) => void
}) {
  const seedW = logged?.weight ?? lastLogged?.weight ?? prev?.weight ?? 0
  const [w, setW] = useState(String(+toDisplay(seedW).toFixed(2)))
  const [r, setR] = useState(String(logged?.reps ?? prev?.reps ?? target[1]))
  useEffect(() => { if (!logged && lastLogged) setW(String(+toDisplay(lastLogged.weight).toFixed(2))) }, [lastLogged?.id])
  const isDone = !!logged
  const missed = logged && logged.reps < target[0]

  return (
    <motion.div layout className="row" style={{ gap: 12, padding: '6px', borderRadius: 12, background: isDone ? 'var(--accent-soft)' : 'transparent', transition: 'background-color .25s' }}>
      <span className="num w-600 t-sm" style={{ width: 34, textAlign: 'center', color: isDone ? 'var(--accent)' : 'var(--text-3)' }}>{idx + 1}</span>
      <span className="t-sm faint num hide-md" style={{ width: 96 }}>{prev ? `${+toDisplay(prev.weight).toFixed(1)} × ${prev.reps}` : '—'}</span>
      <input className="input sm num" style={{ width: 110 }} value={w} disabled={isDone} inputMode="decimal" onChange={(e) => setW(e.target.value)} onKeyDown={(e) => e.key === 'ArrowUp' ? setW(String(+(parseFloat(w || '0') + step).toFixed(2))) : e.key === 'ArrowDown' ? setW(String(Math.max(0, +(parseFloat(w || '0') - step).toFixed(2)))) : null} />
      <input className="input sm num" style={{ width: 90 }} value={r} disabled={isDone} inputMode="numeric" onChange={(e) => setR(e.target.value.replace(/\D/g, ''))} />
      <span className="grow t-xs" style={{ color: missed ? 'var(--warn)' : 'var(--text-3)' }}>{missed ? `Below ${target[0]} reps` : ''}</span>
      <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.88 }} transition={spring}
        aria-label={isDone ? 'Undo set' : 'Log set'}
        onClick={() => (isDone ? deleteSet(logged!.id) : onLog(idx, parseFloat(w) || 0, parseInt(r) || 0))}
        style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: isDone ? 'var(--accent)' : 'var(--surface-2)', color: isDone ? 'var(--accent-ink)' : 'var(--text-3)', boxShadow: 'var(--shadow-sm)' }}>
        <motion.span key={String(isDone)} initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }} style={{ display: 'grid' }}>
          <Check size={17} strokeWidth={2.6} />
        </motion.span>
      </motion.button>
    </motion.div>
  )
}

