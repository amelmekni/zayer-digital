import mongoose from 'mongoose'

const paymentIdempotencySchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  key: {
    type: String,
    required: true,
    minlength: 16,
    maxlength: 128,
  },
  requestHash: {
    type: String,
    required: true,
    match: /^[a-f\d]{64}$/,
  },
  response: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, {
  timestamps: true,
  strict: 'throw',
})

paymentIdempotencySchema.index({ actorId: 1, key: 1 }, { unique: true })

const PaymentIdempotency = mongoose.model('PaymentIdempotency', paymentIdempotencySchema)

export default PaymentIdempotency
