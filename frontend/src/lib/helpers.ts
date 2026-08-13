export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0)
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

// Invoice OCR se aaya date string (jaise "12/08/2026", "12-08-2026", "12 Aug 2026",
// "August 12, 2026") ko <input type="date"> ke liye YYYY-MM-DD mein convert karta hai.
// Agar parse nahi ho paya to null return karta hai (caller aaj ki date use kare).
export function parseInvoiceDateToISO(raw?: string | null): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null

  // Already ISO: YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return isoOrNull(+m[1], +m[2], +m[3])

  // DD/MM/YYYY or DD-MM-YYYY (most common on Indian bills)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (m) {
    let year = +m[3]
    if (year < 100) year += 2000
    return isoOrNull(year, +m[2], +m[1])
  }

  // Fallback: let JS Date parse things like "12 Aug 2026" / "August 12, 2026"
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]

  return null
}

function isoOrNull(year: number, month: number, day: number): string | null {
  if (!year || !month || !day || month > 12 || day > 31) return null
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}
