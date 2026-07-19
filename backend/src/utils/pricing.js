/**
 * Selling price calculate karta hai cost price + margin se.
 * marginFlat priority leta hai agar dono diye ho.
 */
function calcSellingPrice(costPrice, marginPercent, marginFlat) {
  const cost = Number(costPrice) || 0
  if (marginFlat !== undefined && marginFlat !== null && marginFlat !== '') {
    return +(cost + Number(marginFlat)).toFixed(2)
  }
  if (marginPercent !== undefined && marginPercent !== null && marginPercent !== '') {
    return +(cost * (1 + Number(marginPercent) / 100)).toFixed(2)
  }
  return cost
}

module.exports = { calcSellingPrice }
