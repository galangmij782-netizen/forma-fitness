import { AnimatePresence, motion } from 'motion/react'
import { Check, ScanBarcode } from 'lucide-react'
import { useState } from 'react'
import { portionOf, type Product } from '../lib/barcode'
import type { MealItem } from '../lib/types'
import { Button, Segmented, Stepper, softSpring } from './ui'

type Mode = 'pieces' | 'pack' | 'serving' | 'grams'
const PACK_PARTS = [{ v: 0.25, l: '¼' }, { v: 1 / 3, l: '⅓' }, { v: 0.5, l: '½' }, { v: 0.75, l: '¾' }, { v: 1, l: 'Whole' }]

/** After a scan: how much of the pack was eaten, by pieces, part of the pack, servings or grams. */
export function PortionPicker({ product: p, onAdd, onCancel }: { product: Product; onAdd: (item: MealItem) => void; onCancel: () => void }) {
  const canPieces = !!(p.pieceGrams || p.packGrams)
  const modes: { value: Mode; label: string }[] = [
    ...(canPieces ? [{ value: 'pieces' as const, label: 'Pieces' }] : []),
    ...(p.packGrams ? [{ value: 'pack' as const, label: 'Pack' }] : []),
    ...(p.servingGrams ? [{ value: 'serving' as const, label: 'Servings' }] : []),
    { value: 'grams', label: 'Grams' },
  ]
  const [mode, setMode] = useState<Mode>(modes[0].value)
  const [ate, setAte] = useState(1)
  const [inPack, setInPack] = useState(p.pieces ?? 1)
  const [part, setPart] = useState(1)
  const [servings, setServings] = useState(1)
  const [grams, setGrams] = useState(Math.round(p.servingGrams ?? 100))

  const pieceG = p.pieceGrams ?? (p.packGrams ? p.packGrams / Math.max(inPack, 1) : 0)
  const g = mode === 'pieces' ? ate * pieceG : mode === 'pack' ? (p.packGrams ?? 0) * part : mode === 'serving' ? servings * (p.servingGrams ?? 100) : grams
  const item = portionOf(p, g)
  const what = mode === 'pieces' ? `${ate} ${ate === 1 ? 'piece' : 'pieces'}${inPack > 1 ? ` of ${inPack}` : ''}`
    : mode === 'pack' ? (part === 1 ? 'Whole pack' : `${PACK_PARTS.find((x) => x.v === part)?.l} of the pack`)
    : mode === 'serving' ? `${servings} ${servings === 1 ? 'serving' : 'servings'}` : `${grams} g`

  return (
    <motion.div className="card portion" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
      <div className="row" style={{ gap: 10, marginBottom: 14 }}>
        <span className="computing-orb" style={{ animation: 'none' }}><ScanBarcode size={15} /></span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="w-600 t-sm">{p.item.name}</div>
          <div className="t-xs faint">{[p.packGrams && `${Math.round(p.packGrams)} g pack`, p.pieces && `${p.pieces} pieces`, `${Math.round(p.per100.kcal)} kcal per 100 g`].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <div className="label" style={{ marginBottom: 8 }}>How much did you eat?</div>
      {modes.length > 1 && <Segmented value={mode} options={modes} onChange={setMode} />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={mode} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }} className="col" style={{ gap: 10, marginTop: 14 }}>
          {mode === 'pieces' && <>
            <div className="row between"><span className="t-sm">I ate</span><Stepper value={ate} onChange={setAte} min={0.5} step={1} width={44} /></div>
            {!p.pieceGrams && <div className="row between"><span className="t-sm">Pieces in the pack</span><Stepper value={inPack} onChange={setInPack} min={1} width={44} /></div>}
            {p.pieceGrams && p.pieces && <div className="t-xs faint">The pack has {p.pieces} pieces, about {Math.round(p.pieceGrams)} g each.</div>}
          </>}
          {mode === 'pack' && (
            <div className="row wrap" style={{ gap: 6 }}>
              {PACK_PARTS.map((x) => <button key={x.l} className={`chip-btn ${part === x.v ? 'on' : ''}`} onClick={() => setPart(x.v)}>{x.l}</button>)}
            </div>
          )}
          {mode === 'serving' && <div className="row between"><span className="t-sm">Servings of {Math.round(p.servingGrams!)} g</span><Stepper value={servings} onChange={setServings} min={0.5} step={0.5} width={44} /></div>}
          {mode === 'grams' && <div className="row between"><span className="t-sm">Grams</span><Stepper value={grams} onChange={setGrams} min={1} step={10} width={56} /></div>}
        </motion.div>
      </AnimatePresence>
      <div className="portion-total num">
        <div className="t-xs muted">{what} · {item.grams} g</div>
        <div className="row" style={{ gap: 14, marginTop: 4 }}>
          <span><span className="t-lg w-600">{item.kcal}</span> <span className="t-sm faint">kcal</span></span>
          <span className="t-sm muted">P <b>{Math.round(item.protein)}</b></span>
          <span className="t-sm muted">C <b>{Math.round(item.carbs)}</b></span>
          <span className="t-sm muted">F <b>{Math.round(item.fat)}</b></span>
        </div>
      </div>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={item.grams <= 0} onClick={() => onAdd(item)}><Check size={14} /> Add to meal</Button>
      </div>
    </motion.div>
  )
}
