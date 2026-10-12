import mongoose from 'mongoose'

const collectionPaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0.01 },
  paidAt: { type: Date, required: true },
  note: { type: String, trim: true, maxlength: 300 },
}, { _id: true })

const retainerCollectionSchema = new mongoose.Schema({
  quote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
    required: true,
    index: true,
  },
  quoteLineItem: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  installmentNumber: { type: Number, required: true, min: 1 },
  dueAt: { type: Date, required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, required: true, min: 0, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending',
    index: true,
  },
  payments: { type: [collectionPaymentSchema], default: [] },
}, {
  timestamps: true,
  strict: 'throw',
})

retainerCollectionSchema.index(
  { quote: 1, quoteLineItem: 1, installmentNumber: 1 },
  { unique: true },
)
retainerCollectionSchema.index({ status: 1, dueAt: 1 })

const RetainerCollection = mongoose.model('RetainerCollection', retainerCollectionSchema)

export default RetainerCollection
