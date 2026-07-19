require('dotenv').config()
const express = require('express')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const { errorHandler } = require('./middleware/common')
const { requireAuth } = require('./middleware/auth')

const authRoutes = require('./routes/auth')
const groupsRoutes = require('./routes/groups')
const productsRoutes = require('./routes/products')
const purchaseInvoicesRoutes = require('./routes/purchaseInvoices')
const salesInvoicesRoutes = require('./routes/salesInvoices')

const app = express()

app.use(cors())
app.use(express.json({ limit: '15mb' })) // bill photos base64 me aati hain, isliye limit badi rakhi

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 1000 : 100000, // dev mein practically unlimited
  standardHeaders: true,
  legacyHeaders: false
})
app.use('/api', apiLimiter)

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// login sabse pehle, bina auth ke; /me route auth.js ke andar khud protected hai
app.use('/api/auth', authRoutes)

// baaki sab /api routes login ke baad hi accessible
app.use('/api/groups', requireAuth, groupsRoutes)
app.use('/api/products', requireAuth, productsRoutes)
app.use('/api/purchase-invoices', requireAuth, purchaseInvoicesRoutes)
app.use('/api/sales-invoices', requireAuth, salesInvoicesRoutes)

app.use((req, res) => res.status(404).json({ message: 'Route not found' }))
app.use(errorHandler)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`StockBill backend running on port ${PORT}`))