import mongoose from 'mongoose'

const quoteSequenceSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: 'quote',
  },
  value: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
}, {
  versionKey: false,
})

const QuoteSequence = mongoose.model('QuoteSequence', quoteSequenceSchema)

export default QuoteSequence
