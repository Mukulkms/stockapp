const express = require('express')
const prisma = require('../lib/prisma')
const { asyncHandler } = require('../middleware/common')

const router = express.Router()

const ymOfDate = (d) => d.getFullYear() * 12 + (d.getMonth() + 1)
const ymOfMonthStr = (s) => { const [y, m] = s.split('-').map(Number); return y * 12 + m }

// GET /api/reports/profit-loss?from=&to=
// Har company/group ke liye seedha-saadha hisaab:
//   Total Purchase — bills se, automatic (Purchase Invoice ka totalAmount)
//   Total Sales    — jo tumne "Cheque-based profit calculator" mein manually save
//                    ki hain, un saved periods mein se jo is date range ko chhoote hain
//   Net Profit     — Total Sales - Total Purchase
router.get('/profit-loss', asyncHandler(async (req, res) => {
  const { from, to } = req.query
  const dateFilter = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) dateFilter.lte = new Date(to)
  const hasDateFilter = Object.keys(dateFilter).length > 0

  const groups = await prisma.billingGroup.findMany({ orderBy: { name: 'asc' } })

  const purchaseInvoices = await prisma.purchaseInvoice.findMany({
    where: hasDateFilter ? { billDate: dateFilter } : {},
    include: { items: { take: 1, include: { product: { select: { groupId: true } } } } }
  })

  const calculations = await prisma.profitCalculation.findMany()

  const fromYM = from ? ymOfDate(new Date(from)) : -Infinity
  const toYM = to ? ymOfDate(new Date(to)) : Infinity

  const byGroup = {}
  for (const g of groups) {
    byGroup[g.id] = { groupId: g.id, groupName: g.name, totalPurchase: 0, totalSales: 0, netProfit: 0 }
  }
  let hasUnassigned = false

  for (const inv of purchaseInvoices) {
    const gid = inv.items?.[0]?.product?.groupId
    if (!gid || !byGroup[gid]) { hasUnassigned = true; continue }
    byGroup[gid].totalPurchase += inv.totalAmount
  }

  // Saved calculator periods (fromMonth/toMonth) jo selected date-range ko kahin bhi
  // chhoote hain, unki sales count ho jaati hai — poora overlap nahi chahiye
  for (const calc of calculations) {
    if (!byGroup[calc.groupId]) continue
    const calcFromYM = ymOfMonthStr(calc.fromMonth)
    const calcToYM = ymOfMonthStr(calc.toMonth)
    if (calcToYM < fromYM || calcFromYM > toYM) continue
    byGroup[calc.groupId].totalSales += calc.totalSales
  }

  const rows = Object.values(byGroup).map(r => {
    r.totalPurchase = +r.totalPurchase.toFixed(2)
    r.totalSales = +r.totalSales.toFixed(2)
    r.netProfit = +(r.totalSales - r.totalPurchase).toFixed(2)
    return r
  })

  const summary = rows.reduce((acc, r) => ({
    totalPurchase: acc.totalPurchase + r.totalPurchase,
    totalSales: acc.totalSales + r.totalSales,
    netProfit: acc.netProfit + r.netProfit
  }), { totalPurchase: 0, totalSales: 0, netProfit: 0 })
  Object.keys(summary).forEach(k => { summary[k] = +summary[k].toFixed(2) })

  res.json({
    data: {
      from: from || null,
      to: to || null,
      companies: rows,
      hasUnassignedProducts: hasUnassigned,
      summary
    }
  })
}))

module.exports = router
