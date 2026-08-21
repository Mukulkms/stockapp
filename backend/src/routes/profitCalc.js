const express = require('express')
const prisma = require('../lib/prisma')
const { asyncHandler } = require('../middleware/common')

const router = express.Router()

// GET /api/profit-calc?groupId=xxx  — saved calculations, naye pehle
router.get('/', asyncHandler(async (req, res) => {
  const { groupId } = req.query
  const calcs = await prisma.profitCalculation.findMany({
    where: groupId ? { groupId } : {},
    include: { group: true },
    orderBy: [{ groupId: 'asc' }, { toMonth: 'desc' }]
  })
  res.json({ data: calcs })
}))

// POST /api/profit-calc
// body: { groupId, periodType, fromMonth, toMonth, totalSales, totalCheques, stockValue }
// Same groupId+fromMonth+toMonth dobara save karo to overwrite (upsert) — naya
// duplicate period nahi banega, bas dobara calculate karke update ho jayega.
router.post('/', asyncHandler(async (req, res) => {
  const { groupId, periodType, fromMonth, toMonth, totalSales, totalCheques, stockValue } = req.body
  if (!groupId) { res.status(400); throw new Error('Company/group chuno') }
  if (!fromMonth || !toMonth) { res.status(400); throw new Error('Period (from-to month) chahiye') }

  const group = await prisma.billingGroup.findUnique({ where: { id: groupId } })
  if (!group) { res.status(404); throw new Error('Company/group not found') }

  const sales = Math.max(0, Number(totalSales) || 0)
  const cheques = Math.max(0, Number(totalCheques) || 0)
  const stock = Math.max(0, Number(stockValue) || 0)
  const netProfit = +(sales - cheques + stock).toFixed(2)

  const calc = await prisma.profitCalculation.upsert({
    where: { groupId_fromMonth_toMonth: { groupId, fromMonth, toMonth } },
    update: { periodType: periodType || 'monthly', totalSales: sales, totalCheques: cheques, stockValue: stock, netProfit },
    create: { groupId, periodType: periodType || 'monthly', fromMonth, toMonth, totalSales: sales, totalCheques: cheques, stockValue: stock, netProfit },
    include: { group: true }
  })

  res.status(201).json({ data: calc })
}))

// DELETE /api/profit-calc/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.profitCalculation.delete({ where: { id: req.params.id } }).catch(() => {})
  res.json({ success: true })
}))

module.exports = router
