import mongoose from 'mongoose'

const serviceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Service title is required.'],
    trim: true,
    minlength: 2,
    maxlength: 160,
  },
  slug: {
    type: String,
    required: [true, 'Service slug is required.'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain lowercase letters, numbers, and hyphens.'],
    maxlength: 180,
  },
  shortDescription: {
    type: String,
    required: [true, 'A short description is required.'],
    trim: true,
    maxlength: 300,
  },
  description: {
    type: String,
    required: [true, 'Service description is required.'],
    trim: true,
    maxlength: 10000,
  },
  icon: {
    type: String,
    trim: true,
    maxlength: 80,
  },
  image: {
    type: String,
    trim: true,
    maxlength: 2048,
  },
  category: {
    type: String,
    required: [true, 'Service category is required.'],
    enum: ['marketing', 'creative', 'development', 'ecommerce', 'technology', 'strategy'],
    index: true,
  },
  price: {
    type: Number,
    min: 0,
  },
  currency: {
    type: String,
    trim: true,
    uppercase: true,
    default: 'TND',
    maxlength: 3,
    match: [/^[A-Z]{3}$/, 'Currency must be a three-letter code.'],
  },
  features: {
    type: [{
      type: String,
      trim: true,
      maxlength: 300,
    }],
    default: [],
    validate: {
      validator: (features) => features.length <= 50,
      message: 'A service cannot have more than 50 features.',
    },
  },
  technologies: {
    type: [{
      type: String,
      trim: true,
      maxlength: 80,
    }],
    default: [],
    validate: {
      validator: (technologies) => technologies.length <= 50,
      message: 'A service cannot have more than 50 technologies.',
    },
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, {
  timestamps: true,
  strict: 'throw',
})

serviceSchema.index({ isActive: 1, category: 1, createdAt: -1 })

const Service = mongoose.model('Service', serviceSchema)

export default Service
