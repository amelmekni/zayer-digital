import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addUtcMonths,
  assertQuoteCurrencyUnchanged,
  buildRetainerInstallments,
  canTransitionQuoteStatus,
  calculatePaymentSummary,
  calculateQuote,
  getPaymentStatus,
  parseMoney,
  parseRate,
} from '../utils/quoteDomain.js'

test('parses and rounds money while rejecting missing, non-numeric, and out-of-range values', () => {
  assert.equal(parseMoney(1.005, 'unitPrice'), 1.01)
  assert.equal(parseMoney('12.345', 'unitPrice'), 12.35)
  assert.equal(parseMoney(undefined, 'discountAmount', { optional: true }), 0)

  for (const invalid of [null, '', '   ', true, {}, Number.NaN, Infinity, -0.01, 100_000_001]) {
    assert.throws(
      () => parseMoney(invalid, 'unitPrice'),
      (error) => error.statusCode === 400 && /unitPrice/.test(error.message),
      `expected ${String(invalid)} to be rejected`,
    )
  }
})

test('parses financial rates without coercing empty or non-numeric JSON values to zero', () => {
  assert.equal(parseRate('7.5', 'taxRate'), 7.5)
  assert.equal(parseRate(undefined, 'taxRate', 0), 0)

  for (const invalid of [null, '', '   ', true, {}, Number.NaN, Infinity, -0.01, 100.01]) {
    assert.throws(
      () => parseRate(invalid, 'taxRate'),
      (error) => error.statusCode === 400 && /taxRate/.test(error.message),
      `expected ${String(invalid)} to be rejected`,
    )
  }
})

test('allows only the declared forward quote status transitions', () => {
  const transitions = {
    draft: ['sent', 'cancelled'],
    sent: ['approved', 'rejected', 'cancelled'],
    approved: [],
    rejected: [],
    cancelled: [],
  }

  for (const [current, allowed] of Object.entries(transitions)) {
    for (const next of Object.keys(transitions)) {
      assert.equal(
        canTransitionQuoteStatus(current, next),
        allowed.includes(next),
        `${current} -> ${next}`,
      )
    }
  }
  assert.equal(canTransitionQuoteStatus('unknown', 'sent'), false)
})

test('calculates one-time totals, discount, tax, deposit, balance, and monthly amounts', () => {
  const totals = calculateQuote([
    { quantity: 2, unitPrice: 125.25, monthlyPrice: 0 },
    { quantity: 1, unitPrice: 50, monthlyPrice: 80 },
  ], { discountAmount: 25.5, taxRate: 10, depositRate: 30 })

  assert.deepEqual(totals, {
    subtotal: 300.5,
    discountAmount: 25.5,
    taxRate: 10,
    taxAmount: 27.5,
    total: 302.5,
    depositRate: 30,
    depositAmount: 90.75,
    balanceAmount: 211.75,
    monthlyRecurringTotal: 80,
  })
})

test('rejects an excessive discount and invalid financial rates', () => {
  assert.throws(() => calculateQuote([{ quantity: 1, unitPrice: 20, monthlyPrice: 0 }], {
    discountAmount: 21,
  }), /cannot exceed/)
  assert.throws(() => parseRate(101, 'taxRate'), /between 0 and 100/)
  assert.throws(() => calculateQuote([{ quantity: 2, unitPrice: 60_000_000, monthlyPrice: 0 }]), /cannot exceed/)
})

test('payment status reflects unpaid, deposit, and fully paid states', () => {
  assert.equal(getPaymentStatus(0, 100, 20), 'unpaid')
  assert.equal(getPaymentStatus(20, 100, 20), 'deposit_paid')
  assert.equal(getPaymentStatus(100, 100, 20), 'paid')
})

test('keeps recorded service prices in their original quote currency', () => {
  const quote = {
    currency: 'TND',
    lineItems: [{ kind: 'service', unitPrice: 100, monthlyPrice: 0 }],
  }

  assert.doesNotThrow(() => assertQuoteCurrencyUnchanged(quote, 'tnd'))
  assert.throws(
    () => assertQuoteCurrencyUnchanged(quote, 'EUR'),
    (error) => error.statusCode === 409 && /cannot be changed/.test(error.message),
  )
})

test('calculates the current PDF payment summary from recorded payments', () => {
  const cases = [
    { name: 'no payments', payments: [], expectedPaid: 0, expectedBalance: 100 },
    { name: 'deposit paid', payments: [{ amount: 20 }], expectedPaid: 20, expectedBalance: 80 },
    { name: 'partial payment', payments: [{ amount: 20 }, { amount: 25 }], expectedPaid: 45, expectedBalance: 55 },
    { name: 'fully paid', payments: [{ amount: 20 }, { amount: 80 }], expectedPaid: 100, expectedBalance: 0 },
  ]

  for (const { name, payments, expectedPaid, expectedBalance } of cases) {
    const summary = calculatePaymentSummary({
      total: 100,
      depositAmount: 20,
      payments,
    })
    assert.deepEqual(summary, {
      paidAmount: expectedPaid,
      outstandingBalance: expectedBalance,
    }, name)
  }
})

test('monthly date arithmetic clamps end-of-month dates and installments honor included/delay months', () => {
  const approvalDate = new Date('2026-01-31T12:30:00.000Z')
  assert.equal(addUtcMonths(approvalDate, 1).toISOString(), '2026-02-28T12:30:00.000Z')

  const items = buildRetainerInstallments({
    _id: 'quote-id',
    lineItems: [{
      _id: 'line-id',
      kind: 'retainer',
      quantity: 2,
      monthlyPrice: 150,
      includedMonths: 2,
      startDelayMonths: 1,
      contractMonths: 2,
    }, {
      _id: 'one-off',
      kind: 'custom',
      quantity: 1,
      unitPrice: 100,
      monthlyPrice: 0,
    }],
  }, approvalDate)

  assert.deepEqual(items.map(({ installmentNumber, dueAt, amount }) => [
    installmentNumber, dueAt.toISOString(), amount,
  ]), [
    [1, '2026-05-31T12:30:00.000Z', 300],
    [2, '2026-06-30T12:30:00.000Z', 300],
  ])
})
