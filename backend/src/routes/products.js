const express = require('express')
const prisma = require('../lib/prisma')
const { asyncHandler } = require('../middleware/common')
const { calcSellingPrice } = require('../utils/pricing')
const { assertNonNegative } = require('../utils/validation')

const router = express.Router()

// GET /api/products?groupId=xxx&search=abc
router.get('/', asyncHandler(async (req, res) => {
  const { groupId, search } = req.query
  const where = {
    ...(groupId ? { groupId } : {}),
    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {})
  }
  const products = await prisma.product.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { group: true }
  })
  res.json({ data: products })
}))

// GET /api/products/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { group: true }
  })
  if (!product) { res.status(404); throw new Error('Product not found') }
  res.json({ data: product })
}))

// POST /api/products  { name, groupId, unit, costPrice, landingPriceWithGst, marginPercent, marginFlat, stockQty }
router.post('/', asyncHandler(async (req, res) => {
  const { name, groupId, unit, costPrice, landingPriceWithGst, marginPercent, marginFlat, stockQty } = req.body
  if (!name?.trim()) { res.status(400); throw new Error('Product name required') }
  if (!groupId) { res.status(400); throw new Error('groupId required') }
  assertNonNegative(res, req.body, ['costPrice', 'marginPercent', 'marginFlat', 'stockQty'])

  // Selling rate ka base: agar "Landing price + GST" diya hua hai to wahi use hoga,
  // warna plain landing price (costPrice) se calculate hoga.
  const gstBase = landingPriceWithGst !== undefined && landingPriceWithGst !== null && landingPriceWithGst !== ''
    ? Number(landingPriceWithGst) : Number(costPrice) || 0
  const sellingPrice = calcSellingPrice(gstBase, marginPercent, marginFlat)

  const product = await prisma.product.create({
    data: {
      name: name.trim(),
      groupId,
      unit: unit || 'pcs',
      costPrice: Number(costPrice) || 0,
      landingPriceWithGst: landingPriceWithGst !== undefined && landingPriceWithGst !== '' ? Number(landingPriceWithGst) : null,
      marginPercent: marginPercent !== undefined ? Number(marginPercent) : null,
      marginFlat: marginFlat !== undefined ? Number(marginFlat) : null,
      sellingPrice,
      stockQty: Number(stockQty) || 0
    }
  })
  res.status(201).json({ data: product })
}))

// PUT /api/products/:id  — margin ya landing+GST change hone pe sellingPrice re-calculate hoga
router.put('/:id', asyncHandler(async (req, res) => {
  const { name, unit, costPrice, landingPriceWithGst, marginPercent, marginFlat, stockQty, groupId } = req.body

  const existing = await prisma.product.findUnique({ where: { id: req.params.id } })
  if (!existing) { res.status(404); throw new Error('Product not found') }
  assertNonNegative(res, req.body, ['costPrice', 'marginPercent', 'marginFlat', 'stockQty'])

  const finalCost = costPrice !== undefined ? Number(costPrice) : existing.costPrice
  const finalLandingGst = landingPriceWithGst !== undefined
    ? (landingPriceWithGst === '' || landingPriceWithGst === null ? null : Number(landingPriceWithGst))
    : existing.landingPriceWithGst
  const finalMarginPercent = marginPercent !== undefined ? Number(marginPercent) : existing.marginPercent
  const finalMarginFlat = marginFlat !== undefined ? Number(marginFlat) : existing.marginFlat

  // Selling rate ka base: Landing price + GST agar maujood hai to wahi, warna plain landing price
  const gstBase = finalLandingGst !== null && finalLandingGst !== undefined ? finalLandingGst : finalCost
  const sellingPrice = calcSellingPrice(gstBase, finalMarginFlat ? null : finalMarginPercent, finalMarginFlat)

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(groupId !== undefined ? { groupId } : {}),
      ...(unit !== undefined ? { unit } : {}),
      costPrice: finalCost,
      landingPriceWithGst: finalLandingGst,
      marginPercent: finalMarginPercent,
      marginFlat: finalMarginFlat,
      sellingPrice,
      ...(stockQty !== undefined ? { stockQty: Number(stockQty) } : {})
    }
  })
  res.json({ data: product })
}))

// POST /api/products/recalculate-selling-prices?groupId=xxx
// Purane products jinka sellingPrice purani formula se (ya bina Landing+GST ke) save
// hua tha unhe naye formula se dobara calculate karta hai — bina har product ko
// manually edit kiye.
router.post('/recalculate-selling-prices', asyncHandler(async (req, res) => {
  const { groupId } = req.body
  const products = await prisma.product.findMany({ where: groupId ? { groupId } : {} })

  let updated = 0
  for (const p of products) {
    const gstBase = p.landingPriceWithGst !== null && p.landingPriceWithGst !== undefined ? p.landingPriceWithGst : p.costPrice
    const sellingPrice = calcSellingPrice(gstBase, p.marginFlat ? null : p.marginPercent, p.marginFlat)
    if (sellingPrice !== p.sellingPrice) {
      await prisma.product.update({ where: { id: p.id }, data: { sellingPrice } })
      updated++
    }
  }
  res.json({ success: true, checked: products.length, updated })
}))

// POST /api/products/bulk-delete  { ids: string[] }
router.post('/bulk-delete', asyncHandler(async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400); throw new Error('Koi product select nahi kiya') }

  let deletedCount = 0
  const failed = []
  for (const id of ids) {
    try {
      await prisma.product.delete({ where: { id } })
      deletedCount++
    } catch (err) {
      failed.push(id)
    }
  }
  res.json({ success: true, deletedCount, failedCount: failed.length })
}))

// DELETE /api/products/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    if (err.code === 'P2025') { res.status(404); throw new Error('Product not found') }
    if (err.code === 'P2003') {
      res.status(409)
      throw new Error('Yeh product kisi purchase ya sales invoice mein already use ho chuka hai, isliye delete nahi kar sakte. Pehle wo invoices delete karo, ya stock 0 kar do.')
    }
    throw err
  }
}))

module.exports = router
