const MAX_MONEY = 100_000_000

const allowedQuoteTransitions = {
  draft: new Set(['sent', 'cancelled']),
  sent: new Set(['approved', 'rejected', 'cancelled']),
  approved: new Set(),
  rejected: new Set(),
  cancelled: new Set(),
}

export function parseMoney(value, field, { optional = false, minimum = 0 } = {}) {
  if (value === undefined && optional) return 0
  const amount = typeof value === 'number' || typeof value === 'string' && value.trim() !== ''
    ? Number(value)
    : Number.NaN
  if (!Number.isFinite(amount) || amount < minimum || amount > MAX_MONEY) {
    const error = new Error(`${field} must be between ${minimum} and ${MAX_MONEY}.`)
    error.statusCode = 400
    throw error
  }
  return roundMoney(amount)
}

export function parseRate(value, field, fallback = 0) {
  if (value === undefined) return fallback
  const rate = typeof value === 'number' || typeof value === 'string' && value.trim() !== ''
    ? Number(value)
    : Number.NaN
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    const error = new Error(`${field} must be between 0 and 100.`)
    error.statusCode = 400
    throw error
  }
  return rate
}

export function canTransitionQuoteStatus(currentStatus, nextStatus) {
  return allowedQuoteTransitions[currentStatus]?.has(nextStatus) ?? false
}

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function assertQuoteCurrencyUnchanged(existingQuote, requestedCurrency) {
  const hasRecordedPrices = existingQuote?.lineItems?.length > 0
  const currentCurrency = existingQuote?.currency?.trim().toUpperCase()
  const nextCurrency = requestedCurrency.trim().toUpperCase()
  if (hasRecordedPrices && currentCurrency !== nextCurrency) {
    const error = new Error('Quote currency cannot be changed after prices have been recorded.')
    error.statusCode = 409
    throw error
  }
}

export function calculatePaymentSummary({ total, payments = [] }) {
  const totalAmount = Number(total)
  if (!Number.isFinite(totalAmount) || totalAmount < 0 || !Array.isArray(payments)) {
    throw new Error('Cannot calculate a payment summary from invalid quote data.')
  }
  const paidAmount = roundMoney(payments.reduce((sum, payment) => {
    const amount = Number(payment?.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Cannot calculate a payment summary from invalid payment data.')
    }
    return sum + amount
  }, 0))
  return {
    paidAmount,
    outstandingBalance: Math.max(0, roundMoney(totalAmount - paidAmount)),
  }
}

export function calculateQuote(lineItems, { discountAmount = 0, taxRate = 0, depositRate = 0 } = {}) {
  const subtotal = roundMoney(lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  ))
  const discount = parseMoney(discountAmount, 'discountAmount')
  if (discount > subtotal) {
    const error = new Error('discountAmount cannot exceed the quote subtotal.')
    error.statusCode = 400
    throw error
  }

  const normalizedTaxRate = parseRate(taxRate, 'taxRate')
  const normalizedDepositRate = parseRate(depositRate, 'depositRate')
  const taxableAmount = roundMoney(subtotal - discount)
  const taxAmount = roundMoney(taxableAmount * normalizedTaxRate / 100)
  const total = roundMoney(taxableAmount + taxAmount)
  const depositAmount = roundMoney(total * normalizedDepositRate / 100)
  const monthlyRecurringTotal = roundMoney(lineItems.reduce(
    (sum, item) => sum + item.quantity * item.monthlyPrice,
    0,
  ))
  if ([subtotal, taxAmount, total, depositAmount, monthlyRecurringTotal].some((amount) => amount > MAX_MONEY)) {
    const error = new Error(`Quote amounts cannot exceed ${MAX_MONEY}.`)
    error.statusCode = 400
    throw error
  }

  return {
    subtotal,
    discountAmount: discount,
    taxRate: normalizedTaxRate,
    taxAmount,
    total,
    depositRate: normalizedDepositRate,
    depositAmount,
    balanceAmount: roundMoney(total - depositAmount),
    monthlyRecurringTotal,
  }
}

export function getPaymentStatus(paidAmount, total, depositAmount) {
  if (total > 0 && paidAmount >= total) return 'paid'
  if (depositAmount > 0 && paidAmount >= depositAmount) return 'deposit_paid'
  return 'unpaid'
}

export function addUtcMonths(date, monthOffset) {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + monthOffset
  const day = date.getUTCDate()
  const targetMonthStart = new Date(Date.UTC(year, month, 1))
  const lastDay = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth() + 1,
    0,
  )).getUTCDate()
  targetMonthStart.setUTCDate(Math.min(day, lastDay))
  targetMonthStart.setUTCHours(
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  )
  return targetMonthStart
}

export function buildRetainerInstallments(quote, approvedAt) {
  return quote.lineItems.flatMap((item) => {
    if (item.kind !== 'retainer' || item.monthlyPrice <= 0 || !item.contractMonths) return []
    const firstDueOffset = item.includedMonths + item.startDelayMonths
    return Array.from({ length: item.contractMonths }, (_, index) => ({
      quote: quote._id,
      quoteLineItem: item._id,
      installmentNumber: index + 1,
      dueAt: addUtcMonths(approvedAt, firstDueOffset + index + 1),
      amount: roundMoney(item.quantity * item.monthlyPrice),
    }))
  })
}
