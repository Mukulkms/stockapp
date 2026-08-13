const express = require('express')
const prisma = require('../lib/prisma')
const { asyncHandler } = require('../middleware/common')

const router = express.Router()

// GET /api/reports/profit-loss?from=&to=
// Har BillingGroup (company) ke liye: total purchase (kharcha), total sales (billing),
// cost-of-goods-sold (asli profit ke liye, snapshot costPrice se), expenses, aur net profit/loss.
router.get('/profit-loss', asyncHandler(async (req, res) => {
  const { from, to } = req.query
  const dateFilter = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) dateFilter.lte = new Date(to)
  const hasDateFilter = Object.keys(dateFilter).length > 0

  const groups = await prisma.billingGroup.findMany({ orderBy: { name: 'asc' } })

  // Purchase invoice items grouped by product's group — purchase ka "actual bill amount"
  // proportionally item-level costPrice*qty ke basis pe company-wise split hota hai
  const purchaseItems = await prisma.purchaseInvoiceItem.findMany({
    where: hasDateFilter ? { purchaseInvoice: { billDate: dateFilter } } : {},
    select: { qty: true, costPrice: true, product: { select: { groupId: true } } }
  })

  const salesItems = await prisma.salesInvoiceItem.findMany({
    where: hasDateFilter ? { salesInvoice: { billDate: dateFilter } } : {},
    select: { qty: true, rate: true, costPrice: true, product: { select: { groupId: true } } }
  })

  const expenses = await prisma.expense.findMany({
    where: hasDateFilter ? { expenseDate: dateFilter } : {}
  })

  const byGroup = {}
  for (const g of groups) {
    byGroup[g.id] = {
      groupId: g.id,
      groupName: g.name,
      totalPurchase: 0,   // kitna maal khareeda (cost)
      totalSales: 0,      // kitni billing hui (revenue)
      costOfGoodsSold: 0, // becha gaya maal ki cost
      expenses: 0,
      grossProfit: 0,     // totalSales - costOfGoodsSold
      netProfit: 0,       // grossProfit - expenses
      simpleProfit: 0,    // totalSales - totalPurchase (cash-basis)
      simpleNetProfit: 0  // simpleProfit - expenses
    }
  }
  // "Unassigned" bucket agar kisi product ka group delete ho chuka ho
  const unassigned = () => ({
    groupId: null, groupName: 'Unassigned', totalPurchase: 0, totalSales: 0,
    costOfGoodsSold: 0, expenses: 0, grossProfit: 0, netProfit: 0
  })
  let hasUnassigned = false

  for (const it of purchaseItems) {
    const gid = it.product?.groupId
    if (!gid || !byGroup[gid]) { hasUnassigned = true; continue }
    byGroup[gid].totalPurchase += it.qty * it.costPrice
  }

  for (const it of salesItems) {
    const gid = it.product?.groupId
    if (!gid || !byGroup[gid]) { hasUnassigned = true; continue }
    byGroup[gid].totalSales += it.qty * it.rate
    byGroup[gid].costOfGoodsSold += it.qty * it.costPrice
  }

  for (const e of expenses) {
    if (e.groupId && byGroup[e.groupId]) {
      byGroup[e.groupId].expenses += e.amount
    }
  }

  const rows = Object.values(byGroup).map(r => {
    r.totalPurchase = +r.totalPurchase.toFixed(2)
    r.totalSales = +r.totalSales.toFixed(2)
    r.costOfGoodsSold = +r.costOfGoodsSold.toFixed(2)
    r.expenses = +r.expenses.toFixed(2)
    r.grossProfit = +(r.totalSales - r.costOfGoodsSold).toFixed(2)
    r.netProfit = +(r.grossProfit - r.expenses).toFixed(2)
    // Simple/cash-basis: is period mein jo bhi khareeda (chahe becha ho ya stock mein pada ho)
    // uska poora total minus, sirf becha hua maal ki cost nahi. Chhoti dukaan ke rojmarra
    // hisaab-kitab ke liye zyada intuitive, lekin agar stock jama ho raha ho to misleading ho sakta hai.
    r.simpleProfit = +(r.totalSales - r.totalPurchase).toFixed(2)
    r.simpleNetProfit = +(r.simpleProfit - r.expenses).toFixed(2)
    return r
  })

  // Expenses jo kisi group se linked nahi (general business expenses) — inko overall total me count karo
  const generalExpenses = expenses.filter(e => !e.groupId).reduce((s, e) => s + e.amount, 0)

  const summary = rows.reduce((acc, r) => ({
    totalPurchase: acc.totalPurchase + r.totalPurchase,
    totalSales: acc.totalSales + r.totalSales,
    costOfGoodsSold: acc.costOfGoodsSold + r.costOfGoodsSold,
    expenses: acc.expenses + r.expenses,
    grossProfit: acc.grossProfit + r.grossProfit,
    netProfit: acc.netProfit + r.netProfit,
    simpleProfit: acc.simpleProfit + r.simpleProfit,
    simpleNetProfit: acc.simpleNetProfit + r.simpleNetProfit
  }), { totalPurchase: 0, totalSales: 0, costOfGoodsSold: 0, expenses: 0, grossProfit: 0, netProfit: 0, simpleProfit: 0, simpleNetProfit: 0 })

  summary.generalExpenses = +generalExpenses.toFixed(2)
  summary.netProfit = +(summary.netProfit - generalExpenses).toFixed(2)
  summary.simpleNetProfit = +(summary.simpleNetProfit - generalExpenses).toFixed(2)
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

// GET /api/reports/monthly?groupId=xxx
// Ek specific company/group ke liye month-wise breakdown: us mahine ka purchase
// (auto, bills se), expenses (auto, us group se linked), aur sales (jo manually
// "Monthly Sales" mein save ki gayi hai). Isi se month-wise profit/loss dikhta/save hota hai.
router.get('/monthly', asyncHandler(async (req, res) => {
  const { groupId } = req.query
  if (!groupId) { res.status(400); throw new Error('groupId required') }

  const group = await prisma.billingGroup.findUnique({ where: { id: groupId } })
  if (!group) { res.status(404); throw new Error('Company/group not found') }

  const purchaseItems = await prisma.purchaseInvoiceItem.findMany({
    where: { product: { groupId } },
    select: { qty: true, costPrice: true, purchaseInvoice: { select: { billDate: true } } }
  })

  const expenses = await prisma.expense.findMany({ where: { groupId } })

  const salesEntries = await prisma.monthlySales.findMany({ where: { groupId } })

  // key = "YYYY-M"
  const buckets = {}
  const keyOf = (y, m) => `${y}-${m}`
  const ensure = (y, m) => {
    const k = keyOf(y, m)
    if (!buckets[k]) {
      buckets[k] = { year: y, month: m, purchaseTotal: 0, expensesTotal: 0, salesAmount: 0, hasSalesEntry: false, salesEntryId: null }
    }
    return buckets[k]
  }

  for (const it of purchaseItems) {
    const d = new Date(it.purchaseInvoice.billDate)
    const b = ensure(d.getFullYear(), d.getMonth() + 1)
    b.purchaseTotal += it.qty * it.costPrice
  }

  for (const e of expenses) {
    const d = new Date(e.expenseDate)
    const b = ensure(d.getFullYear(), d.getMonth() + 1)
    b.expensesTotal += e.amount
  }

  for (const s of salesEntries) {
    const b = ensure(s.year, s.month)
    b.salesAmount = s.salesAmount
    b.hasSalesEntry = true
    b.salesEntryId = s.id
  }

  const rows = Object.values(buckets)
    .map(b => ({
      ...b,
      purchaseTotal: +b.purchaseTotal.toFixed(2),
      expensesTotal: +b.expensesTotal.toFixed(2),
      salesAmount: +b.salesAmount.toFixed(2),
      netProfit: +(b.salesAmount - b.purchaseTotal - b.expensesTotal).toFixed(2)
    }))
    .sort((a, b) => (b.year - a.year) || (b.month - a.month))

  res.json({ data: { groupId, groupName: group.name, months: rows } })
}))

module.exports = router
