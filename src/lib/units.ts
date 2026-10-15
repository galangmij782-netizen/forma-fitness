import { useQuery } from './db'
import { getProfile } from './repo'

const LB = 2.20462
export function useUnits() {
  const unit = useQuery(() => getProfile().units, []) ?? 'kg'
  const toDisplay = (kg: number) => (unit === 'lb' ? kg * LB : kg)
  const fromDisplay = (v: number) => (unit === 'lb' ? v / LB : v)
  const fmt = (kg: number, d = 1) => `${toDisplay(kg).toLocaleString(undefined, { maximumFractionDigits: d })} ${unit}`
  const step = unit === 'lb' ? 5 : 2.5
  return { unit, toDisplay, fromDisplay, fmt, step }
}
