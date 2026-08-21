const express = require('express')
const prisma = require('../lib/prisma')
const { asyncHandler } = require('../middleware/common')
const { assertNonNegative } = require('../utils/validation')

const router = express.Router()

const MONTH_KEY = (y, m) => `${y}-${m}`

// GET /api/monthly-sales/:groupId
// Ek company/group ke saare mahino ka breakdown deta hai — jis mahine mein purchase
// ya expense hua ho (chahe sales entry ho ya na ho) + jin mahino ki sales manually
// save ki gayi hai, sabko merge karke ek list banata hai (latest month pehle).
router.get('/:groupId', asyncHandler(async (req, res) => {
  const { groupId } = req.params
  const group = await prisma.billingGroup.findUnique({ where: { id: groupId } })
  if (!group) { res.status(404); throw new Error('Company/group not found') }

  const purchaseItems = await prisma.purchaseInvoiceItem.findMany({
    where: { product: { groupId } },
    select: { qty: true, costPrice: true, purchaseInvoice: { select: { billDate: true } } }
  })

  const expenses = await prisma.expense.findMany({
    where: { groupId },
    select: { amount: true, expenseDate: true }
  })

  const salesEntries = await prisma.monthlySales.findMany({ where: { groupId } })

  const byMonth = {}
  const ensure = (y, m) => {
    const k = MONTH_KEY(y, m)
    if (!byMonth[k]) {
      byMonth[k] = { year: y, month: m, purchaseTotal: 0, expensesTotal: 0, salesAmount: 0, hasSalesEntry: false }
    }
    return byMonth[k]
  }

  for (const it of purchaseItems) {
    const d = new Date(it.purchaseInvoice.billDate)
    const row = ensure(d.getFullYear(), d.getMonth() + 1)
    row.purchaseTotal += it.qty * it.costPrice
  }

  for (const e of expenses) {
    const d = new Date(e.expenseDate)
    const row = ensure(d.getFullYear(), d.getMonth() + 1)
    row.expensesTotal += e.amount
  }

  for (const s of salesEntries) {
    const row = ensure(s.year, s.month)
    row.salesAmount = s.salesAmount
    row.hasSalesEntry = true
    row.entryId = s.id
  }

  const months = Object.values(byMonth)
    .map(r => {
      r.purchaseTotal = +r.purchaseTotal.toFixed(2)
      r.expensesTotal = +r.expensesTotal.toFixed(2)
      r.salesAmount = +r.salesAmount.toFixed(2)
      r.netProfit = +(r.salesAmount - r.purchaseTotal - r.expensesTotal).toFixed(2)
      return r
    })
    .sort((a, b) => (b.year - a.year) || (b.month - a.month))

  res.json({ data: { months } })
}))

// POST /api/monthly-sales   body: { groupId, year, month, salesAmount, note? }
// Ek company/group ke liye ek mahine ki total sales save/update karta hai (upsert —
// dobara same month save karo to overwrite ho jayega, naya duplicate nahi banega).
router.post('/', asyncHandler(async (req, res) => {
  const { groupId, year, month, salesAmount, note } = req.body
  if (!groupId) { res.status(400); throw new Error('groupId required') }
  const y = Number(year)
  const m = Number(month)
  if (!y || !m || m < 1 || m > 12) { res.status(400); throw new Error('Valid year aur month (1-12) chahiye') }
  assertNonNegative(res, req.body, ['salesAmount'])

  const group = await prisma.billingGroup.findUnique({ where: { id: groupId } })
  if (!group) { res.status(404); throw new Error('Company/group not found') }

  const entry = await prisma.monthlySales.upsert({
    where: { groupId_year_month: { groupId, year: y, month: m } },
    update: { salesAmount: Math.max(0, Number(salesAmount) || 0), note: note || undefined },
    create: { groupId, year: y, month: m, salesAmount: Math.max(0, Number(salesAmount) || 0), note: note || undefined }
  })

  res.status(201).json({ data: entry })
}))

// DELETE /api/monthly-sales/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.monthlySales.delete({ where: { id: req.params.id } }).catch(() => {})
  res.json({ success: true })
}))

module.exports = router
