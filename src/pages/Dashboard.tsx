import { motion } from 'motion/react'
import { ArrowRight, Camera, Dumbbell, Flame, Lightbulb, Play, Plus, Scale, TrendingUp, TriangleAlert } from 'lucide-react'
import { Sparkline } from '../components/Charts'
import { Ring } from '../components/Ring'
import { Button, Card, CountUp, Empty, PageHeader, cardPress, rise, stagger } from '../components/ui'
import { useQuery } from '../lib/db'
import { fmtDay, greeting, today } from '../lib/dates'
import { useDayTotals, useTargets, useWeekTotals, useIsPhone } from '../lib/hooks'
import { weeklyInsights, type Insight } from '../lib/insights'
import { CoachTips, useCoach } from '../components/Coach'
import { useNav, useSession } from '../lib/nav'
import { PHASES } from '../lib/nutrition'
import { activeSession, allSets, dayExercises, getSplit, mealsOn, nextDay, splitMuscles } from '../lib/repo'
import { analyzeTraining } from '../lib/training'
import { weeklyRate } from '../lib/trend'
import { useUnits } from '../lib/units'

export function Dashboard() {
  const { go } = useNav()
  const { name } = useSession()
  const phone = useIsPhone()
  const coach = useCoach(today())
  const t = useTargets()
  const totals = useDayTotals()
  const week = useWeekTotals()
  const meals = useQuery(() => mealsOn(today()), [])
  const workout = useQuery(() => {
    const live = activeSession()
    const sid = t?.profile.active_split_id
    const split = sid ? getSplit(sid) : undefined
    const day = sid ? nextDay(sid) : undefined
    return { live, split, day, ex: day ? dayExercises(day.id) : [] }
  }, [t?.profile.active_split_id])
  const flags = useQuery(() => t && analyzeTraining({
    sets: allSets(), today: today(), cutting: t.profile.phase === 'cut',
    plannedMuscles: t.profile.active_split_id ? splitMuscles(t.profile.active_split_id) : [],
  }).filter((f) => f.kind !== 'ready'), [t?.profile.phase])
  const u = useUnits()
  if (!t || !totals || !week) return null

  const { targets } = t
  const insights = weeklyInsights(week, targets, t.profile.phase, t.trend)
  const rate = weeklyRate(t.trend)
  const left = targets.kcal - totals.kcal
  const macros = [
    { label: 'Protein', v: totals.protein, target: targets.protein, color: 'var(--accent)' },
    { label: 'Carbs', v: totals.carbs, target: targets.carbs, color: 'var(--accent-2)' },
    { label: 'Fat', v: totals.fat, target: targets.fat, color: 'var(--accent-3)' },
  ]

  return (
    <motion.div className="page-inner" variants={stagger} initial="hidden" animate="show">
      <PageHeader title={`${greeting()}, ${name}`} sub={fmtDay(today(), { weekday: 'long', month: 'long', day: 'numeric' })}
        actions={<>
          <Button onClick={() => go('meals', { add: 'type' })}><Plus size={16} /> Log meal</Button>
          <Button variant="primary" onClick={() => go('workouts', workout?.live ? {} : { startDay: workout?.day?.id })}>
            <Play size={15} /> {workout?.live ? 'Continue workout' : 'Start workout'}
          </Button>
        </>} />

      <div className="grid stack-md" style={{ gridTemplateColumns: '1.55fr 1fr', marginBottom: 16 }}>
        <Card style={{ padding: 32 }}>
          <div className="row between" style={{ marginBottom: 24 }}>
            <div className="card-title">Today's nutrition</div>
            <span className="chip accent">{PHASES[t.profile.phase].label}</span>
          </div>
          <div className="row stack-flex-md" style={{ gap: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Ring size={phone ? 150 : 196} thickness={phone ? 12 : 14} value={totals.kcal / targets.kcal}>
              <div>
                <div className="t-2xl w-600" style={{ lineHeight: 1 }}><CountUp value={Math.round(totals.kcal)} /></div>
                <div className="t-xs faint" style={{ marginTop: 6 }}>of {targets.kcal.toLocaleString()} kcal</div>
              </div>
            </Ring>
            <div className="grow col" style={{ gap: 22 }}>
              <div>
                <div className="label">{left >= 0 ? 'Left today' : 'Over today'}</div>
                <div className="t-xl w-600"><CountUp value={Math.abs(Math.round(left))} /> <span className="t-sm muted">kcal</span></div>
              </div>
              <div className="grid g-3 macro-grid" style={{ gap: 16 }}>
                {macros.map((m, i) => (
                  <div key={m.label} className="row" style={{ gap: 12, whiteSpace: 'nowrap' }}>
                    <Ring size={48} thickness={5} value={m.v / m.target} color={m.color} delay={0.12 + i * 0.08} />
                    <div>
                      <div className="label">{m.label}</div>
                      <div className="w-600 num t-sm"><CountUp value={Math.round(m.v)} /><span className="faint w-500"> / {m.target} g</span></div>
                      <div className="t-xs faint num">{Math.max(0, Math.round(m.target - m.v))} g left</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card interactive onClick={() => go('workouts', workout?.live ? {} : { startDay: workout?.day?.id })}>
          <div className="row between" style={{ marginBottom: 18 }}>
            <div className="card-title">{workout?.live ? 'Workout in progress' : 'Next workout'}</div>
            <Dumbbell size={16} className="faint" />
          </div>
          {workout?.day ? (
            <>
              <div className="t-xl w-600" style={{ letterSpacing: '-0.02em' }}>{workout.live?.day_name ?? workout.day.name}</div>
              <div className="t-sm muted" style={{ marginBottom: 18 }}>{workout.split?.name} · {workout.ex.length} exercises</div>
              <div className="col" style={{ gap: 10 }}>
                {workout.ex.slice(0, 4).map((e) => (
                  <div key={e.id} className="row between t-sm">
                    <span>{e.name}</span><span className="faint num">{e.sets} × {e.reps_min}–{e.reps_max}</span>
                  </div>
                ))}
                {workout.ex.length > 4 && <div className="t-xs faint">+{workout.ex.length - 4} more</div>}
              </div>
              <div className="row accent t-sm w-500" style={{ marginTop: 20, gap: 6 }}>{workout.live ? 'Continue' : 'Start session'} <ArrowRight size={15} /></div>
            </>
          ) : (
            <div className="muted t-sm">Set up a split to see your next session here.</div>
          )}
        </Card>
      </div>

      {coach && <CoachTips tips={coach} limit={2} footer={coach.length > 2 && <button className="row accent t-sm w-500" style={{ gap: 6, marginTop: 16 }} onClick={() => go('meals')}>{coach.length - 2} more tips in Meals <ArrowRight size={14} /></button>} />}

      <div className="grid g-3" style={{ marginBottom: 16 }}>
        <Card interactive onClick={() => go('progress', { tab: 'body' })}>
          <div className="row between"><div className="label">Trend weight</div><Scale size={15} className="faint" /></div>
          <div className="row between" style={{ alignItems: 'flex-end', marginTop: 8 }}>
            <div>
              <div className="t-xl w-600"><CountUp value={u.toDisplay(t.kg)} decimals={1} /> <span className="t-sm muted">{u.unit}</span></div>
              <div className="t-xs muted num">{rate ? `${rate.pctPerWeek >= 0 ? '+' : ''}${rate.pctPerWeek.toFixed(2)}% per week` : 'Log a week of weigh-ins'}</div>
            </div>
            <Sparkline values={t.trend.slice(-28).map((p) => p.trend)} />
          </div>
        </Card>
        <Card>
          <div className="row between"><div className="label">Protein this week</div><Flame size={15} className="faint" /></div>
          <div className="t-xl w-600" style={{ marginTop: 8 }}>
            <CountUp value={week.filter((d) => d.kcal > 0 && d.protein >= targets.protein * 0.95).length} /> <span className="t-sm muted">of {week.filter((d) => d.kcal > 0).length} days on target</span>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 12 }}>
            {week.map((d, i) => (
              <motion.div key={d.date} title={`${fmtDay(d.date)}: ${Math.round(d.protein)} g`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.04, type: 'spring', stiffness: 400, damping: 20 }}
                style={{ flex: 1, height: 8, borderRadius: 4, background: d.kcal === 0 ? 'var(--track)' : d.protein >= targets.protein * 0.95 ? 'var(--accent)' : 'var(--accent-3)' }} />
            ))}
          </div>
        </Card>
        <Card interactive onClick={() => go('progress', { tab: 'work' })}>
          <div className="row between"><div className="label">What needs work</div><TriangleAlert size={15} className="faint" /></div>
          {flags && flags.length ? (
            <>
              <div className="t-xl w-600" style={{ marginTop: 8 }}><CountUp value={flags.length} /> <span className="t-sm muted">{flags.length === 1 ? 'thing' : 'things'} to adjust</span></div>
              <div className="t-xs muted" style={{ marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flags[0].title}</div>
            </>
          ) : <div className="t-sm muted" style={{ marginTop: 8 }}>Nothing flagged. Keep logging sessions.</div>}
        </Card>
      </div>

      <div className="grid stack-md" style={{ gridTemplateColumns: '1fr 1.55fr' }}>
        <Card>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="card-title">Today's meals</div>
            <Button size="sm" variant="ghost" onClick={() => go('meals')}>All meals <ArrowRight size={14} /></Button>
          </div>
          {meals && meals.length ? (
            <div className="col" style={{ gap: 2 }}>
              {meals.map((m) => {
                const kcal = m.items.reduce((a, i) => a + i.kcal, 0)
                const p = m.items.reduce((a, i) => a + i.protein, 0)
                return (
                  <div key={m.id} className="list-row" style={{ padding: '10px 4px' }}>
                    <span className="t-xs faint num" style={{ width: 40 }}>{m.time}</span>
                    <span className="grow t-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                    <span className="t-sm num">{Math.round(kcal)}</span>
                    <span className="t-xs faint num" style={{ width: 44, textAlign: 'right' }}>{Math.round(p)}g P</span>
                  </div>
                )
              })}
            </div>
          ) : <Empty icon={<Camera size={22} />} title="Nothing logged yet" body="Snap a photo of your next meal and Forma will estimate it." />}
        </Card>
        <Card>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div className="card-title row" style={{ gap: 8 }}><Lightbulb size={16} className="accent" /> This week</div>
            <span className="t-xs faint">Last 7 days</span>
          </div>
          <motion.div className="col" style={{ gap: 10 }} variants={stagger} initial="hidden" animate="show">
            {insights.map((i) => <InsightRow key={i.id} i={i} />)}
          </motion.div>
        </Card>
      </div>
    </motion.div>
  )
}

export function InsightRow({ i }: { i: Insight }) {
  return (
    <motion.div variants={rise} {...cardPress} className="card flat pad-sm" style={{ background: 'var(--surface)' }}>
      <div className="row between" style={{ marginBottom: 4 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="dot" style={{ background: i.tone === 'good' ? 'var(--accent)' : i.tone === 'warn' ? 'var(--warn)' : 'var(--text-3)' }} />
          <span className="t-sm w-600">{i.title}</span>
        </div>
        <span className="t-sm w-600 num">{i.metric}</span>
      </div>
      <div className="t-xs muted" style={{ marginBottom: 6 }}>{i.detail}</div>
      <div className="t-sm row" style={{ gap: 8, alignItems: 'flex-start' }}><TrendingUp size={14} className="accent" style={{ marginTop: 3, flex: 'none' }} /> {i.suggestion}</div>
    </motion.div>
  )
}
