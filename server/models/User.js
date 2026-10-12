import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required.'],
    trim: true,
    minlength: 2,
    maxlength: 100,
  },
  email: {
    type: String,
    required: [true, 'Email is required.'],
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.'],
  },
  password: {
    type: String,
    required: [true, 'Password is required.'],
    select: false,
  },
  role: {
    type: String,
    enum: ['admin', 'sales_agent', 'user'],
    default: 'user',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  tokenVersion: {
    type: Number,
    default: 0,
    min: 0,
  },
  avatar: {
    type: String,
    trim: true,
    maxlength: 2048,
  },
}, {
  timestamps: true,
  strict: 'throw',
})

userSchema.index({ role: 1, createdAt: -1 })

const User = mongoose.model('User', userSchema)

export default User
