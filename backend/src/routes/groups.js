const express = require('express')
const prisma = require('../lib/prisma')
const { asyncHandler } = require('../middleware/common')

const router = express.Router()

// GET /api/groups
router.get('/', asyncHandler(async (req, res) => {
  const groups = await prisma.billingGroup.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } }
  })
  res.json({ data: groups })
}))

// POST /api/groups  { name }
router.post('/', asyncHandler(async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) { res.status(400); throw new Error('Group name required') }

  const existing = await prisma.billingGroup.findUnique({ where: { name: name.trim() } })
  if (existing) { res.status(409); throw new Error('Group already exists') }

  const group = await prisma.billingGroup.create({ data: { name: name.trim() } })
  res.status(201).json({ data: group })
}))

// PUT /api/groups/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { name } = req.body
  const group = await prisma.billingGroup.update({
    where: { id: req.params.id },
    data: { name: name?.trim() }
  })
  res.json({ data: group })
}))

// DELETE /api/groups/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.billingGroup.delete({ where: { id: req.params.id } })
  res.json({ success: true })
}))

module.exports = router
