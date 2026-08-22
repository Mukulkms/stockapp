/**
 * Selling price calculate karta hai cost price + margin se.
 * marginFlat priority leta hai agar dono diye ho AUR marginFlat non-zero ho
 * (0 ka matlab "flat margin nahi diya", percent wala use hoga).
 */
function calcSellingPrice(costPrice, marginPercent, marginFlat) {
  const cost = Number(costPrice) || 0
  if (marginFlat !== undefined && marginFlat !== null && marginFlat !== '' && Number(marginFlat) !== 0) {
    return +(cost + Number(marginFlat)).toFixed(2)
  }
  if (marginPercent !== undefined && marginPercent !== null && marginPercent !== '') {
    return +(cost * (1 + Number(marginPercent) / 100)).toFixed(2)
  }
  return cost
}

module.exports = { calcSellingPrice }
