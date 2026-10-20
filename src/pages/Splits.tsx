import { AnimatePresence, Reorder, motion, useDragControls } from 'motion/react'
import { ArrowLeft, Check, ClipboardType, Copy, GripVertical, Plus, Search, Star, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Empty, IconButton, PageHeader, Sheet, Stepper, rise, softSpring, spring, stagger } from '../components/ui'
import { useQuery } from '../lib/db'
import { useNav } from '../lib/nav'
import {
  TEMPLATES, WEEKDAYS, addDay, clearSchedule, getSchedule, setScheduleDay, weekdayOf, addDayExercise, createSplit, createSplitFromProgram, dayExercises, deleteDay, deleteSplit, duplicateSplit, ensureExercise,
  getProfile, listDays, listExercises, listSplits, removeDayExercise, renameDay, reorder, saveProfile, updateDayExercise, updateSplit,
} from '../lib/repo'
import { parseProgram } from '../lib/programText'
import { MUSCLE_GROUPS, type DayExercise, type MuscleGroup, type SplitDay } from '../lib/types'


export function Splits() {
  const { params } = useNav()
  const [selected, setSelected] = useState<number | null>((params.splitId as number) ?? null)
  const splits = useQuery(() => listSplits(), [])
  const activeId = useQuery(() => getProfile().active_split_id, [])
  const daysBySplit = useQuery(() => Object.fromEntries((splits ?? []).map((s) => [s.id, listDays(s.id)])), [splits])
  const [creating, setCreating] = useState(false)
  const [typing, setTyping] = useState(!!params.type)
  useEffect(() => { document.querySelector('.page')?.scrollTo({ top: 0 }) }, [selected])
  useEffect(() => {
    const open = () => setTyping(true)
    window.addEventListener('forma:type-program', open)
    return () => window.removeEventListener('forma:type-program', open)
  }, [])
  if (!splits || !daysBySplit) return null

  return (
    <div className="page-inner">
      <AnimatePresence mode="wait" initial={false}>
        {selected === null ? (
          <motion.div key="grid" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0, x: -16, transition: { duration: 0.14, ease: 'easeIn' } }}>
            <PageHeader title="Splits" sub="Plan the days you train and what each one includes."
              actions={<>
                <Button onClick={() => setCreating(true)}><Plus size={16} /> Templates</Button>
                <Button variant="primary" onClick={() => setTyping(true)}><ClipboardType size={16} /> Type your program</Button>
              </>} />
            {splits.length === 0 ? (
              <Empty icon={<Plus size={22} />} title="No splits yet" body="Type or paste your program and it becomes a split, or start from a template." action={<Button variant="primary" onClick={() => setTyping(true)}>Type your program</Button>} />
            ) : (
              <div className="grid g-3">
                {splits.map((s) => (
                  <motion.div key={s.id} variants={rise}
                    whileHover={{ y: -4 }} whileTap={{ scale: 0.985 }}
                    className="card interactive" style={{ minHeight: 196, display: 'flex', flexDirection: 'column', borderRadius: 20 }}
                    onClick={() => setSelected(s.id)}>
                    <div className="row between" style={{ marginBottom: 10, gap: 8 }}>
                      <div className="t-lg w-600" style={{ letterSpacing: '-0.02em', minWidth: 0 }}>{s.name}</div>
                      {activeId === s.id && <span className="chip accent" style={{ flex: 'none' }}><Star size={11} fill="currentColor" /> Active</span>}
                    </div>
                    <p className="t-sm muted" style={{ marginBottom: 'auto' }}>{s.description || 'No description'}</p>
                    <div className="row wrap" style={{ gap: 6, marginTop: 18 }}>
                      {daysBySplit[s.id]?.map((d) => <span key={d.id} className="chip">{d.name}</span>)}
                    </div>
                    <div className="t-xs faint" style={{ marginTop: 12 }}>{s.days} days · {s.exercises} exercises</div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <SplitDetail key={`d${selected}`} id={selected} onBack={() => setSelected(null)} />
        )}
      </AnimatePresence>
      <ProgramSheet open={typing} onClose={() => setTyping(false)} onCreated={(id) => { setTyping(false); setSelected(id) }} />
      <NewSplitSheet open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setSelected(id) }} />
    </div>
  )
}

function NewSplitSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const options = [...Object.entries(TEMPLATES).map(([k, t]) => ({ key: k, name: t.name, desc: t.description, days: t.days.map((d) => d.name) })), { key: 'blank', name: 'Blank', desc: 'Start empty and add your own days.', days: [] as string[] }]
  return (
    <Sheet open={open} onClose={onClose} title="New split">
      <motion.div className="col" style={{ gap: 10 }} variants={stagger} initial="hidden" animate="show">
        <motion.button variants={rise} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={spring}
          className="card flat pad-sm" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 0 0 1.5px var(--accent)' }}
          onClick={() => { onClose(); window.dispatchEvent(new Event('forma:type-program')) }}>
          <ClipboardType size={20} className="accent" />
          <div className="grow">
            <div className="w-600">Type or paste your program</div>
            <div className="t-sm muted">Write it like a note, e.g. "Incline bench 3x8-12". The days and exercises fill in for you.</div>
          </div>
        </motion.button>
        {options.map((o) => (
          <motion.button key={o.key} variants={rise} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={spring}
            className="card flat pad-sm" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16 }}
            onClick={() => onCreated(createSplit(o.key === 'blank' ? null : o.key))}>
            <div className="grow">
              <div className="w-600">{o.name}</div>
              <div className="t-sm muted">{o.desc}</div>
            </div>
            <div className="row" style={{ gap: 4 }}>{o.days.map((d) => <span key={d} className="chip">{d}</span>)}</div>
          </motion.button>
        ))}
      </motion.div>
    </Sheet>
  )
}

const EXAMPLE = `Push
Incline bench press 3x8-12
Overhead press 4x6, rest 2 min
Lateral raises 3 sets of 15
Tricep pushdown 3x12

Pull
Pull ups 4xAMRAP
Barbell row 4x8-10
Hammer curl 3x10`

function ProgramSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [makeActive, setMakeActive] = useState(true)
  const existing = useQuery(() => ({ splits: listSplits(), active: getProfile().active_split_id }), [open])
  const [mode, setMode] = useState<'replace' | 'new'>('replace')
  const [muscles, setMuscles] = useState<Record<string, MuscleGroup>>({})
  const program = useMemo(() => parseProgram(text), [text])
  const days = program.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, muscle: muscles[e.name] ?? e.muscle })) }))
  const count = days.reduce((a, d) => a + d.exercises.length, 0)
  const busy = useRef(false)
  const finalName = name.trim() || program.title || 'My program'
  // The split this one replaces: one with the same name, otherwise the active split.
  const target = existing?.splits.find((x) => x.name.trim().toLowerCase() === finalName.toLowerCase()) ?? existing?.splits.find((x) => x.id === existing.active)
  const create = () => {
    if (busy.current) return
    busy.current = true
    setTimeout(() => { busy.current = false }, 1000)
    const id = createSplitFromProgram(finalName, days)
    if (target && mode === 'replace') deleteSplit(target.id)
    if (makeActive || (target && mode === 'replace' && target.id === existing?.active)) saveProfile({ active_split_id: id })
    setText(''); setName(''); setMuscles({})
    onCreated(id)
  }
  return (
    <Sheet open={open} onClose={onClose} xwide title="Type your program">
      <div className="grid stack-md" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
        <div className="col" style={{ gap: 10 }}>
          <input className="input" placeholder={program.title ?? 'Split name, e.g. My Upper / Lower'} value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="input program-text" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} spellCheck={false} />
          <div className="t-xs faint">One exercise per line with sets and reps, like <b>3x8-12</b> or <b>4 sets of 10</b>. Put a day name (Push, Day 1, Monday) on its own line before its exercises. Add <b>rest 90s</b> to set the rest, or I'll pick one.</div>
        </div>
        <div className="col" style={{ gap: 12 }}>
          {!count && <div className="card flat pad-sm t-sm muted">{text.trim() ? <>I couldn't find exercises yet. Put each exercise on its own line, like <b>Bench press 3x8</b>, with the day name (Push, Monday) on the line above.</> : 'Your split will appear here as you type.'}</div>}
          {days.map((d, i) => (
            <div key={i} className="card flat pad-sm" style={{ background: 'var(--surface)' }}>
              <div className="row between" style={{ marginBottom: 8 }}><span className="w-600">{d.name}{d.weekdays?.length ? <span className="t-xs accent" style={{ marginLeft: 8 }}>{d.weekdays.map((w) => WEEKDAYS[w]).join(', ')}</span> : null}</span><span className="t-xs faint">{d.exercises.length} exercise{d.exercises.length === 1 ? '' : 's'} · {d.exercises.reduce((a, e) => a + e.sets, 0)} sets</span></div>
              <div className="col" style={{ gap: 6 }}>
                {d.exercises.map((e, j) => (
                  <div key={j} className="row" style={{ gap: 8 }}>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="t-sm w-500">{e.name}</div>
                      <div className="t-xs faint num">{e.sets} × {e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}–${e.repsMax}`} · rest {e.rest >= 60 ? `${Math.floor(e.rest / 60)}:${String(e.rest % 60).padStart(2, '0')}` : `${e.rest}s`}{!e.restGiven && ' (suggested)'}{e.setsGuessed && <span style={{ color: 'var(--warn)' }}> · sets guessed</span>}</div>
                    </div>
                    <select className="input sm" style={{ width: 140 }} aria-label="Muscle" value={e.muscle} onChange={(ev) => setMuscles((m) => ({ ...m, [e.name]: ev.target.value as MuscleGroup }))}>
                      {MUSCLE_GROUPS.map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {count > 0 && (
            <>
              {target && (
                <div className="col" style={{ gap: 6 }}>
                  <label className="row t-sm" style={{ gap: 8 }}><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace "{target.name}" (your workout history stays)</label>
                  <label className="row t-sm" style={{ gap: 8 }}><input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} /> Keep it and add this as another split</label>
                </div>
              )}
              <label className="row t-sm" style={{ gap: 8 }}><input type="checkbox" checked={makeActive} onChange={(e) => setMakeActive(e.target.checked)} /> Make this my active split</label>
              <Button variant="primary" size="lg" onClick={create} style={{ position: 'sticky', bottom: 12, zIndex: 2 }}>{target && mode === 'replace' ? 'Save split' : 'Create split'} · {days.length} day{days.length > 1 ? 's' : ''}, {count} exercises</Button>
            </>
          )}
        </div>
      </div>
    </Sheet>
  )
}

function SplitDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const data = useQuery(() => {
    const s = listSplits().find((x) => x.id === id)
    return s ? { split: s, days: listDays(id), active: getProfile().active_split_id === id } : null
  }, [id])
  const [order, setOrder] = useState<number[]>([])
  useEffect(() => { if (data) setOrder(data.days.map((d) => d.id)) }, [data?.days.map((d) => d.id).join(',')])
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!data) return null
  const { split, days, active } = data
  const dayMap = new Map(days.map((d) => [d.id, d]))

  return (
    <motion.div className="card split-detail" style={{ padding: 32, borderRadius: 28 }}
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0, transition: softSpring }} exit={{ opacity: 0, x: 16, transition: { duration: 0.14, ease: 'easeIn' } }}>
      <div className="row between wrap-md" style={{ marginBottom: 20 }}>
        <Button variant="ghost" size="sm" onClick={onBack} style={{ marginLeft: -10 }}><ArrowLeft size={15} /> All splits</Button>
        <motion.div className="row" style={{ gap: 6 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          {active ? <span className="chip accent"><Star size={11} fill="currentColor" /> Active split</span>
            : <Button size="sm" onClick={() => saveProfile({ active_split_id: id })}><Star size={14} /> Set as active</Button>}
          <Button size="sm" onClick={() => duplicateSplit(id)}><Copy size={14} /> Duplicate</Button>
          {confirmDelete
            ? <Button size="sm" variant="danger" onClick={() => { if (active) saveProfile({ active_split_id: null }); deleteSplit(id); onBack() }}>Delete for good?</Button>
            : <IconButton label="Delete split" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /></IconButton>}
        </motion.div>
      </div>
      <div>
        <input className="input bare page-title" value={split.name} onChange={(e) => updateSplit(id, { name: e.target.value })} style={{ width: Math.max(8, split.name.length + 1) + 'ch', maxWidth: '100%' }} />
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...softSpring, delay: 0.12 }}>
        <input className="input bare muted" placeholder="Add a short description" value={split.description} onChange={(e) => updateSplit(id, { description: e.target.value })} style={{ marginTop: 6, width: '100%' }} />
        <div className="divider" style={{ margin: '24px 0' }} />
        <WeekPlan splitId={id} days={days} />
        <Reorder.Group axis="y" values={order} onReorder={setOrder} as="div" className="col" style={{ gap: 14 }}>
          {order.map((dayId, i) => dayMap.get(dayId) && (
            <DayCard key={dayId} day={dayMap.get(dayId)!} index={i} onDrop={() => reorder('split_days', order)} />
          ))}
        </Reorder.Group>
        <Button style={{ marginTop: 16 }} onClick={() => addDay(id, `Day ${days.length + 1}`)}><Plus size={15} /> Add day</Button>
      </motion.div>
    </motion.div>
  )
}

function WeekPlan({ splitId, days }: { splitId: number; days: SplitDay[] }) {
  const week = useQuery(() => getSchedule(splitId), [splitId, days.length])
  const todayW = weekdayOf()
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <div><span className="w-600">Weekly plan</span> <span className="t-xs faint">{week ? 'Tap a day to change it' : 'Tap a day to pick its workout'}</span></div>
        {week && <button className="t-xs faint" onClick={() => clearSchedule(splitId)}>Clear</button>}
      </div>
      <div className="week-plan">
        {WEEKDAYS.map((w, i) => {
          const dayId = week?.[i] ?? null
          const name = dayId ? days.find((d) => d.id === dayId)?.name : undefined
          return (
            <label key={w} className={`week-cell ${name ? 'on' : ''} ${i === todayW ? 'is-today' : ''}`}>
              <div className="wd">{w}</div>
              <div className="wn">{name ?? (week ? 'Rest' : '–')}</div>
              <select aria-label={`${w} workout`} value={dayId ?? ''} onChange={(e) => setScheduleDay(splitId, i, e.target.value ? Number(e.target.value) : null)}>
                <option value="">Rest</option>
                {days.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function DayCard({ day, index, onDrop }: { day: SplitDay; index: number; onDrop: () => void }) {
  const controls = useDragControls()
  const ex = useQuery(() => dayExercises(day.id), [day.id])
  const [order, setOrder] = useState<number[]>([])
  useEffect(() => { if (ex) setOrder(ex.map((e) => e.id)) }, [ex?.map((e) => e.id).join(',')])
  const [picking, setPicking] = useState(false)
  if (!ex) return null
  const exMap = new Map(ex.map((e) => [e.id, e]))

  return (
    <Reorder.Item value={day.id} as="div" dragListener={false} dragControls={controls} onDragEnd={onDrop}
      className="card flat day-card" style={{ padding: 20, background: 'var(--surface)' }}
      whileDrag={{ scale: 1.01, boxShadow: 'var(--shadow-lg)' }} transition={spring}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div onPointerDown={(e) => controls.start(e)} style={{ cursor: 'grab', touchAction: 'none', color: 'var(--text-3)' }} title="Drag to reorder"><GripVertical size={16} /></div>
        <span className="label num" style={{ width: 22 }}>{String(index + 1).padStart(2, '0')}</span>
        <input className="input bare w-600 grow" value={day.name} onChange={(e) => renameDay(day.id, e.target.value)} style={{ fontSize: 16 }} />
        <span className="t-xs faint hide-md">{ex.length} exercises · {ex.reduce((a, e) => a + e.sets, 0)} sets</span>
        <IconButton label="Delete day" className="sm" onClick={() => deleteDay(day.id)}><Trash2 size={14} /></IconButton>
      </div>
      {ex.length > 0 && (
        <div className="ex-head t-xs faint hide-md">
          <span /><span>Exercise</span><span>Sets</span><span>Reps from</span><span>Reps to</span><span>Rest (sec)</span><span />
        </div>
      )}
      <Reorder.Group axis="y" values={order} onReorder={setOrder} as="div" className="col" style={{ gap: 4 }}>
        <AnimatePresence initial={false}>
          {order.map((eid) => exMap.get(eid) && <ExerciseRow key={eid} e={exMap.get(eid)!} onDrop={() => reorder('day_exercises', order)} />)}
        </AnimatePresence>
      </Reorder.Group>
      <Button size="sm" variant="ghost" style={{ marginTop: 8 }} onClick={() => setPicking(true)}><Plus size={14} /> Add exercise</Button>
      <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={(exId) => { addDayExercise(day.id, exId); setPicking(false) }} />
    </Reorder.Item>
  )
}

function ExerciseRow({ e, onDrop }: { e: DayExercise; onDrop: () => void }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={e.id} as="div" dragListener={false} dragControls={controls} onDragEnd={onDrop}
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      whileDrag={{ scale: 1.01, boxShadow: 'var(--shadow-md)' }}
      className="ex-row">
      <div className="ex-grip" onPointerDown={(ev) => controls.start(ev)} title="Drag to reorder"><GripVertical size={14} /></div>
      <div className="ex-name"><span className="t-sm w-500">{e.name}</span><span className="chip" style={{ height: 22 }}>{e.muscle}</span></div>
      <div className="ex-fields">
        <label className="ex-field"><span>Sets</span><Stepper value={e.sets} min={1} max={12} onChange={(v) => updateDayExercise(e.id, { sets: v })} /></label>
        <label className="ex-field"><span>Reps from</span><Stepper value={e.reps_min} min={1} max={50} onChange={(v) => updateDayExercise(e.id, { reps_min: v, reps_max: Math.max(v, e.reps_max) })} /></label>
        <label className="ex-field"><span>Reps to</span><Stepper value={e.reps_max} min={e.reps_min} max={50} onChange={(v) => updateDayExercise(e.id, { reps_max: v })} /></label>
        <label className="ex-field"><span>Rest (sec)</span><Stepper value={e.rest_sec} min={15} max={600} step={15} width={58} onChange={(v) => updateDayExercise(e.id, { rest_sec: v })} /></label>
      </div>
      <IconButton label="Remove exercise" className="sm ex-remove" onClick={() => removeDayExercise(e.id)}><X size={14} /></IconButton>
    </Reorder.Item>
  )
}

export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (id: number) => void }) {
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup>('Chest')
  const exercises = useQuery(() => listExercises(), [open])
  const filtered = useMemo(() => (exercises ?? []).filter((e) => e.name.toLowerCase().includes(q.toLowerCase())), [exercises, q])
  const exact = filtered.some((e) => e.name.toLowerCase() === q.trim().toLowerCase())
  return (
    <Sheet open={open} onClose={onClose} title="Add exercise">
      <div className="row" style={{ marginBottom: 14, position: 'relative' }}>
        <Search size={15} className="faint" style={{ position: 'absolute', left: 12 }} />
        <input className="input" autoFocus placeholder="Search or type a new exercise" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 36 }} />
      </div>
      {q.trim() && !exact && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="card flat pad-sm row" style={{ marginBottom: 12 }}>
          <div className="grow"><div className="t-sm w-600">Create “{q.trim()}”</div><div className="t-xs muted">Pick the main muscle it trains</div></div>
          <select className="input sm" style={{ width: 140 }} value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup)}>
            {MUSCLE_GROUPS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <Button size="sm" variant="primary" onClick={() => { onPick(ensureExercise(q.trim(), muscle)); setQ('') }}><Check size={14} /> Add</Button>
        </motion.div>
      )}
      <motion.div className="col" style={{ gap: 2, maxHeight: 360, overflow: 'auto' }} variants={stagger} initial="hidden" animate="show">
        {filtered.map((e) => (
          <motion.button key={e.id} variants={rise} className="list-row hover" style={{ textAlign: 'left' }} whileTap={{ scale: 0.98 }} onClick={() => { onPick(e.id); setQ('') }}>
            <span className="grow t-sm w-500">{e.name}</span><span className="chip">{e.muscle}</span>
          </motion.button>
        ))}
        {!filtered.length && !q && <div className="t-sm muted">No exercises yet. Type a name to create one.</div>}
      </motion.div>
    </Sheet>
  )
}

