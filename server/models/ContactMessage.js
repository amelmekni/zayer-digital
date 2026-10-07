import mongoose from 'mongoose'

const contactMessageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required.'],
    trim: true,
    minlength: 2,
    maxlength: 160,
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
  company: {
    type: String,
    trim: true,
    maxlength: 160,
  },
  subject: {
    type: String,
    trim: true,
    maxlength: 200,
  },
  message: {
    type: String,
    required: [true, 'Message is required.'],
    trim: true,
    minlength: 5,
    maxlength: 10000,
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'replied', 'archived'],
    default: 'unread',
    required: true,
    index: true,
  },
}, {
  timestamps: true,
  strict: 'throw',
})

contactMessageSchema.index({ status: 1, createdAt: -1 })

const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema)

export default ContactMessage
