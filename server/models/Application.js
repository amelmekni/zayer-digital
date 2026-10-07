import mongoose from 'mongoose'

const applicationSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    index: true,
  },
  firstName: {
    type: String,
    required: [true, 'First name is required.'],
    trim: true,
    minlength: 1,
    maxlength: 80,
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required.'],
    trim: true,
    minlength: 1,
    maxlength: 80,
  },
  email: {
    type: String,
    required: [true, 'Email is required.'],
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.'],
    index: true,
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 40,
  },
  cv: {
    type: String,
    trim: true,
    maxlength: 2048,
  },
  message: {
    type: String,
    trim: true,
    maxlength: 10000,
  },
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'shortlisted', 'rejected', 'accepted'],
    default: 'pending',
    required: true,
    index: true,
  },
}, {
  timestamps: true,
  strict: 'throw',
})

applicationSchema.index({ job: 1, createdAt: -1 })
applicationSchema.index({ status: 1, createdAt: -1 })

const Application = mongoose.model('Application', applicationSchema)

export default Application
