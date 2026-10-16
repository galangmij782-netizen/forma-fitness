import { motion } from 'motion/react'
import { Check, Download, FolderOpen, KeyRound, Lock, ShieldCheck, Sparkles, Trash2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Card, PageHeader, Segmented, Stepper, rise, spring, stagger, useToast } from '../components/ui'
import { exportJson, importJson, wipeAll } from '../lib/db'
import { today } from '../lib/dates'
import { useTargets } from '../lib/hooks'
import { useSession } from '../lib/nav'
import { ACTIVITY, PHASES, computeTargets } from '../lib/nutrition'
import { platform, type KeyStatus } from '../lib/platform'
import { saveProfile } from '../lib/repo'
import { loadSampleData } from '../lib/sample'
import type { Activity, Phase } from '../lib/types'

const swatch: Record<string, string> = { green: '#5fd99a', blue: '#6aa8ff', violet: '#a99bff' }
const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'Most accurate' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hint: 'Faster, lower cost' },
]

export function Settings() {
  const t = useTargets()
  if (!t) return null
  return (
    <motion.div className="page-inner" variants={stagger} initial="hidden" animate="show" style={{ maxWidth: 920 }}>
      <PageHeader title="Settings" sub="Goals, appearance, photo analysis and your data." />
      <div className="col" style={{ gap: 16 }}>
        <GoalCard />
        <AppearanceCard />
        <PhotoCard />
        <ProfileCard />
        <DataCard />
      </div>
    </motion.div>
  )
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Card style={{ padding: 28 }}>
      <div style={{ marginBottom: 20 }}>
        <div className="t-lg w-600" style={{ letterSpacing: '-0.02em' }}>{title}</div>
        {sub && <div className="t-sm muted">{sub}</div>}
      </div>
      {children}
    </Card>
  )
}

function GoalCard() {
  const t = useTargets()!
  const p = t.profile
  const auto = computeTargets(p, t.kg)
  const [ov, setOv] = useState(p.override ?? { kcal: auto.kcal, protein: auto.protein, carbs: auto.carbs, fat: auto.fat })
  useEffect(() => { if (!p.override) setOv({ kcal: auto.kcal, protein: auto.protein, carbs: auto.carbs, fat: auto.fat }) }, [auto.kcal, auto.protein, auto.carbs, auto.fat, p.override])
  const macroKcal = ov.protein * 4 + ov.carbs * 4 + ov.fat * 9

  return (
    <Section title="Goal phase" sub="Your phase sets daily calories and macros from your body stats.">
      <div className="grid phase-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
        {(Object.keys(PHASES) as Phase[]).map((k) => (
          <motion.button key={k} onClick={() => saveProfile({ phase: k })} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} transition={spring}
            className="card flat pad-sm" style={{ textAlign: 'left', position: 'relative', padding: 14 }}>
            {p.phase === k && <motion.div layoutId="phase-ring" transition={spring} style={{ position: 'absolute', inset: 0, borderRadius: 20, boxShadow: '0 0 0 1.5px var(--accent)', background: 'var(--accent-soft)' }} />}
            <div style={{ position: 'relative' }}>
              <div className="w-600 t-sm">{PHASES[k].label}</div>
              <div className="t-xs muted phase-blurb" style={{ marginTop: 4, minHeight: 34 }}>{PHASES[k].blurb}</div>
              <div className="t-xs faint num" style={{ marginTop: 8 }}>{PHASES[k].adjust > 0 ? '+' : ''}{Math.round(PHASES[k].adjust * 100)}% kcal</div>
            </div>
          </motion.button>
        ))}
      </div>
      <div className="grid g-4" style={{ gap: 16, marginBottom: 24 }}>
        <div className="field"><span className="label">Sex</span><Segmented value={p.sex} onChange={(v) => saveProfile({ sex: v })} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} /></div>
        <div className="field"><span className="label">Age</span><Stepper value={p.age} min={14} max={90} onChange={(v) => saveProfile({ age: v })} /></div>
        <div className="field"><span className="label">Height (cm)</span><Stepper value={p.height_cm} min={120} max={230} onChange={(v) => saveProfile({ height_cm: v })} /></div>
        <label className="field"><span className="label">Activity</span>
          <select className="input" value={p.activity} onChange={(e) => saveProfile({ activity: e.target.value as Activity })}>
            {Object.entries(ACTIVITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></label>
      </div>
      <div className="card flat" style={{ background: 'var(--surface)', padding: 18 }}>
        <div className="row between wrap-md" style={{ marginBottom: 14 }}>
          <div className="t-sm muted">Based on {t.kg.toFixed(1)} kg trend weight · BMR {auto.bmr} · maintenance {auto.tdee} kcal</div>
          <Segmented value={p.override ? 'manual' : 'auto'} onChange={(v) => saveProfile({ override: v === 'manual' ? ov : null })} options={[{ value: 'auto', label: 'Automatic' }, { value: 'manual', label: 'Set by hand' }]} />
        </div>
        <div className="grid g-4" style={{ gap: 16 }}>
          {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
            <div key={k} className="field">
              <span className="label">{k === 'kcal' ? 'Calories' : k[0].toUpperCase() + k.slice(1) + ' (g)'}</span>
              {p.override
                ? <Stepper value={ov[k]} step={k === 'kcal' ? 50 : 5} max={9000} onChange={(v) => { const n = { ...ov, [k]: v }; setOv(n); saveProfile({ override: n }) }} />
                : <div className="t-lg w-600 num" style={{ height: 36, display: 'flex', alignItems: 'center' }}>{auto[k].toLocaleString()}</div>}
            </div>
          ))}
        </div>
        {p.override && Math.abs(macroKcal - ov.kcal) > 60 && (
          <div className="t-xs" style={{ color: 'var(--warn)', marginTop: 12 }}>Your macros add up to {Math.round(macroKcal)} kcal, {Math.round(Math.abs(macroKcal - ov.kcal))} kcal {macroKcal > ov.kcal ? 'more' : 'less'} than the calorie target.</div>
        )}
      </div>
    </Section>
  )
}

function AppearanceCard() {
  const t = useTargets()!
  const { profileId, color, refreshProfile } = useSession()
  return (
    <Section title="Appearance" sub="Animations follow your system's reduce-motion setting automatically.">
      <div className="grid g-3" style={{ gap: 20 }}>
        <div className="field"><span className="label">Theme</span>
          <Segmented value={t.profile.theme} onChange={(v) => saveProfile({ theme: v })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} /></div>
        <div className="field"><span className="label">Accent</span>
          <div className="row" style={{ gap: 10, height: 36 }}>
            {Object.keys(swatch).map((c) => (
              <motion.button key={c} aria-label={c} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={async () => { await platform.profiles.update({ id: profileId, color: c }); refreshProfile() }}
                style={{ width: 26, height: 26, borderRadius: 13, background: swatch[c], boxShadow: color === c ? `0 0 0 3px var(--bg), 0 0 0 5px ${swatch[c]}` : 'none' }} />
            ))}
          </div></div>
        <div className="field"><span className="label">Units</span>
          <Segmented value={t.profile.units} onChange={(v) => saveProfile({ units: v })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} /></div>
      </div>
    </Section>
  )
}

function PhotoCard() {
  const t = useTargets()!
  const { profileId } = useSession()
  const toast = useToast()
  const [status, setStatus] = useState<KeyStatus | null>(null)
  const [key, setKey] = useState('')
  useEffect(() => { platform.key.status(profileId).then(setStatus) }, [profileId])
  return (
    <Section title="Photo meal analysis" sub="Uses Claude's vision model with your own API key from console.anthropic.com.">
      <div className="row" style={{ gap: 10, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <KeyRound size={15} className="faint" style={{ position: 'absolute', left: 12, top: 12 }} />
          <input className="input" type="password" autoComplete="off" spellCheck={false} placeholder={status?.set ? `Key saved, ending in ${status.hint}` : 'sk-ant-…'} value={key} onChange={(e) => setKey(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <Button variant="primary" disabled={!key.trim()} onClick={async () => { setStatus(await platform.key.set(profileId, key)); setKey(''); toast({ icon: <Check size={14} />, title: 'API key saved' }) }}>Save key</Button>
        {status?.set && <Button variant="ghost" onClick={async () => setStatus(await platform.key.clear(profileId))}>Remove</Button>}
      </div>
      <div className="t-xs muted row" style={{ gap: 6, marginBottom: 20 }}>
        <ShieldCheck size={13} className="accent" />
        {platform.isDesktop
          ? 'Stored only on this computer, encrypted with your Windows account. It is never written into the app files or any backup.'
          : 'Stored only in this browser on this device. It is never included in backups.'}
      </div>
      <div className="field" style={{ maxWidth: 420 }}>
        <span className="label row" style={{ gap: 6 }}><Sparkles size={12} /> Model</span>
        <select className="input" value={t.profile.model} onChange={(e) => saveProfile({ model: e.target.value })}>
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}: {m.hint}</option>)}
        </select>
      </div>
    </Section>
  )
}

function ProfileCard() {
  const { profileId, name, refreshProfile, lock } = useSession()
  const toast = useToast()
  const [n, setN] = useState(name)
  const [pin, setPin] = useState('')
  const [hasPin, setHasPin] = useState(false)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => { platform.profiles.list().then((l) => setHasPin(!!l.find((p) => p.id === profileId)?.hasPin)) }, [profileId])
  return (
    <Section title="Profile" sub="Profiles keep separate data on this device. Switch from the bottom of the sidebar.">
      <div className="grid g-2" style={{ gap: 20 }}>
        <label className="field"><span className="label">Name</span>
          <input className="input" value={n} onChange={(e) => setN(e.target.value)} onBlur={async () => { if (n.trim() && n !== name) { await platform.profiles.update({ id: profileId, name: n }); refreshProfile() } }} /></label>
        <div className="field"><span className="label row" style={{ gap: 6 }}><Lock size={12} /> PIN {hasPin ? '(set)' : '(none)'}</span>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" type="password" inputMode="numeric" maxLength={6} placeholder="4–6 digits" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            <Button disabled={!/^\d{4,6}$/.test(pin)} onClick={async () => { await platform.profiles.update({ id: profileId, pin }); setPin(''); setHasPin(true); toast({ title: 'PIN updated' }) }}>{hasPin ? 'Change' : 'Set'}</Button>
            {hasPin && <Button variant="ghost" onClick={async () => { await platform.profiles.update({ id: profileId, clearPin: true }); setHasPin(false) }}>Remove</Button>}
          </div></div>
      </div>
      <div className="divider" />
      <div className="row between wrap-md">
        <div className="t-sm muted">Deleting a profile removes all of its workouts, meals and settings from this device.</div>
        <Button onClick={lock}>Switch profile</Button>
        {confirm
          ? <div className="row"><Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" onClick={async () => { await platform.profiles.remove({ id: profileId }); lock() }}><Trash2 size={14} /> Delete {name}</Button></div>
          : <Button variant="danger" onClick={() => setConfirm(true)}><Trash2 size={14} /> Delete profile</Button>}
      </div>
    </Section>
  )
}

function DataCard() {
  const { name } = useSession()
  const toast = useToast()
  const [info, setInfo] = useState<{ dataPath: string } | null>(null)
  const [confirm, setConfirm] = useState<null | 'wipe' | 'import'>(null)
  useEffect(() => { platform.app.info().then(setInfo) }, [])
  const doImport = async () => {
    const json = await platform.backup.import()
    if (!json) return setConfirm(null)
    try { importJson(json); toast({ icon: <Check size={14} />, title: 'Backup restored' }) } catch (e) { toast({ title: 'Import failed', body: e instanceof Error ? e.message : String(e) }) }
    setConfirm(null)
  }
  return (
    <Section title="Data and backup" sub="Everything is stored locally. Export a backup file to keep a copy or move to another device.">
      <div className="row wrap" style={{ gap: 10 }}>
        <Button variant="primary" onClick={async () => { const path = await platform.backup.export(`forma-${name.toLowerCase().replace(/\W+/g, '-')}-${today()}.json`, exportJson()); if (path) toast({ icon: <Download size={14} />, title: 'Backup exported', body: path }) }}><Download size={15} /> Export backup</Button>
        {confirm === 'import'
          ? <Button onClick={doImport}><Upload size={15} /> Choose file (replaces current data)</Button>
          : <Button onClick={() => setConfirm('import')}><Upload size={15} /> Import backup</Button>}
        <Button variant="ghost" onClick={() => { loadSampleData(); toast({ title: 'Sample data added' }) }}><Sparkles size={15} /> Add sample data</Button>
        {confirm === 'wipe'
          ? <Button variant="danger" onClick={() => { wipeAll(); setConfirm(null); toast({ title: 'All training and meal data cleared' }) }}>Yes, clear everything</Button>
          : <Button variant="danger" onClick={() => setConfirm('wipe')}><Trash2 size={15} /> Clear data</Button>}
      </div>
      {info && (
        <motion.div variants={rise} className="t-xs faint row" style={{ gap: 8, marginTop: 16 }}>
          <span>Stored at {info.dataPath}</span>
          {platform.isDesktop && <Button size="sm" variant="ghost" onClick={() => platform.app.openDataFolder()}><FolderOpen size={13} /> Open folder</Button>}
        </motion.div>
      )}
    </Section>
  )
}
