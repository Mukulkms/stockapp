const express = require('express')
const prisma = require('../lib/prisma')
const { asyncHandler } = require('../middleware/common')
const { assertNonNegative } = require('../utils/validation')

const router = express.Router()

// GET /api/expenses?groupId=&from=&to=&category=
router.get('/', asyncHandler(async (req, res) => {
  const { groupId, from, to, category } = req.query
  const where = {}
  if (groupId) where.groupId = groupId
  if (category) where.category = category
  if (from || to) {
    where.expenseDate = {}
    if (from) where.expenseDate.gte = new Date(from)
    if (to) where.expenseDate.lte = new Date(to)
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { expenseDate: 'desc' },
    include: { group: true }
  })
  res.json({ data: expenses })
}))

// POST /api/expenses  { title, category?, amount, groupId?, note?, expenseDate? }
router.post('/', asyncHandler(async (req, res) => {
  const { title, category, amount, groupId, note, expenseDate } = req.body
  if (!title?.trim()) { res.status(400); throw new Error('Expense title required') }
  assertNonNegative(res, req.body, ['amount'])
  if (!amount || Number(amount) <= 0) { res.status(400); throw new Error('Amount 0 se zyada honi chahiye') }

  const expense = await prisma.expense.create({
    data: {
      title: title.trim(),
      category: category?.trim() || 'general',
      amount: Number(amount),
      groupId: groupId || undefined,
      note: note || undefined,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date()
    },
    include: { group: true }
  })
  res.status(201).json({ data: expense })
}))

// PUT /api/expenses/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { title, category, amount, groupId, note, expenseDate } = req.body
  assertNonNegative(res, req.body, ['amount'])

  const expense = await prisma.expense.update({
    where: { id: req.params.id },
    data: {
      title: title?.trim(),
      category: category?.trim(),
      amount: amount !== undefined ? Number(amount) : undefined,
      groupId: groupId === '' ? null : groupId,
      note: note !== undefined ? (note || null) : undefined,
      expenseDate: expenseDate ? new Date(expenseDate) : undefined
    },
    include: { group: true }
  })
  res.json({ data: expense })
}))

// DELETE /api/expenses/bulk   body: { ids: string[] }
router.delete('/bulk', asyncHandler(async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || !ids.length) { res.status(400); throw new Error('ids array required') }
  await prisma.expense.deleteMany({ where: { id: { in: ids } } })
  res.json({ success: true, deleted: ids.length })
}))

// DELETE /api/expenses/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.expense.delete({ where: { id: req.params.id } })
  res.json({ success: true })
}))

module.exports = router
