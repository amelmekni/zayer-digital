import mongoose from 'mongoose'

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required.'],
    trim: true,
    minlength: 2,
    maxlength: 160,
  },
  slug: {
    type: String,
    required: [true, 'Job slug is required.'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain lowercase letters, numbers, and hyphens.'],
    maxlength: 180,
  },
  department: {
    type: String,
    required: [true, 'Job department is required.'],
    trim: true,
    maxlength: 120,
  },
  location: {
    type: String,
    required: [true, 'Job location is required.'],
    trim: true,
    maxlength: 160,
  },
  type: {
    type: String,
    required: [true, 'Job type is required.'],
    enum: ['full-time', 'part-time', 'contract', 'internship', 'freelance'],
  },
  experience: {
    type: String,
    trim: true,
    maxlength: 120,
  },
  description: {
    type: String,
    required: [true, 'Job description is required.'],
    trim: true,
    maxlength: 10000,
  },
  requirements: {
    type: [{
      type: String,
      trim: true,
      maxlength: 500,
    }],
    default: [],
    validate: {
      validator: (items) => items.length <= 50,
      message: 'A job cannot have more than 50 requirements.',
    },
  },
  responsibilities: {
    type: [{
      type: String,
      trim: true,
      maxlength: 500,
    }],
    default: [],
    validate: {
      validator: (items) => items.length <= 50,
      message: 'A job cannot have more than 50 responsibilities.',
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

jobSchema.index({ isActive: 1, department: 1, createdAt: -1 })

const Job = mongoose.model('Job', jobSchema)

export default Job
