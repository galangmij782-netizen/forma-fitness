import { AnimatePresence, motion } from 'motion/react'
import { RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { softSpring } from './ui'

declare const __BUILD__: string
const SITE = 'https://galangmij782-netizen.github.io/forma-fitness/'
const DOWNLOAD = 'https://github.com/galangmij782-netizen/forma-fitness/releases/latest'

/** Checks for a newer build when the app opens, when it comes back to the foreground, and every 15 minutes. */
export function UpdateBanner() {
  const [newer, setNewer] = useState(false)
  const [hidden, setHidden] = useState(false)
  const desktop = !!window.forma
  useEffect(() => {
    if (import.meta.env.DEV || location.search.includes('demo')) return
    let stop = false
    const check = async () => {
      if (stop || document.hidden || !navigator.onLine) return
      try {
        const url = (desktop ? SITE : './') + 'version.json?t=' + Date.now()
        const r = await fetch(url, { cache: 'no-store' })
        if (!r.ok) return
        const { build } = await r.json() as { build?: string }
        if (build && build > __BUILD__) setNewer(true)
      } catch { /* offline */ }
    }
    void check()
    const t = setInterval(check, 15 * 60 * 1000)
    document.addEventListener('visibilitychange', check)
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', check) }
  }, [desktop])

  const update = async () => {
    if (desktop) { window.open(DOWNLOAD); return }
    try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update() } catch { /* ignore */ }
    location.reload()
  }

  return (
    <AnimatePresence>
      {newer && !hidden && (
        <motion.div className="update-banner" role="status" initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={softSpring}>
          <RefreshCw size={16} className="accent" />
          <div className="grow t-sm"><b>New version of Forma</b><span className="muted"> {desktop ? 'is ready to download.' : 'is ready. Your data stays.'}</span></div>
          <button className="btn sm primary" onClick={update}>{desktop ? 'Download' : 'Update now'}</button>
          <button className="icon-btn sm" aria-label="Later" onClick={() => setHidden(true)}><X size={15} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
