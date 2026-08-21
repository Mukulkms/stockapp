export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0)
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

// Bill par jaisa date likha hota hai (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, "12 Aug 2026" waghera)
// usko <input type="date"> ke liye YYYY-MM-DD format mein convert karta hai.
// Agar parse na ho paaye to null return karta hai (caller default/today use kar sakta hai).
export function parseInvoiceDate(raw?: string | null): string | null {
  if (!raw) return null
  const s = raw.trim()

  // Already ISO: YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return toISO(+m[1], +m[2], +m[3])

  // DD/MM/YYYY or DD-MM-YYYY (or 2-digit year)
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (m) {
    let year = +m[3]
    if (year < 100) year += year < 50 ? 2000 : 1900
    return toISO(year, +m[2], +m[1])
  }

  // "12 Aug 2026" / "12 August 2026"
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  }
  m = s.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/)
  if (m) {
    const mon = months[m[2].toLowerCase().slice(0, 3)]
    if (mon) return toISO(+m[3], mon, +m[1])
  }

  return null
}

function toISO(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${y}-${pad(mo)}-${pad(d)}`
}
