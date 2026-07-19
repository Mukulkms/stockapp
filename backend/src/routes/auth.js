const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')
const { asyncHandler } = require('../middleware/common')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// POST /api/auth/login  { username, password }
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) { res.status(400); throw new Error('Username aur password dono chahiye') }
  if (!process.env.JWT_SECRET) { res.status(500); throw new Error('JWT_SECRET .env mein set nahi hai') }

  const user = await prisma.user.findUnique({ where: { username: username.trim() } })
  if (!user) { res.status(401); throw new Error('Galat username ya password') }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) { res.status(401); throw new Error('Galat username ya password') }

  const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, username: user.username })
}))

// GET /api/auth/me  — token valid hai ya nahi check karne ke liye (page refresh pe)
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ username: req.user.username })
}))

module.exports = router