/**
 * Get the ISO week number for a date.
 */
export function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

/**
 * Get the ISO year for a date's week (handles year boundaries).
 */
export function getISOWeekYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  return d.getUTCFullYear()
}

/**
 * Build a week key like "2026-W09".
 */
export function getWeekKey(date) {
  const year = getISOWeekYear(date)
  const week = getISOWeekNumber(date)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/**
 * Get Monday of the ISO week containing `date`.
 */
export function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay() || 7 // Sunday = 7
  d.setDate(d.getDate() - day + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Generate an array of 7 dates (Mon-Sun) for the week containing `date`.
 */
export function getWeekDates(date) {
  const monday = getMonday(date)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

/**
 * Shift a date by `n` weeks.
 */
export function shiftWeek(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n * 7)
  return d
}

/**
 * Format a date as "YYYY-MM-DD".
 */
export function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Format a date as "Mon 24" (short day + day number).
 */
export function formatShortDate(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return `${days[date.getDay()]} ${date.getDate()}`
}

/**
 * Format a date range like "Feb 23 – Mar 1, 2026".
 */
export function formatWeekRange(dates) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const start = dates[0]
  const end = dates[6]
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) {
    return `${months[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`
  }
  return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function getDayName(date) {
  // getDay() returns 0=Sun, but we want Mon-Sun order
  const idx = (date.getDay() + 6) % 7
  return DAY_NAMES[idx]
}

export function isToday(date) {
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}
