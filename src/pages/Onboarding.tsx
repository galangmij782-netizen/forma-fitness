import { motion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button, Segmented, Sheet, Stepper, rise, stagger } from '../components/ui'
import { today } from '../lib/dates'
import { ACTIVITY, PHASES, computeTargets } from '../lib/nutrition'
import { createSplit, getProfile, logWeight, saveProfile } from '../lib/repo'
import { loadSampleData } from '../lib/sample'
import type { Activity, Phase, Sex } from '../lib/types'

export function Onboarding() {
  const p = getProfile()
  const [sex, setSex] = useState<Sex>(p.sex)
  const [age, setAge] = useState(p.age)
  const [height, setHeight] = useState(p.height_cm)
  const [kg, setKg] = useState(75)
  const [activity, setActivity] = useState<Activity>(p.activity)
  const [phase, setPhase] = useState<Phase>(p.phase)
  const t = computeTargets({ sex, age, height_cm: height, activity, phase }, kg)

  const start = () => {
    logWeight(today(), kg)
    const split = createSplit('ppl')
    saveProfile({ sex, age, height_cm: height, activity, phase, active_split_id: split, onboarded: true })
  }
  const sample = () => loadSampleData()

  return (
    <Sheet open onClose={() => {}} wide>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={rise} className="label" style={{ marginBottom: 6 }}>Welcome</motion.div>
        <motion.h2 variants={rise} className="page-title" style={{ fontSize: 26, marginBottom: 6 }}>Let's set your starting point</motion.h2>
        <motion.p variants={rise} className="muted t-sm" style={{ marginBottom: 28 }}>These set your calorie and macro targets. You can change any of it later in Settings.</motion.p>
        <motion.div variants={rise} className="grid g-2" style={{ gap: 20 }}>
          <div className="field"><span className="label">Sex</span><Segmented value={sex} onChange={setSex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} /></div>
          <div className="field"><span className="label">Age</span><Stepper value={age} onChange={setAge} min={14} max={90} /></div>
          <div className="field"><span className="label">Height (cm)</span><Stepper value={height} onChange={setHeight} min={120} max={230} /></div>
          <div className="field"><span className="label">Body weight (kg)</span><Stepper value={kg} onChange={setKg} step={0.5} min={30} max={250} /></div>
          <label className="field"><span className="label">Activity</span>
            <select className="input" value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
              {Object.entries(ACTIVITY).map(([k, v]) => <option key={k} value={k}>{v.label}: {v.hint}</option>)}
            </select></label>
          <label className="field"><span className="label">Goal phase</span>
            <select className="input" value={phase} onChange={(e) => setPhase(e.target.value as Phase)}>
              {Object.entries(PHASES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></label>
        </motion.div>
        <motion.div variants={rise} className="card flat" style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[['Calories', t.kcal.toLocaleString(), 'kcal'], ['Protein', `${t.protein}`, 'g'], ['Carbs', `${t.carbs}`, 'g'], ['Fat', `${t.fat}`, 'g']].map(([l, v, u]) => (
            <div key={l}><div className="label">{l}</div><div className="t-lg w-600 num">{v} <span className="t-xs muted">{u}</span></div></div>
          ))}
        </motion.div>
        <motion.div variants={rise} className="row between" style={{ marginTop: 28 }}>
          <Button variant="ghost" onClick={sample}><Sparkles size={15} /> Explore with sample data</Button>
          <Button variant="primary" size="lg" onClick={start}>Start tracking</Button>
        </motion.div>
      </motion.div>
    </Sheet>
  )
}
