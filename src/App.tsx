import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import { Activity, CalendarRange, Dumbbell, LayoutGrid, LineChart, Settings as Cog, UtensilsCrossed } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { CelebrateProvider } from './components/Celebrate'
import { RestTimerProvider } from './components/RestTimer'
import { UpdateBanner } from './components/UpdateBanner'
import { ToastProvider, spring, useToast } from './components/ui'
import { notifyNow } from './lib/alarm'
import { useReminders } from './lib/reminders'
import { closeDatabase, flush, useDbReady, useQuery } from './lib/db'
import { NavCtx, SessionCtx, useSession, type PageKey } from './lib/nav'
import { platform, type ProfileInfo } from './lib/platform'
import { activeSession, getProfile } from './lib/repo'
import { Dashboard } from './pages/Dashboard'
import { Meals } from './pages/Meals'
import { Onboarding } from './pages/Onboarding'
import { ProfilePicker } from './pages/ProfilePicker'
import { Progress } from './pages/Progress'
import { Settings } from './pages/Settings'
import { Splits } from './pages/Splits'
import { Workouts } from './pages/Workouts'

const NAV: { key: PageKey; label: string; icon: typeof Activity }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { key: 'workouts', label: 'Workouts', icon: Dumbbell },
  { key: 'splits', label: 'Splits', icon: CalendarRange },
  { key: 'meals', label: 'Meals', icon: UtensilsCrossed },
  { key: 'progress', label: 'Progress', icon: LineChart },
  { key: 'settings', label: 'Settings', icon: Cog },
]

const PAGES: Record<PageKey, () => JSX.Element | null> = { dashboard: Dashboard, workouts: Workouts, splits: Splits, meals: Meals, progress: Progress, settings: Settings }

function useTheme(theme: string) {
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0c0e' : '#f5f5f3')
    }
    apply()
    platform.app.setTheme(theme)
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

export default function App() {
  const [profile, setProfile] = useState<ProfileInfo | null>(null)
  const ready = useDbReady(profile?.id ?? null)

  useEffect(() => { document.documentElement.dataset.accent = profile?.color ?? 'green' }, [profile?.color])
  useEffect(() => { if (!profile) document.documentElement.dataset.theme ??= 'dark' }, [profile])

  const lock = useCallback(async () => {
    if (!profile) return
    await flush()
    closeDatabase()
    await platform.profiles.lock({ id: profile.id })
    setProfile(null)
  }, [profile])

  const refreshProfile = useCallback(async () => {
    if (!profile) return
    const list = await platform.profiles.list()
    const p = list.find((x) => x.id === profile.id)
    if (p) setProfile(p)
  }, [profile])

  return (
    <MotionConfig reducedMotion="user">
      <div className="drag" />
      <UpdateBanner />
      <AnimatePresence mode="wait">
        {!profile || !ready ? (
          <motion.div key="picker" style={{ height: '100%' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
            <ProfilePicker onUnlocked={setProfile} />
          </motion.div>
        ) : (
          <motion.div key={profile.id} style={{ height: '100%' }} initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 26 }}>
            <SessionCtx.Provider value={{ profileId: profile.id, name: profile.name, color: profile.color, lock, refreshProfile }}>
              <ToastProvider>
                <CelebrateProvider>
                  <RestTimerProvider>
                    <ReminderRunner />
                    <Shell />
                  </RestTimerProvider>
                </CelebrateProvider>
              </ToastProvider>
            </SessionCtx.Provider>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  )
}

/** Shows nutrition reminders: a system notification when the app is in the background, a toast when it's in front. */
function ReminderRunner() {
  const { profileId } = useSession()
  const toast = useToast()
  const show = useCallback((m: { title: string; body: string }) => {
    if (document.hidden) void notifyNow(m.title, m.body)
    else toast({ title: m.title, body: m.body })
  }, [toast])
  useReminders(profileId, show)
  return null
}

function Shell() {
  const initial = (new URLSearchParams(location.search).get('page') as PageKey) || 'dashboard'
  const [page, setPage] = useState<PageKey>(NAV.some((n) => n.key === initial) ? initial : 'dashboard')
  const [params, setParams] = useState<Record<string, unknown>>({})
  const prof = useQuery(() => getProfile(), [])
  const live = useQuery(() => activeSession(), [])
  useTheme(prof?.theme ?? 'dark')

  const go = useCallback((p: PageKey, prm: Record<string, unknown> = {}) => { setParams(prm); setPage(p) }, [])
  const Page = PAGES[page]
  const { name, lock } = useSession()

  return (
    <NavCtx.Provider value={{ page, go, params }}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand"><div className="brand-mark"><Activity size={14} strokeWidth={2.6} /></div>Forma</div>
          <LayoutGroup id="nav">
            {NAV.map(({ key, label, icon: Icon }) => (
              <motion.button key={key} className="nav-item" data-active={page === key} onClick={() => go(key)} whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }} transition={spring}>
                {page === key && <motion.div layoutId="nav-pill" className="nav-pill" transition={spring} />}
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
                {key === 'workouts' && live && <motion.span className="nav-dot" initial={{ scale: 0 }} animate={{ scale: 1 }} title="Workout in progress" />}
              </motion.button>
            ))}
          </LayoutGroup>
          <div className="sidebar-foot">
            <motion.button className="profile-chip" whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }} onClick={lock} title="Switch profile">
              <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
              <div className="grow">
                <div className="t-sm w-500" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                <div className="t-xs faint">Switch profile</div>
              </div>
            </motion.button>
          </div>
        </aside>
        <main className="main">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={page} className="page"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 34, mass: 0.8 } }}
              exit={{ opacity: 0, transition: { duration: 0.1, ease: 'easeIn' } }}>
              <Page />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {prof && !prof.onboarded && <Onboarding />}
    </NavCtx.Provider>
  )
}
