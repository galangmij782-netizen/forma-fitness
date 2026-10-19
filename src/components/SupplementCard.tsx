import { AnimatePresence, motion } from 'motion/react'
import { Check, Pill, Plus, Settings2, X } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '../lib/db'
import { addDays, today } from '../lib/dates'
import { SUPPLEMENT_PRESETS, getSupplements, setSupplements, setTaken, supplementStreak, takenOn, type Supplement } from '../lib/supplements'
import { Button, Card, Sheet, rise, spring } from './ui'

/** Today's vitamins and supplements as a tick list. */
export function SupplementCard() {
  const data = useQuery(() => { const list = getSupplements(); return { list, taken: takenOn(today()), streak: supplementStreak(list, today(), addDays) } }, [])
  const [edit, setEdit] = useState(false)
  if (!data) return null
  const { list, taken, streak } = data
  const done = list.filter((s) => taken.has(s.name)).length

  return (
    <motion.div variants={rise}>
      <Card style={{ marginBottom: 16 }}>
        <div className="row between" style={{ gap: 8, marginBottom: list.length ? 12 : 6 }}>
          <div className="row" style={{ gap: 8 }}><Pill size={16} className="accent" /><span className="card-title">Supplements</span></div>
          <div className="row" style={{ gap: 10 }}>
            {list.length > 0 && <span className="t-xs muted num">{done}/{list.length} today{streak > 1 ? ` · ${streak} day streak` : ''}</span>}
            <button className="icon-btn sm" aria-label="Edit supplements" onClick={() => setEdit(true)}><Settings2 size={15} /></button>
          </div>
        </div>
        {list.length === 0 ? (
          <>
            <div className="t-sm muted" style={{ marginBottom: 10 }}>Tick off your vitamins each day. Pick the ones you take:</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {SUPPLEMENT_PRESETS.slice(0, 4).map((s) => <button key={s.name} className="chip-btn" onClick={() => setSupplements([...list, s])}><Plus size={12} /> {s.name}</button>)}
              <button className="chip-btn" onClick={() => setEdit(true)}>More…</button>
            </div>
          </>
        ) : (
          <div className="col" style={{ gap: 4 }}>
            {list.map((s) => {
              const on = taken.has(s.name)
              return (
                <motion.button key={s.name} className={`supp-row ${on ? 'on' : ''}`} whileTap={{ scale: 0.98 }} transition={spring} onClick={() => setTaken(today(), s.name, !on)} aria-pressed={on}>
                  <span className="supp-check"><AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring} style={{ display: 'grid' }}><Check size={13} strokeWidth={3} /></motion.span>}</AnimatePresence></span>
                  <span className="grow t-sm w-500" style={{ textAlign: 'left' }}>{s.name}</span>
                  <span className="t-xs faint">{s.dose}</span>
                </motion.button>
              )
            })}
          </div>
        )}
      </Card>
      <Sheet open={edit} onClose={() => setEdit(false)} title="Your supplements">
        <SupplementEditor list={list} />
      </Sheet>
    </motion.div>
  )
}

function SupplementEditor({ list }: { list: Supplement[] }) {
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const has = (n: string) => list.some((s) => s.name.toLowerCase() === n.toLowerCase())
  const add = (s: Supplement) => { if (s.name.trim() && !has(s.name)) setSupplements([...list, { name: s.name.trim(), dose: s.dose.trim() }]) }
  return (
    <div className="col" style={{ gap: 14 }}>
      {list.length > 0 && (
        <div className="col" style={{ gap: 4 }}>
          {list.map((s) => (
            <div key={s.name} className="supp-row">
              <span className="grow t-sm w-500">{s.name}</span>
              <span className="t-xs faint">{s.dose}</span>
              <button className="icon-btn sm" aria-label={`Remove ${s.name}`} onClick={() => setSupplements(list.filter((x) => x !== s))}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="label">Add common ones</div>
      <div className="row wrap" style={{ gap: 6 }}>
        {SUPPLEMENT_PRESETS.filter((s) => !has(s.name)).map((s) => <button key={s.name} className="chip-btn" onClick={() => add(s)}><Plus size={12} /> {s.name}</button>)}
      </div>
      <div className="label">Or add your own</div>
      <div className="row wrap" style={{ gap: 8 }}>
        <input className="input grow" style={{ minWidth: 140 }} placeholder="Name, e.g. Centrum" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" style={{ width: 120 }} placeholder="Dose" value={dose} onChange={(e) => setDose(e.target.value)} />
        <Button variant="primary" disabled={!name.trim() || has(name)} onClick={() => { add({ name, dose }); setName(''); setDose('') }}><Plus size={14} /> Add</Button>
      </div>
      <p className="t-xs muted">Vitamins, creatine and fish oil have almost no calories, so they don't count toward your macros. Log protein powder and mass gainers in Meals, since those do.</p>
    </div>
  )
}
