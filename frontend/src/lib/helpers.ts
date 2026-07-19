export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0)
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}
