const express = require('express')
const prisma = require('../lib/prisma')
const { asyncHandler } = require('../middleware/common')
const { assertNonNegative } = require('../utils/validation')

const router = express.Router()

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
