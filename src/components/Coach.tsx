import { motion } from 'motion/react'
import { CircleCheck, Info, Sparkles, TriangleAlert } from 'lucide-react'
import { all, useQuery } from '../lib/db'
import { coachDay, type CoachTip } from '../lib/coach'
import { today } from '../lib/dates'
import { useTargets } from '../lib/hooks'
import { mealsOn } from '../lib/repo'
import { Card, rise, stagger } from './ui'

const ICON = { good: CircleCheck, warn: TriangleAlert, neutral: Info }
const COLOR = { good: 'var(--accent)', warn: 'var(--warn)', neutral: 'var(--text-2)' }

export function useCoach(date: string) {
  const t = useTargets()
  const data = useQuery(() => ({
    meals: mealsOn(date),
    trained: all<{ n: number }>('SELECT COUNT(*) AS n FROM sets s JOIN sessions x ON x.id = s.session_id WHERE x.date = ?', [date])[0]?.n > 0,
  }), [date])
  if (!t || !data) return null
  return coachDay({ meals: data.meals, targets: t.targets, phase: t.profile.phase, trainedToday: data.trained, bodyweightKg: t.trend.length ? t.kg : null, hour: new Date().getHours(), isToday: date === today() })
}

export function CoachTips({ tips, limit, footer }: { tips: CoachTip[]; limit?: number; footer?: React.ReactNode }) {
  const shown = limit ? tips.slice(0, limit) : tips
  return (
    <Card style={{ marginBottom: 20 }}>
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <Sparkles size={16} className="accent" />
        <h3 className="w-600">Coach</h3>
        <span className="t-xs faint">Based on what you've eaten</span>
      </div>
      <motion.div className="col" style={{ gap: 14 }} variants={stagger} initial="hidden" animate="show">
        {shown.map((tip) => {
          const Icon = ICON[tip.tone]
          return (
            <motion.div key={tip.id} variants={rise} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <Icon size={17} style={{ color: COLOR[tip.tone], flex: 'none', marginTop: 2 }} />
              <div className="col" style={{ gap: 3, minWidth: 0 }}>
                <div className="t-sm w-600">{tip.title}</div>
                <div className="t-sm muted">{tip.detail}</div>
                <div className="t-xs faint"><b style={{ fontWeight: 600 }}>Why it matters:</b> {tip.why}</div>
              </div>
            </motion.div>
          )
        })}
      </motion.div>
      {footer}
    </Card>
  )
}
