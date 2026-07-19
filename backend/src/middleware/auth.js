const jwt = require('jsonwebtoken')

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return res.status(401).json({ message: 'Login required' })
  if (!process.env.JWT_SECRET) return res.status(500).json({ message: 'JWT_SECRET .env mein set nahi hai' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload
    next()
  } catch {
    res.status(401).json({ message: 'Session expire ho gaya, dobara login karo' })
  }
}

module.exports = { requireAuth }