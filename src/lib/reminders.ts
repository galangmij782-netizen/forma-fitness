// Nutrition reminders at times the user picks. They fire while the app is open or running
// in the background (the Windows app, or a phone web app that hasn't been closed).
import { useEffect } from 'react'
import { getSetting } from './db'
import { dayTotals, getProfile, listWeights } from './repo'
import { addDays, nowTime, today } from './dates'
import { effectiveTargets } from './nutrition'
import { smooth } from './trend'

export interface ReminderSettings { on: boolean; times: string[] }
export const DEFAULT_REMINDERS: ReminderSettings = { on: false, times: ['12:30', '16:00', '20:00'] }
export const getReminders = () => getSetting<ReminderSettings>('reminders', DEFAULT_REMINDERS)

/** What's left today, as a reminder. Null when there's nothing worth saying. */
export function reminderMessage(): { title: string; body: string } | null {
  const profile = getProfile()
  const trend = smooth(listWeights())
  const kg = trend.length ? trend[trend.length - 1].trend : 75
  const t = effectiveTargets(profile, kg)
  const day = dayTotals(today(), today())[0]
  const pLeft = Math.round(t.protein - day.protein)
  const kLeft = Math.round(t.kcal - day.kcal)
  if (pLeft >= 10) {
    const tuna = Math.max(1, Math.round(pLeft / 25)), whey = Math.max(1, Math.round(pLeft / 24))
    return { title: `You've still got ${pLeft} g of protein left!`, body: `${Math.round(day.protein)} of ${t.protein} g so far. ${tuna} can${tuna > 1 ? 's' : ''} of tuna or ${whey} scoop${whey > 1 ? 's' : ''} of whey would close it.` }
  }
  if (kLeft >= 300) return { title: `Protein done. ${kLeft} kcal left today`, body: `Nice work on protein. You still have room for a meal.` }
  return null
}

const firedKey = (profileId: string, date: string, time: string) => `forma:reminded:${profileId}:${date}:${time}`

/** Checks every 30 s and shows each of today's reminders once; ones missed while the app was closed show on open. */
export function useReminders(profileId: string, show: (m: { title: string; body: string }) => void) {
  useEffect(() => {
    const check = () => {
      let r: ReminderSettings
      try { r = getReminders() } catch { return }
      if (!r.on) return
      const now = nowTime(), date = today()
      const [nh, nm] = now.split(':').map(Number)
      // Times already passed today that haven't shown yet. Missed ones (app was closed) show once, as one reminder.
      const due = r.times.filter((t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m <= nh * 60 + nm })
        .filter((t) => { try { return !localStorage.getItem(firedKey(profileId, date, t)) } catch { return false } })
      if (!due.length) return
      try { due.forEach((t) => localStorage.setItem(firedKey(profileId, date, t), '1')) } catch { return }
      const msg = reminderMessage()
      if (msg) show(msg)
      // Forget yesterday's markers.
      try { Object.keys(localStorage).filter((k) => k.startsWith(`forma:reminded:${profileId}:${addDays(date, -1)}`)).forEach((k) => localStorage.removeItem(k)) } catch { /* storage blocked */ }
    }
    check()
    const id = setInterval(check, 30_000)
    const vis = () => check()
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis) }
  }, [profileId, show])
}
