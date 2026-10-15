import { AnimatePresence, motion } from 'motion/react'
import { Camera, ChevronLeft, ChevronRight, Flame, ImagePlus, KeyRound, Pencil, Plus, Search, Sparkles, Star, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useCelebrate } from '../components/Celebrate'
import { Ring } from '../components/Ring'
import { Bar, Button, Card, CountUp, Empty, IconButton, PageHeader, Sheet, Skeleton, rise, softSpring, spring, stagger, useToast } from '../components/ui'
import { useQuery } from '../lib/db'
import { addDays, fmtDay, nowTime, today } from '../lib/dates'
import { useDayTotals, useTargets } from '../lib/hooks'
import { useNav, useSession } from '../lib/nav'
import { platform } from '../lib/platform'
import { dayTotals, deleteMeal, favoriteFoods, mealsOn, recentFoods, saveFood, saveMeal, searchFoods, toggleFavorite } from '../lib/repo'
import type { Food, Meal, MealItem } from '../lib/types'

const sum = (items: MealItem[], k: keyof Pick<MealItem, 'kcal' | 'protein' | 'carbs' | 'fat'>) => items.reduce((a, i) => a + (Number(i[k]) || 0), 0)

export function Meals() {
  const { params } = useNav()
  const [date, setDate] = useState(today())
  const [mode, setMode] = useState<null | 'photo' | 'manual' | { edit: Meal }>((params.add as 'photo') ?? null)
  const meals = useQuery(() => mealsOn(date), [date])
  const totals = useDayTotals(date)
  const t = useTargets()
  if (!meals || !totals || !t) return null
  const { targets } = t

  return (
    <motion.div className="page-inner" variants={stagger} initial="hidden" animate="show">
      <PageHeader title="Meals" sub={
        <span className="row" style={{ gap: 4 }}>
          <IconButton label="Previous day" className="sm" onClick={() => setDate(addDays(date, -1))}><ChevronLeft size={16} /></IconButton>
          <span style={{ minWidth: 150, textAlign: 'center' }}>{date === today() ? 'Today' : fmtDay(date, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          <IconButton label="Next day" className="sm" disabled={date >= today()} onClick={() => setDate(addDays(date, 1))}><ChevronRight size={16} /></IconButton>
        </span>}
        actions={<>
          <Button onClick={() => setMode('manual')}><Plus size={16} /> Add manually</Button>
          <Button variant="primary" onClick={() => setMode('photo')}><Camera size={16} /> Add from photo</Button>
        </>} />

      <Card className="stack-flex-md" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 36, justifyContent: 'center' }}>
        <Ring size={120} thickness={10} value={totals.kcal / targets.kcal}>
          <div><div className="t-lg w-600"><CountUp value={Math.round(totals.kcal)} /></div><div className="t-xs faint">kcal</div></div>
        </Ring>
        <div className="grow grid g-4" style={{ gap: 24 }}>
          {[
            { l: 'Calories', v: totals.kcal, tg: targets.kcal, u: 'kcal', c: 'var(--accent)' },
            { l: 'Protein', v: totals.protein, tg: targets.protein, u: 'g', c: 'var(--accent)' },
            { l: 'Carbs', v: totals.carbs, tg: targets.carbs, u: 'g', c: 'var(--accent-2)' },
            { l: 'Fat', v: totals.fat, tg: targets.fat, u: 'g', c: 'var(--accent-3)' },
          ].map((m, i) => (
            <div key={m.l} className="col" style={{ gap: 8 }}>
              <div className="row between"><span className="label">{m.l}</span><span className="t-xs faint num">{Math.round(m.tg).toLocaleString()} {m.u}</span></div>
              <Bar value={m.v / m.tg} delay={0.1 + i * 0.06} color={m.c} />
              <div className="t-sm num"><span className="w-600">{Math.max(0, Math.round(m.tg - m.v)).toLocaleString()}</span> <span className="muted">{m.u} left</span></div>
            </div>
          ))}
        </div>
      </Card>

      {meals.length === 0 ? (
        <Card><Empty icon={<Camera size={22} />} title="No meals logged" body="Take a photo of your plate for an instant estimate, or add foods you've saved." action={<Button variant="primary" onClick={() => setMode('photo')}><Camera size={15} /> Add from photo</Button>} /></Card>
      ) : (
        <motion.div className="col" style={{ gap: 12 }} variants={stagger}>
          <AnimatePresence initial={false}>
            {meals.map((m) => (
              <motion.div key={m.id} layout variants={rise} exit={{ opacity: 0, scale: 0.98 }} className="card meal-row" style={{ padding: 18, display: 'flex', gap: 18, alignItems: 'center' }} whileHover={{ y: -2 }} transition={spring}>
                {m.photo ? <img src={m.photo} alt="" style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover' }} />
                  : <div style={{ width: 64, height: 64, borderRadius: 14, background: 'var(--track)', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}><Flame size={20} /></div>}
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}><span className="w-600">{m.name}</span><span className="t-xs faint num">{m.time}</span>{m.source === 'photo' && <span className="chip" style={{ height: 22 }}><Sparkles size={11} /> Photo estimate</span>}</div>
                  <div className="t-sm muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }}>{m.items.length === 1 && m.items[0].name === m.name ? `${Math.round(m.items[0].grams)} g` : m.items.map((i) => `${i.name} (${Math.round(i.grams)} g)`).join(' · ')}</div>
                </div>
                <div className="row num t-sm meal-macros" style={{ gap: 20 }}>
                  <span><span className="w-600">{Math.round(sum(m.items, 'kcal'))}</span> <span className="faint">kcal</span></span>
                  <span className="muted">P {Math.round(sum(m.items, 'protein'))}</span>
                  <span className="muted">C {Math.round(sum(m.items, 'carbs'))}</span>
                  <span className="muted">F {Math.round(sum(m.items, 'fat'))}</span>
                </div>
                <IconButton label="Edit meal" onClick={() => setMode({ edit: m })}><Pencil size={15} /></IconButton>
                <IconButton label="Delete meal" onClick={() => deleteMeal(m.id)}><Trash2 size={15} /></IconButton>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <Sheet open={mode === 'photo'} onClose={() => setMode(null)} xwide title="Meal from a photo"><PhotoFlow date={date} onDone={() => setMode(null)} /></Sheet>
      <Sheet open={mode === 'manual'} onClose={() => setMode(null)} xwide title="Add a meal"><ManualFlow date={date} onDone={() => setMode(null)} /></Sheet>
      <Sheet open={typeof mode === 'object' && mode !== null} onClose={() => setMode(null)} xwide title="Edit meal">
        {typeof mode === 'object' && mode !== null && <MealEditor date={date} initial={mode.edit} onDone={() => setMode(null)} />}
      </Sheet>
    </motion.div>
  )
}

// ---------- photo handling ----------
async function prepareImage(file: File) {
  const bmp = await createImageBitmap(file)
  const draw = (max: number, q: number) => {
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', q)
  }
  return { full: draw(1568, 0.86), thumb: draw(240, 0.78) }
}

function PhotoFlow({ date, onDone }: { date: string; onDone: () => void }) {
  const { profileId } = useSession()
  const { go } = useNav()
  const t = useTargets()
  const [img, setImg] = useState<{ full: string; thumb: string } | null>(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'analyzing' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ name: string; items: MealItem[]; notes: string } | null>(null)
  const [over, setOver] = useState(false)
  const [keySet, setKeySet] = useState<boolean | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { platform.key.status(profileId).then((s) => setKeySet(s.set)) }, [profileId])

  const pick = async (f?: File | null) => { if (f && f.type.startsWith('image/')) { setImg(await prepareImage(f)); setState('idle'); setResult(null) } }
  const analyze = async () => {
    if (!img || !t) return
    setState('analyzing'); setError('')
    try {
      const r = await platform.meal.analyze({ id: profileId, imageBase64: img.full.split(',')[1], mediaType: 'image/jpeg', model: t.profile.model, note })
      setResult({
        name: r.meal_name, notes: r.notes,
        items: r.items.map((i) => ({ name: i.name, grams: Math.round(i.grams), base_grams: i.grams, kcal: i.kcal, protein: i.protein_g, carbs: i.carbs_g, fat: i.fat_g, confidence: i.confidence })),
      })
      setState('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('NO_KEY') ? 'Add your Claude API key in Settings to analyze photos.' : msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
      setState('error')
    }
  }

  if (keySet === false) return (
    <Empty icon={<KeyRound size={22} />} title="Connect your Claude API key" body="Photo estimates use Claude's vision model with your own key, stored only on this device."
      action={<Button variant="primary" onClick={() => { onDone(); go('settings') }}>Open Settings</Button>} />
  )

  return (
    <div>
      {!img ? (
        <motion.label className="photo-drop" data-over={over} whileHover={{ scale: 1.005 }} transition={spring}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void pick(e.dataTransfer.files[0]) }}>
          <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
          <div>
            <div className="empty-icon"><ImagePlus size={22} /></div>
            <div className="w-600">Drop a photo, or click to choose one</div>
            <div className="t-sm muted" style={{ marginTop: 4 }}>On a phone or tablet this opens the camera</div>
          </div>
        </motion.label>
      ) : (
        <div className="grid stack-md" style={{ gridTemplateColumns: '240px 1fr', gap: 28, alignItems: 'start' }}>
          <div className="col" style={{ gap: 12 }}>
            <motion.img layoutId="meal-photo" src={img.full} alt="Meal" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 18, boxShadow: 'var(--shadow-md)' }} />
            {state !== 'done' && (
              <textarea className="input t-sm" rows={2} placeholder="Optional context, e.g. “cooked in butter”, “large bowl”" value={note} onChange={(e) => setNote(e.target.value)} />
            )}
            <Button size="sm" variant="ghost" onClick={() => { setImg(null); setResult(null); setState('idle') }}><X size={14} /> Different photo</Button>
          </div>
          <div>
            <AnimatePresence mode="wait">
              {state === 'idle' && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="col" style={{ gap: 14, paddingTop: 8 }}>
                  <div className="w-600 t-lg">Ready to estimate</div>
                  <p className="t-sm muted">Claude will identify each food, guess the portion from the photo and estimate calories and macros. You'll check and correct everything before it's saved.</p>
                  <div><Button variant="primary" size="lg" onClick={analyze}><Sparkles size={16} /> Analyze photo</Button></div>
                </motion.div>
              )}
              {state === 'analyzing' && (
                <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} className="col" style={{ gap: 14 }}>
                  <div className="row" style={{ gap: 10 }}><Skeleton w={180} h={22} /><Skeleton w={90} h={22} r={11} /></div>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="row" style={{ gap: 12, padding: '10px 0' }}>
                      <Skeleton w="38%" h={16} /><Skeleton w={70} h={16} /><div className="grow" /><Skeleton w={60} h={16} /><Skeleton w={110} h={16} />
                    </div>
                  ))}
                  <Skeleton h={48} r={14} />
                  <div className="t-xs faint row" style={{ gap: 6 }}><Sparkles size={12} /> Looking at portions and ingredients…</div>
                </motion.div>
              )}
              {state === 'error' && (
                <motion.div key="err" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="col" style={{ gap: 12 }}>
                  <div className="w-600">Couldn't analyze this photo</div>
                  <p className="t-sm muted">{error}</p>
                  <div className="row"><Button onClick={analyze}>Try again</Button>{error.includes('Settings') && <Button variant="primary" onClick={() => { onDone(); go('settings') }}>Open Settings</Button>}</div>
                </motion.div>
              )}
              {state === 'done' && result && (
                <motion.div key="res" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
                  <MealEditor date={date} initial={{ name: result.name, items: result.items, source: 'photo', photo: img.thumb }} notes={result.notes} onDone={onDone} reveal />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- manual ----------
function ManualFlow({ date, onDone }: { date: string; onDone: () => void }) {
  const [q, setQ] = useState('')
  const [incoming, setIncoming] = useState<{ item: MealItem; n: number } | null>(null)
  const foods = useQuery(() => (q ? searchFoods(q) : null), [q])
  const recent = useQuery(() => recentFoods(), [])
  const favs = useQuery(() => favoriteFoods(), [])
  const add = (f: Food) => setIncoming({ n: Date.now(), item: { name: f.name, grams: f.grams, base_grams: f.grams, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, food_id: f.id } })
  const list = foods ?? [...(favs ?? []), ...(recent ?? []).filter((r) => !favs?.some((f) => f.id === r.id))]

  return (
    <div className="grid stack-md" style={{ gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start' }}>
      <div className="col" style={{ gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} className="faint" style={{ position: 'absolute', left: 12, top: 12 }} />
          <input className="input" placeholder="Search saved foods" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <div className="label">{q ? 'Results' : 'Favorites and recent'}</div>
        <motion.div className="col" style={{ gap: 2, maxHeight: 380, overflow: 'auto' }} variants={stagger} initial="hidden" animate="show" key={q}>
          {list.map((f) => (
            <motion.div key={f.id} variants={rise} className="list-row hover" style={{ padding: '8px 10px' }}>
              <button className="grow" style={{ textAlign: 'left' }} onClick={() => add(f)}>
                <div className="t-sm w-500">{f.name}</div>
                <div className="t-xs faint num">{Math.round(f.grams)} g · {Math.round(f.kcal)} kcal · {Math.round(f.protein)} g protein</div>
              </button>
              <IconButton label={f.favorite ? 'Unfavorite' : 'Favorite'} className="sm" onClick={() => toggleFavorite(f.id)}>
                <Star size={14} fill={f.favorite ? 'var(--accent)' : 'none'} color={f.favorite ? 'var(--accent)' : 'currentColor'} />
              </IconButton>
              <IconButton label="Add" className="sm" onClick={() => add(f)}><Plus size={14} /></IconButton>
            </motion.div>
          ))}
          {!list.length && <div className="t-sm muted" style={{ padding: 8 }}>{q ? 'No saved food matches. Add it as a custom item.' : 'Foods you log are saved here for next time.'}</div>}
        </motion.div>
      </div>
      <MealEditor date={date} initial={{ name: '', items: [], source: 'manual' }} incoming={incoming} onDone={onDone} manual />
    </div>
  )
}

// ---------- shared editor ----------
function MealEditor({ date, initial, notes, onDone, reveal, manual, incoming }: {
  date: string; initial: Partial<Meal> & { items: MealItem[] }; notes?: string; onDone: () => void; reveal?: boolean; manual?: boolean
  incoming?: { item: MealItem; n: number } | null
}) {
  const celebrate = useCelebrate()
  const toast = useToast()
  const t = useTargets()
  const [name, setName] = useState(initial.name ?? '')
  const [time, setTime] = useState(initial.time ?? nowTime())
  const [items, setItems] = useState<MealItem[]>(initial.items.map((i) => ({ ...i, base_grams: i.base_grams ?? i.grams })))
  useEffect(() => { if (incoming) setItems((x) => [...x, incoming.item]) }, [incoming?.n])
  const update = (idx: number, patch: Partial<MealItem>) => setItems((x) => x.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const setGrams = (idx: number, g: number) => setItems((x) => x.map((it, i) => {
    if (i !== idx) return it
    const base = it.base_grams || it.grams || 1
    const k = g / it.grams || 0
    return it.grams > 0 ? { ...it, grams: g, kcal: it.kcal * k, protein: it.protein * k, carbs: it.carbs * k, fat: it.fat * k, base_grams: base } : { ...it, grams: g }
  }))
  const totals = { kcal: sum(items, 'kcal'), protein: sum(items, 'protein'), carbs: sum(items, 'carbs'), fat: sum(items, 'fat') }
  const valid = items.length > 0 && items.every((i) => i.name.trim())

  const save = () => {
    if (!valid || !t) return
    const before = dayTotals(date, date)[0].protein - (initial.id ? sum(initial.items, 'protein') : 0)
    saveMeal({ id: initial.id, date, time, name: name.trim() || items.map((i) => i.name).slice(0, 2).join(' & '), source: initial.source ?? 'manual', photo: initial.photo, items })
    const after = before + totals.protein
    if (date === today() && before < t.targets.protein && after >= t.targets.protein) {
      celebrate({ icon: <Flame size={22} />, title: 'Protein target hit', value: Math.round(after), unit: 'g', caption: `Goal ${t.targets.protein} g for today` })
    } else toast({ icon: <Flame size={14} />, title: 'Meal saved', body: `${Math.round(totals.kcal)} kcal · ${Math.round(totals.protein)} g protein` })
    onDone()
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 10 }}>
        <input className="input w-600 grow" placeholder="Meal name" value={name} onChange={(e) => setName(e.target.value)} style={{ fontSize: 16 }} />
        <input className="input num" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 128 }} />
      </div>
      {reveal && (
        <div className="t-xs row" style={{ gap: 8, padding: '8px 12px', borderRadius: 12, background: 'color-mix(in oklab, var(--warn) 10%, transparent)', color: 'var(--warn)' }}>
          <Sparkles size={13} style={{ flex: 'none' }} /> These are estimates from a photo, not measurements. Check the foods and portions before saving.{notes ? ` ${notes}` : ''}
        </div>
      )}
      <div className="row t-xs faint hide-md" style={{ gap: 8, padding: '0 4px' }}>
        <span className="grow">Food</span><span style={{ width: 84, textAlign: 'center' }}>Grams</span><span style={{ width: 64, textAlign: 'center' }}>kcal</span>
        <span style={{ width: 52, textAlign: 'center' }}>P</span><span style={{ width: 52, textAlign: 'center' }}>C</span><span style={{ width: 52, textAlign: 'center' }}>F</span><span style={{ width: 28 }} />
      </div>
      <motion.div className="col" style={{ gap: 6 }} variants={stagger} initial={reveal ? 'hidden' : false} animate="show">
        <AnimatePresence initial={false}>
          {items.map((it, i) => (
            <motion.div key={i} variants={rise} layout exit={{ opacity: 0, x: -10 }} className="row wrap-md meal-item" style={{ gap: 8, padding: '6px 4px', borderRadius: 12 }}>
              <div className="grow row" style={{ gap: 6, minWidth: 0, flexBasis: 180 }}>
                <input className="input sm" style={{ minWidth: 0 }} value={it.name} placeholder="Food name" onChange={(e) => update(i, { name: e.target.value })} />
                {it.confidence && <span className={`chip ${it.confidence === 'low' ? 'warn' : ''}`} style={{ height: 22, flex: 'none' }} title="How sure the estimate is">{it.confidence}</span>}
              </div>
              <input className="input sm num" style={{ width: 84 }} value={Math.round(it.grams)} inputMode="numeric" onChange={(e) => setGrams(i, Number(e.target.value.replace(/\D/g, '')) || 0)} />
              {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
                <input key={k} className="input sm num" style={{ width: k === 'kcal' ? 64 : 52, padding: '0 4px' }} value={Math.round(it[k] * (k === 'kcal' ? 1 : 10)) / (k === 'kcal' ? 1 : 10)} inputMode="decimal"
                  onChange={(e) => update(i, { [k]: parseFloat(e.target.value) || 0 })} />
              ))}
              <IconButton label="Remove item" className="sm" onClick={() => setItems((x) => x.filter((_, j) => j !== i))}><X size={14} /></IconButton>
            </motion.div>
          ))}
        </AnimatePresence>
        {!items.length && <div className="t-sm muted" style={{ padding: '10px 4px' }}>{manual ? 'Pick foods on the left or add a custom item.' : 'No foods found. Add them below.'}</div>}
      </motion.div>
      <div className="row" style={{ gap: 6 }}>
        <Button size="sm" variant="ghost" onClick={() => setItems((x) => [...x, { name: '', grams: 100, kcal: 0, protein: 0, carbs: 0, fat: 0 }])}><Plus size={14} /> Custom item</Button>
        {items.length > 0 && <Button size="sm" variant="ghost" onClick={() => { items.filter((i) => i.name.trim()).forEach((i) => saveFood({ name: i.name.trim(), grams: i.grams, kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat })); toast({ title: 'Saved to favorites' }) }}><Star size={14} /> Save foods as favorites</Button>}
      </div>
      <motion.div layout className="card flat pad-sm row between wrap-md" style={{ background: 'var(--surface)' }}>
        <div className="row num" style={{ gap: 22 }}>
          <span><span className="t-lg w-600"><CountUp value={Math.round(totals.kcal)} duration={0.5} /></span> <span className="t-sm faint">kcal</span></span>
          <span className="t-sm muted">P <span className="w-600" style={{ color: 'var(--text)' }}>{Math.round(totals.protein)}</span> g</span>
          <span className="t-sm muted">C <span className="w-600" style={{ color: 'var(--text)' }}>{Math.round(totals.carbs)}</span> g</span>
          <span className="t-sm muted">F <span className="w-600" style={{ color: 'var(--text)' }}>{Math.round(totals.fat)}</span> g</span>
        </div>
        <Button variant="primary" disabled={!valid} onClick={save}>Save meal</Button>
      </motion.div>
    </div>
  )
}
