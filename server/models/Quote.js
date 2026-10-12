import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0.01 },
  paidAt: { type: Date, required: true },
  note: { type: String, trim: true, maxlength: 300 },
}, { _id: true })

const lineItemSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: ['service', 'custom', 'retainer'],
    required: true,
  },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  unit: { type: String, required: true, trim: true, maxlength: 40 },
  quantity: { type: Number, required: true, min: 0.01, max: 100000 },
  unitPrice: { type: Number, min: 0, default: 0 },
  monthlyPrice: { type: Number, min: 0, default: 0 },
  includedMonths: { type: Number, min: 0, max: 120, default: 0 },
  contractMonths: { type: Number, min: 1, max: 120 },
  startDelayMonths: { type: Number, min: 0, max: 120, default: 0 },
}, { _id: true })

const quoteSchema = new mongoose.Schema({
  quoteNumber: {
    type: String,
    required: true,
    unique: true,
    immutable: true,
    match: /^ZD-\d{6,}$/,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  client: {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    company: { type: String, trim: true, maxlength: 160 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40 },
    address: { type: String, trim: true, maxlength: 1000 },
  },
  proposal: { type: String, trim: true, maxlength: 10000, default: '' },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    match: /^[A-Z]{3}$/,
  },
  lineItems: {
    type: [lineItemSchema],
    required: true,
    validate: {
      validator: (items) => items.length > 0 && items.length <= 100,
      message: 'A quote must contain between 1 and 100 line items.',
    },
  },
  subtotal: { type: Number, required: true, min: 0 },
  discountAmount: { type: Number, required: true, min: 0, default: 0 },
  taxRate: { type: Number, required: true, min: 0, max: 100, default: 0 },
  taxAmount: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  depositRate: { type: Number, required: true, min: 0, max: 100, default: 0 },
  depositAmount: { type: Number, required: true, min: 0, default: 0 },
  balanceAmount: { type: Number, required: true, min: 0, default: 0 },
  monthlyRecurringTotal: { type: Number, required: true, min: 0, default: 0 },
  paymentTerms: { type: String, trim: true, maxlength: 2000, default: '' },
  status: {
    type: String,
    enum: ['draft', 'sent', 'approved', 'rejected', 'cancelled'],
    default: 'draft',
    index: true,
  },
  approvedAt: { type: Date },
  payments: { type: [paymentSchema], default: [] },
  paidAmount: { type: Number, required: true, min: 0, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'deposit_paid', 'paid'],
    default: 'unpaid',
    index: true,
  },
}, {
  timestamps: true,
  strict: 'throw',
})

quoteSchema.index({ createdBy: 1, createdAt: -1 })
quoteSchema.index({ status: 1, createdAt: -1 })

const Quote = mongoose.model('Quote', quoteSchema)

export default Quote
