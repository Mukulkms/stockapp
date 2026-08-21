const express = require('express')
const prisma = require('../lib/prisma')
const { asyncHandler } = require('../middleware/common')
const { assertNonNegative } = require('../utils/validation')

const router = express.Router()

// GET /api/cheques  — saare cheques, sabse naye pehle, company info ke saath
router.get('/', asyncHandler(async (req, res) => {
  const cheques = await prisma.cheque.findMany({
    include: { group: true },
    orderBy: { chequeDate: 'desc' }
  })
  res.json({ data: cheques })
}))

// POST /api/cheques  { groupId, chequeNumber, bankName?, amount, chequeDate, status?, note? }
router.post('/', asyncHandler(async (req, res) => {
  const { groupId, chequeNumber, bankName, amount, chequeDate, status, note } = req.body
  if (!groupId) { res.status(400); throw new Error('Company/group chuno') }
  if (!chequeNumber?.trim()) { res.status(400); throw new Error('Cheque number required') }
  assertNonNegative(res, req.body, ['amount'])

  const group = await prisma.billingGroup.findUnique({ where: { id: groupId } })
  if (!group) { res.status(404); throw new Error('Company/group not found') }

  const cheque = await prisma.cheque.create({
    data: {
      groupId,
      chequeNumber: chequeNumber.trim(),
      bankName: bankName?.trim() || null,
      amount: Math.max(0, Number(amount) || 0),
      chequeDate: chequeDate ? new Date(chequeDate) : new Date(),
      status: status || 'pending',
      note: note?.trim() || null
    },
    include: { group: true }
  })
  res.status(201).json({ data: cheque })
}))

// PUT /api/cheques/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { groupId, chequeNumber, bankName, amount, chequeDate, status, note } = req.body
  assertNonNegative(res, req.body, ['amount'])

  const cheque = await prisma.cheque.update({
    where: { id: req.params.id },
    data: {
      ...(groupId !== undefined ? { groupId } : {}),
      ...(chequeNumber !== undefined ? { chequeNumber: chequeNumber.trim() } : {}),
      ...(bankName !== undefined ? { bankName: bankName?.trim() || null } : {}),
      ...(amount !== undefined ? { amount: Math.max(0, Number(amount) || 0) } : {}),
      ...(chequeDate !== undefined ? { chequeDate: new Date(chequeDate) } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(note !== undefined ? { note: note?.trim() || null } : {})
    },
    include: { group: true }
  })
  res.json({ data: cheque })
}))

// DELETE /api/cheques/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.cheque.delete({ where: { id: req.params.id } }).catch(() => {})
  res.json({ success: true })
}))

module.exports = router
