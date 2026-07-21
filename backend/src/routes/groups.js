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
  try {
    await prisma.billingGroup.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    if (err.code === 'P2025') { res.status(404); throw new Error('Group not found') }
    if (err.code === 'P2003') {
      res.status(409)
      throw new Error('Is group mein products hain, isliye delete nahi ho sakta. Pehle isme se saare products delete karo ya kisi aur group mein move karo.')
    }
    throw err
  }
}))

module.exports = router
