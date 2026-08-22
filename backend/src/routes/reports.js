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

  // Purchase ka "actual bill amount" — same logic jo Past Invoices folder view use karta
  // hai: har invoice ka totalAmount (real printed/edited amount) uske pehle item ke
  // product ki company/group ke against jodo. qty*costPrice se nahi (wo sirf subtotal
  // hai, discount/tax ke baad ka final totalAmount alag ho sakta hai).
  const purchaseInvoices = await prisma.purchaseInvoice.findMany({
    where: hasDateFilter ? { billDate: dateFilter } : {},
    include: { items: { take: 1, include: { product: { select: { groupId: true } } } } }
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

  for (const inv of purchaseInvoices) {
    const gid = inv.items?.[0]?.product?.groupId
    if (!gid || !byGroup[gid]) { hasUnassigned = true; continue }
    byGroup[gid].totalPurchase += inv.totalAmount
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

module.exports = router
