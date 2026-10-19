import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Moon, Pencil, Play, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '../lib/db'
import { fmtDay, iso, today } from '../lib/dates'
import { WEEKDAYS, activeSession, getSchedule, listDays, reopenSession, sessionsOn, setMark, startSession, trainingCalendar, type CalDay } from '../lib/repo'
import { Button, Card, Sheet, spring } from './ui'

const LABEL: Record<CalDay['state'], string> = {
  done: 'Trained', missed: 'Missed', skipped: "Didn't train", rest: 'Rest', planned: 'Planned', today: 'Today', none: '',
}

function monthRange(y: number, m: number) {
  const first = new Date(y, m, 1)
  const lead = (first.getDay() + 6) % 7
  const start = iso(new Date(y, m, 1 - lead))
  const last = new Date(y, m + 1, 0)
  const trail = 6 - ((last.getDay() + 6) % 7)
  return { start, end: iso(new Date(y, m + 1, trail)), month: iso(first).slice(0, 7) }
}

/** Month view of the plan: trained, missed, skipped and rest days. Tap a day to mark it. */
export function TrainingCalendar({ splitId, onPlan }: { splitId: number | null | undefined; onPlan?: () => void }) {
  const now = new Date()
  const [ym, setYm] = useState<[number, number]>([now.getFullYear(), now.getMonth()])
  const [open, setOpen] = useState<CalDay | null>(null)
  const { start, end, month } = monthRange(ym[0], ym[1])
  const data = useQuery(() => ({ days: trainingCalendar(splitId, start, end), scheduled: !!(splitId && getSchedule(splitId)) }), [splitId, start, end])
  if (!data) return null
  const inMonth = data.days.filter((d) => d.date.startsWith(month) && d.date <= today())
  const count = (s: CalDay['state']) => inMonth.filter((d) => d.state === s).length
  const shift = (n: number) => setYm(([y, m]) => { const d = new Date(y, m + n, 1); return [d.getFullYear(), d.getMonth()] })
  const title = new Date(ym[0], ym[1], 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const current = open && data.days.find((d) => d.date === open.date)

  return (
    <Card style={{ padding: 22, marginBottom: 20 }}>
      <div className="row between" style={{ marginBottom: 14, gap: 8 }}>
        <div className="row" style={{ gap: 8 }}><CalendarDays size={16} className="accent" /><span className="card-title">{title}</span></div>
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn sm" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
          <button className="icon-btn sm" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w) => <div key={w} className="cal-head">{w}</div>)}
        {data.days.map((d) => {
          const out = !d.date.startsWith(month)
          return (
            <motion.button key={d.date} whileTap={{ scale: 0.92 }} transition={spring}
              className={`cal-day s-${d.state} ${out ? 'out' : ''} ${d.date === today() ? 'is-today' : ''}`}
              onClick={() => setOpen(d)} aria-label={`${fmtDay(d.date)} ${LABEL[d.state]} ${d.planned ?? ''}`}>
              <span className="cal-num">{Number(d.date.slice(8))}</span>
              <span className="cal-tag">{d.state === 'done' ? <Check size={11} strokeWidth={3} /> : d.state === 'missed' || d.state === 'skipped' ? <X size={11} strokeWidth={3} /> : d.state === 'rest' ? <Moon size={10} /> : null}
                <span className="cal-name">{d.state === 'done' ? d.sessions[0] : d.state === 'rest' ? 'Rest' : d.state === 'none' ? '' : d.planned ?? ''}</span></span>
            </motion.button>
          )
        })}
      </div>
      <div className="row wrap t-xs muted" style={{ gap: 14, marginTop: 14 }}>
        <span className="row" style={{ gap: 6 }}><i className="cal-dot s-done" /> {count('done')} trained</span>
        <span className="row" style={{ gap: 6 }}><i className="cal-dot s-missed" /> {count('missed') + count('skipped')} missed</span>
        <span className="row" style={{ gap: 6 }}><i className="cal-dot s-rest" /> {count('rest')} rest</span>
        {!data.scheduled && onPlan && <button className="accent w-500" onClick={onPlan}>Set your weekly plan</button>}
      </div>

      <Sheet open={!!current} onClose={() => setOpen(null)} title={current ? fmtDay(current.date, { weekday: 'long', month: 'long', day: 'numeric' }) : ''}>
        {current && <DayDetail d={current} splitId={splitId} onClose={() => setOpen(null)} />}
      </Sheet>
    </Card>
  )
}

function DayDetail({ d, splitId, onClose }: { d: CalDay; splitId: number | null | undefined; onClose: () => void }) {
  const [note, setNote] = useState(d.mark?.note ?? '')
  const info = useQuery(() => ({ days: splitId ? listDays(splitId) : [], done: sessionsOn(d.date), busy: !!activeSession() }), [splitId, d.date])
  const [pick, setPick] = useState<number | undefined>(d.plannedDayId)
  const chosen = pick ?? info?.days[0]?.id
  const isToday = d.date === today()
  const isPast = d.date <= today()
  const reasons = ['Busy', 'Sick', 'Tired', 'Sore', 'Travel']
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card flat pad-sm" style={{ background: 'var(--surface)' }}>
        <div className="label">Plan</div>
        <div className="w-600">{d.planned ?? (d.restPlanned ? 'Rest day' : 'Nothing planned')}</div>
        {d.sessions.length > 0 && <div className="t-sm accent row" style={{ gap: 6, marginTop: 6 }}><Check size={14} /> Trained: {d.sessions.join(', ')}</div>}
        {d.state === 'missed' && <div className="t-sm" style={{ color: 'var(--danger)', marginTop: 6 }}>No workout was logged this day.</div>}
        {d.mark && <div className="t-sm muted" style={{ marginTop: 6 }}>Marked as {d.mark.status === 'rest' ? 'a rest day' : "didn't train"}{d.mark.note ? `: ${d.mark.note}` : ''}</div>}
      </div>
      {info && info.done.length > 0 && (
        <div className="row wrap" style={{ gap: 8 }}>
          {info.done.map((s) => <Button key={s.id} disabled={info.busy} onClick={() => { reopenSession(s.id); onClose() }}><Pencil size={14} /> Edit {s.day_name}</Button>)}
        </div>
      )}
      {isPast && info && info.days.length > 0 && (
        <>
          {!d.sessions.length && !isToday && <div className="label">Forgot to log it? Add the workout you did</div>}
          {d.sessions.length > 0 && <div className="label">Did another workout this day?</div>}
          {(!d.sessions.length || !isToday) && <div className="row wrap" style={{ gap: 6 }}>
            {info.days.map((x) => <button key={x.id} className={`chip-btn ${chosen === x.id ? 'on' : ''}`} onClick={() => setPick(x.id)}>{x.name}</button>)}
          </div>}
          {(!d.sessions.length || !isToday) && chosen && (
            <Button variant={d.sessions.length ? undefined : 'primary'} size="lg" disabled={info.busy} onClick={() => { startSession(chosen, d.date); onClose() }}>
              {isToday ? <><Play size={15} fill="currentColor" /> Start {info.days.find((x) => x.id === chosen)?.name}</> : <><Plus size={15} /> Log {info.days.find((x) => x.id === chosen)?.name} for this day</>}
            </Button>
          )}
          {info.busy && <div className="t-xs muted">Finish the workout that's open first.</div>}
        </>
      )}
      {isPast && !d.sessions.length && (
        <>
          <div className="label" style={{ marginTop: 6 }}>Or, didn't make it to the gym? Add a reason (optional)</div>
          <div className="row wrap" style={{ gap: 6 }}>
            {reasons.map((r) => <button key={r} className={`chip-btn ${note === r ? 'on' : ''}`} onClick={() => setNote(note === r ? '' : r)}>{r}</button>)}
          </div>
          <input className="input" placeholder="Or write your own" value={reasons.includes(note) ? '' : note} onChange={(e) => setNote(e.target.value)} />
          <div className="row wrap" style={{ gap: 8 }}>
            <Button variant="primary" onClick={() => { setMark(d.date, 'skipped', note); onClose() }}><X size={14} /> I didn't train</Button>
            <Button onClick={() => { setMark(d.date, 'rest', note); onClose() }}><Moon size={14} /> It was a rest day</Button>
            <AnimatePresence>{d.mark && <Button variant="ghost" onClick={() => { setMark(d.date, null); onClose() }}>Clear</Button>}</AnimatePresence>
          </div>
        </>
      )}
      {!isPast && <p className="t-sm muted">Future days follow your weekly plan. Change it in Splits.</p>}
    </div>
  )
}
