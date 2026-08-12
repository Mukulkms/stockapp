const express = require('express')
const prisma = require('../lib/prisma')
const { asyncHandler } = require('../middleware/common')
const { assertNonNegative } = require('../utils/validation')

const router = express.Router()

// Ek sales-invoice line item ko product se resolve karta hai: stock check + decrement,
// rate aur costPrice dono snapshot karta hai (costPrice baad me badal jaye to bhi
// purana profit calculation sahi rahe).
async function resolveSaleItem(client, it) {
  if (!it.productId) {
    throw Object.assign(new Error('Each item needs productId'), { status: 400 })
  }
  const product = await client.product.findUnique({ where: { id: it.productId } })
  if (!product) throw Object.assign(new Error('Product not found: ' + it.productId), { status: 404 })

  const qty = Math.max(0, Number(it.qty) || 0)
  if (qty <= 0) throw Object.assign(new Error(`${product.name}: qty 0 se zyada honi chahiye`), { status: 400 })
  if (qty > product.stockQty) {
    throw Object.assign(new Error(`${product.name}: stock me sirf ${product.stockQty} ${product.unit} hai, ${qty} nahi bech sakte`), { status: 400 })
  }

  const rate = it.rate !== undefined && it.rate !== null && it.rate !== ''
    ? Math.max(0, Number(it.rate))
    : product.sellingPrice

  await client.product.update({
    where: { id: product.id },
    data: { stockQty: { decrement: qty } }
  })

  return { productId: product.id, qty, rate, costPrice: product.costPrice }
}

// Sale revert karte waqt stock wapas add karo
async function revertSaleItems(client, items) {
  for (const it of items) {
    await client.product.update({
      where: { id: it.productId },
      data: { stockQty: { increment: it.qty } }
    }).catch(() => {}) // product delete ho chuka ho to ignore
  }
}

// GET /api/sales-invoices?groupId=&from=&to=
router.get('/', asyncHandler(async (req, res) => {
  const { groupId, from, to } = req.query
  const where = {}
  if (from || to) {
    where.billDate = {}
    if (from) where.billDate.gte = new Date(from)
    if (to) where.billDate.lte = new Date(to)
  }
  if (groupId) {
    where.items = { some: { product: { groupId } } }
  }

  const invoices = await prisma.salesInvoice.findMany({
    where,
    orderBy: { billDate: 'desc' },
    include: { items: { include: { product: { include: { group: true } } } } }
  })
  res.json({ data: invoices })
}))

// GET /api/sales-invoices/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: { include: { group: true } } } } }
  })
  if (!invoice) { res.status(404); throw new Error('Invoice not found') }
  res.json({ data: invoice })
}))

// POST /api/sales-invoices
// body: { invoiceNumber?, customerName, customerPhone, customerGSTIN, customerAddress,
//         billDate, imageUrl, discountAmount, taxAmount, totalAmount, items: [{ productId, qty, rate? }] }
router.post('/', asyncHandler(async (req, res) => {
  const {
    invoiceNumber, customerName, customerPhone, customerGSTIN, customerAddress,
    billDate, imageUrl, discountAmount, taxAmount, totalAmount, items
  } = req.body
  if (!items?.length) { res.status(400); throw new Error('At least one item required') }

  assertNonNegative(res, req.body, ['discountAmount', 'taxAmount', 'totalAmount'])
  for (const it of items) {
    assertNonNegative(res, it, ['qty', 'rate'])
  }

  // Har item stock check karke sequentially resolve hota hai (purchase route jaisa
  // hi pattern — bade bills me lambi $transaction() Neon pe unreliable hoti hai)
  let subTotal = 0
  const invoiceItemsData = []
  for (const it of items) {
    const resolved = await resolveSaleItem(prisma, it)
    subTotal += resolved.qty * resolved.rate
    invoiceItemsData.push(resolved)
  }

  const finalDiscount = Math.max(0, Number(discountAmount) || 0)
  const finalTax = Math.max(0, Number(taxAmount) || 0)
  const finalTotal = totalAmount !== undefined && totalAmount !== null && totalAmount !== ''
    ? Math.max(0, Number(totalAmount))
    : Math.max(0, +(subTotal - finalDiscount + finalTax).toFixed(2))

  const finalInvoiceNumber = invoiceNumber?.trim() || `INV-${Date.now()}`

  const invoice = await prisma.salesInvoice.create({
    data: {
      invoiceNumber: finalInvoiceNumber,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      customerGSTIN: customerGSTIN || undefined,
      customerAddress: customerAddress || undefined,
      billDate: billDate ? new Date(billDate) : new Date(),
      imageUrl: imageUrl || undefined,
      subTotal: +subTotal.toFixed(2),
      discountAmount: finalDiscount,
      taxAmount: finalTax,
      totalAmount: finalTotal
    }
  })

  await prisma.salesInvoiceItem.createMany({
    data: invoiceItemsData.map(it => ({ ...it, salesInvoiceId: invoice.id }))
  })

  const fullInvoice = await prisma.salesInvoice.findUnique({
    where: { id: invoice.id },
    include: { items: { include: { product: { include: { group: true } } } } }
  })

  res.status(201).json({ data: fullInvoice })
}))

// PUT /api/sales-invoices/:id  — same shape as POST, reconciles stock (revert old, apply new)
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    invoiceNumber, customerName, customerPhone, customerGSTIN, customerAddress,
    billDate, imageUrl, discountAmount, taxAmount, totalAmount, items
  } = req.body

  if (!items?.length) { res.status(400); throw new Error('At least one item required') }

  assertNonNegative(res, req.body, ['discountAmount', 'taxAmount', 'totalAmount'])
  for (const it of items) {
    assertNonNegative(res, it, ['qty', 'rate'])
  }

  const existingInvoice = await prisma.salesInvoice.findUnique({
    where: { id },
    include: { items: true }
  })
  if (!existingInvoice) { res.status(404); throw new Error('Invoice not found') }

  // Step 1: revert stock for old items
  await revertSaleItems(prisma, existingInvoice.items)

  // Step 2: delete old invoice items
  await prisma.salesInvoiceItem.deleteMany({ where: { salesInvoiceId: id } })

  // Step 3: re-apply new items (fresh stock check against reverted stock)
  let subTotal = 0
  const invoiceItemsData = []
  for (const it of items) {
    const resolved = await resolveSaleItem(prisma, it)
    subTotal += resolved.qty * resolved.rate
    invoiceItemsData.push(resolved)
  }

  const finalDiscount = Math.max(0, Number(discountAmount) || 0)
  const finalTax = Math.max(0, Number(taxAmount) || 0)
  const finalTotal = totalAmount !== undefined && totalAmount !== null && totalAmount !== ''
    ? Math.max(0, Number(totalAmount))
    : Math.max(0, +(subTotal - finalDiscount + finalTax).toFixed(2))

  const invoice = await prisma.salesInvoice.update({
    where: { id },
    data: {
      invoiceNumber: invoiceNumber?.trim() || existingInvoice.invoiceNumber,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      customerGSTIN: customerGSTIN || null,
      customerAddress: customerAddress || null,
      billDate: billDate ? new Date(billDate) : existingInvoice.billDate,
      imageUrl: imageUrl || existingInvoice.imageUrl,
      subTotal: +subTotal.toFixed(2),
      discountAmount: finalDiscount,
      taxAmount: finalTax,
      totalAmount: finalTotal
    }
  })

  await prisma.salesInvoiceItem.createMany({
    data: invoiceItemsData.map(it => ({ ...it, salesInvoiceId: invoice.id }))
  })

  const fullInvoice = await prisma.salesInvoice.findUnique({
    where: { id: invoice.id },
    include: { items: { include: { product: { include: { group: true } } } } }
  })

  res.json({ data: fullInvoice })
}))

// DELETE /api/sales-invoices/bulk   body: { ids: string[], revertStock?: boolean }
router.delete('/bulk', asyncHandler(async (req, res) => {
  const { ids, revertStock } = req.body
  if (!Array.isArray(ids) || !ids.length) { res.status(400); throw new Error('ids array required') }

  if (revertStock) {
    const items = await prisma.salesInvoiceItem.findMany({ where: { salesInvoiceId: { in: ids } } })
    await revertSaleItems(prisma, items)
  }
  await prisma.salesInvoice.deleteMany({ where: { id: { in: ids } } })

  res.json({ success: true, deleted: ids.length })
}))

// DELETE /api/sales-invoices/:id   query: ?revertStock=true
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const revertStock = req.query.revertStock === 'true'

  if (revertStock) {
    const items = await prisma.salesInvoiceItem.findMany({ where: { salesInvoiceId: id } })
    await revertSaleItems(prisma, items)
  }
  await prisma.salesInvoice.delete({ where: { id } })

  res.json({ success: true })
}))

module.exports = router
