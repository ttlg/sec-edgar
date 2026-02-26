function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function todayIsoDate(): string {
  return toIsoDate(new Date())
}

export function minusDaysIsoDate(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return toIsoDate(d)
}
