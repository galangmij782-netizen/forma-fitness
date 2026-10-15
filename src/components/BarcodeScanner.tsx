import { motion, useReducedMotion } from 'motion/react'
import { CameraOff, Loader2, ScanBarcode } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { lookupBarcode, type Product } from '../lib/barcode'
import { Button } from './ui'

type Status = { kind: 'scanning' } | { kind: 'looking'; code: string } | { kind: 'error'; text: string } | { kind: 'nocamera' }

/** Camera barcode scanner with a typed-number fallback. Calls onFound once per product. */
export function BarcodeScanner({ onFound }: { onFound: (p: Product) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<Status>({ kind: 'scanning' })
  const [typed, setTyped] = useState('')
  const busy = useRef(false)
  const lastCode = useRef('')
  const reduce = useReducedMotion()

  const lookup = async (code: string) => {
    if (busy.current || code === lastCode.current) return
    busy.current = true
    lastCode.current = code
    setStatus({ kind: 'looking', code })
    try {
      const p = await lookupBarcode(code)
      if (p) { onFound(p); setStatus({ kind: 'scanning' }) }
      else setStatus({ kind: 'error', text: `No nutrition data for ${code}. Add it as a custom item instead.` })
    } catch {
      setStatus({ kind: 'error', text: "Couldn't reach the food database. Check your connection and try again." })
    } finally {
      busy.current = false
      setTimeout(() => { lastCode.current = '' }, 2500)
    }
  }

  useEffect(() => {
    let stop = () => {}
    let cancelled = false
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia || !video.current) { setStatus({ kind: 'nocamera' }); return }
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        const controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current, (result) => {
          if (result && !cancelled) lookup(result.getText())
        })
        if (cancelled) controls.stop()
        else stop = () => controls.stop()
      } catch {
        if (!cancelled) setStatus({ kind: 'nocamera' })
      }
    })()
    return () => { cancelled = true; stop() }
  }, [])

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="scan-view">
        <video ref={video} muted playsInline />
        {status.kind === 'nocamera' ? (
          <div className="scan-empty col t-sm muted"><CameraOff size={20} /> No camera available. Type the barcode number below.</div>
        ) : (
          <div className="scan-frame">
            {!reduce && status.kind === 'scanning' && (
              <motion.div className="scan-line" initial={{ y: 0 }} animate={{ y: 96 }} transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }} />
            )}
          </div>
        )}
        {status.kind === 'looking' && <div className="scan-badge t-xs row" style={{ gap: 6 }}><Loader2 size={12} className="spin" /> Looking up {status.code}</div>}
      </div>
      {status.kind === 'error' && <div className="t-xs" style={{ color: 'var(--warn)' }}>{status.text}</div>}
      <form className="row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); lookup(typed); }}>
        <input className="input sm num grow" style={{ minWidth: 0 }} inputMode="numeric" placeholder="Or type the barcode number" value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, ''))} />
        <Button size="sm" disabled={typed.length < 6 || status.kind === 'looking'}><ScanBarcode size={14} /> Look up</Button>
      </form>
      <div className="t-xs faint">Nutrition from Open Food Facts, a free community database. Check the label if something looks off.</div>
    </div>
  )
}
