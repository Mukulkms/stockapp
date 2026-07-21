const express = require('express')
const prisma = require('../lib/prisma')
const { asyncHandler } = require('../middleware/common')

const router = express.Router()

async function nextInvoiceNumber() {
  const count = await prisma.salesInvoice.count()
  const num = String(count + 1).padStart(4, '0')
  return `INV-${num}`
}

// GET /api/sales-invoices
router.get('/', asyncHandler(async (req, res) => {
  const invoices = await prisma.salesInvoice.findMany({
    orderBy: { billDate: 'desc' },
    include: { items: { include: { product: true } } }
  })
  res.json({ data: invoices })
}))

// GET /api/sales-invoices/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: true } } }
  })
  if (!invoice) { res.status(404); throw new Error('Invoice not found') }
  res.json({ data: invoice })
}))

// POST /api/sales-invoices
router.post('/', asyncHandler(async (req, res) => {
  const { customerName, customerPhone, billDate, items } = req.body
  if (!items?.length) { res.status(400); throw new Error('At least one item required') }

  let totalAmount = 0
  const invoiceItemsData = []

  for (const it of items) {
    const product = await prisma.product.findUnique({ where: { id: it.productId } })
    if (!product) throw Object.assign(new Error('Product not found: ' + it.productId), { status: 404 })

    const qty = Number(it.qty) || 0
    if (product.stockQty < qty) {
      throw Object.assign(
        new Error(`Not enough stock for "${product.name}" (available: ${product.stockQty})`),
        { status: 400 }
      )
    }

    const rate = it.rate !== undefined ? Number(it.rate) : product.sellingPrice
    totalAmount += qty * rate

    await prisma.product.update({
      where: { id: product.id },
      data: { stockQty: { decrement: qty } }
    })

    invoiceItemsData.push({ productId: product.id, qty, rate })
  }

  const invoiceNumber = await nextInvoiceNumber()

  const invoice = await prisma.salesInvoice.create({
    data: {
      invoiceNumber,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      billDate: billDate ? new Date(billDate) : new Date(),
      totalAmount
    }
  })

  await prisma.salesInvoiceItem.createMany({
    data: invoiceItemsData.map(it => ({ ...it, salesInvoiceId: invoice.id }))
  })

  const fullInvoice = await prisma.salesInvoice.findUnique({
    where: { id: invoice.id },
    include: { items: { include: { product: true } } }
  })

  res.status(201).json({ data: fullInvoice })
}))

// DELETE /api/sales-invoices/:id   query: ?revertStock=true
// revertStock=true par jo qty is bill mein becha gaya tha, wo wapas stock mein add ho jayega
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const revertStock = req.query.revertStock === 'true'

  if (revertStock) {
    const items = await prisma.salesInvoiceItem.findMany({ where: { salesInvoiceId: id } })
    for (const it of items) {
      await prisma.product.update({
        where: { id: it.productId },
        data: { stockQty: { increment: it.qty } }
      }).catch(() => {})
    }
  }
  await prisma.salesInvoice.delete({ where: { id } })

  res.json({ success: true })
}))

module.exports = router
