import { useQuery } from './db'
import { addDays, today } from './dates'
import { effectiveTargets } from './nutrition'
import { dayTotals, getProfile, listWeights } from './repo'
import { smooth } from './trend'

/** Profile, smoothed weight trend and the day's targets, recomputed on any change. */
export function useTargets() {
  return useQuery(() => {
    const profile = getProfile()
    const trend = smooth(listWeights())
    const kg = trend.length ? trend[trend.length - 1].trend : 75
    return { profile, trend, kg, targets: effectiveTargets(profile, kg) }
  }, [])
}

export function useDayTotals(date = today()) {
  return useQuery(() => dayTotals(date, date)[0], [date])
}

export function useWeekTotals(end = addDays(today(), -1)) {
  return useQuery(() => dayTotals(addDays(end, -6), end), [end])
}
