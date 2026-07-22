// Body mein diye gaye numeric fields mein se koi bhi negative na ho, ye check karta hai.
// Field undefined/null ho to skip karta hai (optional fields allowed).
// Negative milne par res.status(400) set karke Error throw karta hai — route ke
// asyncHandler wrapper mein ye automatically errorHandler tak pahunch jayega.
function assertNonNegative(res, body, fields) {
  for (const field of fields) {
    const val = body[field]
    if (val === undefined || val === null || val === '') continue
    if (Number(val) < 0) {
      res.status(400)
      throw new Error(`${field} negative nahi ho sakta`)
    }
  }
}

module.exports = { assertNonNegative }
