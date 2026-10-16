import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { Activity, ArrowLeft, Delete, Lock, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, rise, softSpring, spring, stagger } from '../components/ui'
import { platform, type ProfileInfo } from '../lib/platform'

const COLORS = ['green', 'blue', 'violet'] as const
const swatch: Record<string, string> = { green: '#5fd99a', blue: '#6aa8ff', violet: '#a99bff' }

export function ProfilePicker({ onUnlocked }: { onUnlocked: (p: ProfileInfo) => void }) {
  const [profiles, setProfiles] = useState<ProfileInfo[] | null>(null)
  const [mode, setMode] = useState<'pick' | 'create' | { pin: ProfileInfo }>('pick')

  useEffect(() => { platform.profiles.list().then((l) => { setProfiles(l); if (!l.length) setMode('create') }) }, [])

  const choose = async (p: ProfileInfo) => {
    if (p.hasPin) return setMode({ pin: p })
    if (await platform.profiles.unlock({ id: p.id })) onUnlocked(p)
  }

  if (!profiles) return null
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 'clamp(16px, 5vw, 40px)', background: 'radial-gradient(1200px 600px at 50% -10%, var(--accent-soft), transparent 60%)' }}>
      <AnimatePresence mode="wait">
        {mode === 'pick' && (
          <motion.div key="pick" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0, y: -10 }} style={{ textAlign: 'center' }}>
            <motion.div variants={rise} className="brand" style={{ justifyContent: 'center', paddingBottom: 12 }}>
              <div className="brand-mark"><Activity size={14} strokeWidth={2.6} /></div>Forma
            </motion.div>
            <motion.h1 variants={rise} className="page-title" style={{ marginBottom: 40 }}>Who's training today?</motion.h1>
            <div className="row" style={{ gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
              {profiles.map((p) => (
                <motion.button key={p.id} variants={rise} whileHover={{ y: -4 }} whileTap={{ scale: 0.96 }} transition={spring} onClick={() => choose(p)}
                  className="card" style={{ width: 168, padding: '28px 16px 20px', display: 'grid', justifyItems: 'center', gap: 14 }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 600, background: `color-mix(in oklab, ${swatch[p.color]} 16%, transparent)`, color: swatch[p.color] }}>
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="w-600">{p.name}</div>
                  <div className="t-xs faint row" style={{ gap: 4, height: 16 }}>{p.hasPin && <><Lock size={11} /> PIN</>}</div>
                </motion.button>
              ))}
              <motion.button variants={rise} whileHover={{ y: -4 }} whileTap={{ scale: 0.96 }} transition={spring} onClick={() => setMode('create')}
                className="card flat" style={{ width: 168, padding: '28px 16px 20px', display: 'grid', justifyItems: 'center', gap: 14, background: 'transparent' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--track)', color: 'var(--text-2)' }}><Plus size={26} /></div>
                <div className="w-500 muted">New profile</div>
                <div style={{ height: 16 }} />
              </motion.button>
            </div>
            <motion.p variants={rise} className="t-xs faint" style={{ marginTop: 40 }}>Each profile keeps its own workouts, meals and goals on this device.</motion.p>
          </motion.div>
        )}
        {mode === 'create' && <CreateProfile key="create" canBack={profiles.length > 0} onBack={() => setMode('pick')} onCreated={onUnlocked} />}
        {typeof mode === 'object' && <PinPad key="pin" profile={mode.pin} onBack={() => setMode('pick')} onUnlocked={onUnlocked} />}
      </AnimatePresence>
    </div>
  )
}

function CreateProfile({ canBack, onBack, onCreated }: { canBack: boolean; onBack: () => void; onCreated: (p: ProfileInfo) => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>('green')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { document.documentElement.dataset.accent = color }, [color])
  const valid = name.trim().length > 0 && (pin === '' || /^\d{4,6}$/.test(pin))
  const submit = async () => {
    if (!valid) return
    setBusy(true)
    onCreated(await platform.profiles.create({ name, color, pin: pin || undefined }))
  }
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={softSpring} className="card" style={{ width: 'min(420px, calc(100vw - 32px))', maxWidth: '100%', padding: 'clamp(20px, 6vw, 32px)' }}>
      {canBack && <Button variant="ghost" size="sm" onClick={onBack} style={{ marginLeft: -10, marginBottom: 12 }}><ArrowLeft size={15} /> Back</Button>}
      <h1 className="page-title" style={{ fontSize: 24 }}>Create your profile</h1>
      <p className="page-sub t-sm" style={{ marginBottom: 28 }}>Your data stays on this device, separate from other profiles.</p>
      <div className="col" style={{ gap: 18 }}>
        <label className="field"><span className="label">Name</span>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" onKeyDown={(e) => e.key === 'Enter' && submit()} /></label>
        <div className="field"><span className="label">Accent color</span>
          <div className="row" style={{ gap: 10 }}>
            {COLORS.map((c) => (
              <motion.button key={c} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setColor(c)} aria-label={c}
                style={{ width: 30, height: 30, borderRadius: 15, background: swatch[c], boxShadow: color === c ? `0 0 0 3px var(--bg), 0 0 0 5px ${swatch[c]}` : 'none' }} />
            ))}
          </div>
        </div>
        <label className="field"><span className="label">PIN (optional, 4–6 digits)</span>
          <input className="input" value={pin} inputMode="numeric" type="password" maxLength={6} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="Leave empty for no PIN" /></label>
        <Button variant="primary" size="lg" disabled={!valid || busy} onClick={submit} style={{ marginTop: 8 }}>Create profile</Button>
      </div>
    </motion.div>
  )
}

function PinPad({ profile, onBack, onUnlocked }: { profile: ProfileInfo; onBack: () => void; onUnlocked: (p: ProfileInfo) => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const shake = useAnimationControls()
  const tryPin = async (p: string) => {
    if (await platform.profiles.unlock({ id: profile.id, pin: p })) return onUnlocked(profile)
    setErr(true)
    await shake.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.42 } })
    setPin('')
  }
  const press = (d: string) => {
    setErr(false)
    const next = (pin + d).slice(0, 6)
    setPin(next)
    if (next.length >= 4) void platform.profiles.unlock({ id: profile.id, pin: next }).then((ok) => ok && onUnlocked(profile))
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') setPin((x) => x.slice(0, -1))
      else if (e.key === 'Enter') void tryPin(pin)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={softSpring} style={{ textAlign: 'center', width: 300 }}>
      <Button variant="ghost" size="sm" onClick={onBack} style={{ marginBottom: 16 }}><ArrowLeft size={15} /> Profiles</Button>
      <div className="w-600 t-lg" style={{ marginBottom: 6 }}>Hi, {profile.name}</div>
      <div className="t-sm muted" style={{ marginBottom: 24 }}>{err ? 'That PIN didn’t match' : 'Enter your PIN'}</div>
      <motion.div animate={shake} className="row" style={{ justifyContent: 'center', gap: 12, marginBottom: 32 }}>
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <motion.div key={i} animate={{ scale: i < pin.length ? 1 : 0.7, opacity: i < pin.length ? 1 : 0.35 }} transition={spring}
            style={{ width: 12, height: 12, borderRadius: 6, background: err ? 'var(--danger)' : 'var(--accent)' }} />
        ))}
      </motion.div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) => k === '' ? <div key="x" /> : (
          <motion.button key={k} className="card flat" whileTap={{ scale: 0.92 }} whileHover={{ y: -2 }} transition={spring} style={{ height: 60, padding: 0, fontSize: 20, fontWeight: 500 }}
            onClick={() => (k === '⌫' ? setPin((x) => x.slice(0, -1)) : press(k))}>{k === '⌫' ? <Delete size={20} style={{ margin: '0 auto' }} /> : k}</motion.button>
        ))}
      </div>
      <Button variant="ghost" size="sm" style={{ marginTop: 16 }} disabled={pin.length < 4} onClick={() => tryPin(pin)}>Unlock</Button>
    </motion.div>
  )
}
