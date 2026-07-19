const express = require('express')
const prisma = require('../lib/prisma')
const { asyncHandler } = require('../middleware/common')
const { calcSellingPrice } = require('../utils/pricing')

const router = express.Router()

// Ek purchase-invoice line item ko product se resolve/apply karta hai.
// Agar productId diya hai to wahi product update hoga.
// Agar productId nahi diya (jaise OCR scan se aaye items), to pehle isi group mein
// naam se (case-insensitive, trimmed) match dhoondha jata hai — match milne par
// wahi product update hoga (stock increment), naya duplicate product NAHI banega.
// Match na milne par hi naya product create hoga.
async function upsertPurchaseItem(tx, it) {
  let productId = it.productId

  if (!productId) {
    if (!it.name?.trim() || !it.groupId) {
      throw Object.assign(new Error('Each new item needs name + groupId'), { status: 400 })
    }
    const trimmedName = it.name.trim()

    const match = await tx.product.findFirst({
      where: {
        groupId: it.groupId,
        name: { equals: trimmedName, mode: 'insensitive' }
      }
    })

    if (match) {
      productId = match.id
    } else {
      const sellingPrice = calcSellingPrice(it.costPrice, it.marginPercent, it.marginFlat)
      const newProduct = await tx.product.create({
        data: {
          name: trimmedName,
          groupId: it.groupId,
          unit: it.unit || 'pcs',
          costPrice: Number(it.costPrice) || 0,
          marginPercent: it.marginPercent !== undefined ? Number(it.marginPercent) : null,
          marginFlat: it.marginFlat !== undefined ? Number(it.marginFlat) : null,
          sellingPrice,
          stockQty: Number(it.qty) || 0
        }
      })
      productId = newProduct.id
      return { productId, qty: Number(it.qty) || 0, costPrice: Number(it.costPrice) || 0 }
    }
  }

  // Existing product (either matched by name or given via productId): update cost/margin + increment stock
  const existing = await tx.product.findUnique({ where: { id: productId } })
  if (!existing) throw Object.assign(new Error('Product not found: ' + productId), { status: 404 })

  const finalCost = it.costPrice !== undefined ? Number(it.costPrice) : existing.costPrice
  const finalMarginPercent = it.marginPercent !== undefined ? Number(it.marginPercent) : existing.marginPercent
  const finalMarginFlat = it.marginFlat !== undefined ? Number(it.marginFlat) : existing.marginFlat
  const sellingPrice = calcSellingPrice(finalCost, finalMarginFlat ? null : finalMarginPercent, finalMarginFlat)

  await tx.product.update({
    where: { id: productId },
    data: {
      costPrice: finalCost,
      marginPercent: finalMarginPercent,
      marginFlat: finalMarginFlat,
      sellingPrice,
      stockQty: { increment: Number(it.qty) || 0 }
    }
  })

  return { productId, qty: Number(it.qty) || 0, costPrice: Number(it.costPrice) || 0 }
}

// POST /api/purchase-invoices/scan  { base64, mimeType }
// Gemini se invoice padh ke line items + vendor/GST/discount/total nikalta hai
router.post('/scan', asyncHandler(async (req, res) => {
  const { base64, mimeType } = req.body
  if (!base64) { res.status(400); throw new Error('Image required') }
  if (!process.env.GEMINI_API_KEY) { res.status(500); throw new Error('GEMINI_API_KEY .env mein set nahi hai') }

  const prompt = `You are reading a purchase/supplier invoice image. Extract structured data ONLY as JSON, no preamble, no markdown fences, no explanation:
{
  "vendorName": string or null,
  "vendorGSTIN": string or null (GST number on the bill, e.g. 09ABCDE1234F1Z5),
  "vendorPhone": string or null,
  "vendorAddress": string or null,
  "invoiceNumber": string or null,
  "date": string or null (as seen on invoice),
  "items": [
    { "name": string, "qty": number, "unit": string (pcs/kg/mtr/box/ltr - best guess), "costPrice": number (rate per unit, before discount/tax) }
  ],
  "subTotal": number or null (sum of items before discount/tax, if printed on bill),
  "discountAmount": number or null (total discount/less amount printed on bill),
  "taxAmount": number or null (GST/tax amount printed on bill),
  "totalAmount": number or null (the FINAL grand total actually charged/paid on the bill - most important field, read it exactly as printed)
}
If a field is unclear, use null. Numbers must be plain numbers, no currency symbols or commas.`

  const model = 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } },
          { text: prompt }
        ]
      }],
      generationConfig: { temperature: 0.1 }
    })
  })

  const data = await response.json()

  if (data?.error) {
    res.status(502)
    throw new Error('Gemini error: ' + (data.error.message || 'unknown'))
  }

  const textBlock = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
  const cleaned = textBlock.replace(/```json|```/g, '').trim()

  if (!cleaned) {
    res.status(422)
    throw new Error('Gemini se koi response nahi mila. Image clear nahi hai shayad.')
  }

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    res.status(422)
    throw new Error('Could not read invoice. Try a clearer image.')
  }

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    res.status(422)
    throw new Error('Invoice se koi item nahi mila. Clear photo lo ya manually add karo.')
  }

  res.json(parsed)
}))

// GET /api/purchase-invoices
router.get('/', asyncHandler(async (req, res) => {
  const invoices = await prisma.purchaseInvoice.findMany({
    orderBy: { billDate: 'desc' },
    include: { items: { include: { product: true } } }
  })
  res.json({ data: invoices })
}))

// GET /api/purchase-invoices/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: true } } }
  })
  if (!invoice) { res.status(404); throw new Error('Invoice not found') }
  res.json({ data: invoice })
}))

// POST /api/purchase-invoices
// body: { invoiceNumber, vendorName, vendorGSTIN, vendorPhone, vendorAddress, billDate, imageUrl,
//         discountAmount, taxAmount, totalAmount (actual bill amount, editable),
//         items: [{ productId?, name?, groupId, unit, qty, costPrice, marginPercent, marginFlat }] }
// productId na ho to naya product us group mein create hoga. Stock qty add hoga, costPrice/sellingPrice update hoga.
router.post('/', asyncHandler(async (req, res) => {
  const {
    invoiceNumber, vendorName, vendorGSTIN, vendorPhone, vendorAddress,
    billDate, imageUrl, discountAmount, taxAmount, totalAmount, items
  } = req.body
  if (!items?.length) { res.status(400); throw new Error('At least one item required') }

  const result = await prisma.$transaction(async (tx) => {
    let subTotal = 0
    const invoiceItemsData = []

    for (const it of items) {
      const { productId, qty, costPrice } = await upsertPurchaseItem(tx, it)
      subTotal += qty * costPrice
      invoiceItemsData.push({ productId, qty, costPrice })
    }

    // Actual bill amount: agar user ne diya hai to wahi use hoga (edit ho sakta hai),
    // warna items se calculated subTotal - discount + tax use hoga
    const finalDiscount = Number(discountAmount) || 0
    const finalTax = Number(taxAmount) || 0
    const finalTotal = totalAmount !== undefined && totalAmount !== null && totalAmount !== ''
      ? Number(totalAmount)
      : +(subTotal - finalDiscount + finalTax).toFixed(2)

    const invoice = await tx.purchaseInvoice.create({
      data: {
        invoiceNumber: invoiceNumber || undefined,
        vendorName: vendorName || undefined,
        vendorGSTIN: vendorGSTIN || undefined,
        vendorPhone: vendorPhone || undefined,
        vendorAddress: vendorAddress || undefined,
        billDate: billDate ? new Date(billDate) : new Date(),
        imageUrl: imageUrl || undefined,
        subTotal: +subTotal.toFixed(2),
        discountAmount: finalDiscount,
        taxAmount: finalTax,
        totalAmount: finalTotal,
        items: { create: invoiceItemsData }
      },
      include: { items: { include: { product: true } } }
    })

    return invoice
  })

  res.status(201).json({ data: result })
}))

// PUT /api/purchase-invoices/:id
// Full edit: vendor/GST/discount/actual-amount fields + items (with stock reconciliation).
// body: same shape as POST
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    invoiceNumber, vendorName, vendorGSTIN, vendorPhone, vendorAddress,
    billDate, imageUrl, discountAmount, taxAmount, totalAmount, items
  } = req.body

  if (!items?.length) { res.status(400); throw new Error('At least one item required') }

  const existingInvoice = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: { items: true }
  })
  if (!existingInvoice) { res.status(404); throw new Error('Invoice not found') }

  const result = await prisma.$transaction(async (tx) => {
    // Step 1: revert stock for old items (subtract what was added originally)
    for (const oldItem of existingInvoice.items) {
      await tx.product.update({
        where: { id: oldItem.productId },
        data: { stockQty: { decrement: oldItem.qty } }
      }).catch(() => {}) // product may have been deleted separately; ignore
    }

    // Step 2: delete old invoice items
    await tx.purchaseInvoiceItem.deleteMany({ where: { purchaseInvoiceId: id } })

    // Step 3: re-apply new items (same logic as create)
    let subTotal = 0
    const invoiceItemsData = []

    for (const it of items) {
      const { productId, qty, costPrice } = await upsertPurchaseItem(tx, it)
      subTotal += qty * costPrice
      invoiceItemsData.push({ productId, qty, costPrice })
    }

    const finalDiscount = Number(discountAmount) || 0
    const finalTax = Number(taxAmount) || 0
    const finalTotal = totalAmount !== undefined && totalAmount !== null && totalAmount !== ''
      ? Number(totalAmount)
      : +(subTotal - finalDiscount + finalTax).toFixed(2)

    const invoice = await tx.purchaseInvoice.update({
      where: { id },
      data: {
        invoiceNumber: invoiceNumber || null,
        vendorName: vendorName || null,
        vendorGSTIN: vendorGSTIN || null,
        vendorPhone: vendorPhone || null,
        vendorAddress: vendorAddress || null,
        billDate: billDate ? new Date(billDate) : existingInvoice.billDate,
        imageUrl: imageUrl || existingInvoice.imageUrl,
        subTotal: +subTotal.toFixed(2),
        discountAmount: finalDiscount,
        taxAmount: finalTax,
        totalAmount: finalTotal,
        items: { create: invoiceItemsData }
      },
      include: { items: { include: { product: true } } }
    })

    return invoice
  })

  res.json({ data: result })
}))

// DELETE /api/purchase-invoices/bulk   body: { ids: string[], revertStock?: boolean }
// IMPORTANT: must be registered before /:id so 'bulk' isn't treated as an id
router.delete('/bulk', asyncHandler(async (req, res) => {
  const { ids, revertStock } = req.body
  if (!Array.isArray(ids) || !ids.length) { res.status(400); throw new Error('ids array required') }

  await prisma.$transaction(async (tx) => {
    if (revertStock) {
      const items = await tx.purchaseInvoiceItem.findMany({ where: { purchaseInvoiceId: { in: ids } } })
      for (const it of items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stockQty: { decrement: it.qty } }
        }).catch(() => {})
      }
    }
    await tx.purchaseInvoice.deleteMany({ where: { id: { in: ids } } })
  })

  res.json({ success: true, deleted: ids.length })
}))

// DELETE /api/purchase-invoices/:id   query: ?revertStock=true
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const revertStock = req.query.revertStock === 'true'

  await prisma.$transaction(async (tx) => {
    if (revertStock) {
      const items = await tx.purchaseInvoiceItem.findMany({ where: { purchaseInvoiceId: id } })
      for (const it of items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stockQty: { decrement: it.qty } }
        }).catch(() => {})
      }
    }
    await tx.purchaseInvoice.delete({ where: { id } })
  })

  res.json({ success: true })
}))

module.exports = router
