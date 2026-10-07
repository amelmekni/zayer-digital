import mongoose from 'mongoose'

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Project title is required.'],
    trim: true,
    minlength: 2,
    maxlength: 180,
  },
  slug: {
    type: String,
    required: [true, 'Project slug is required.'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain lowercase letters, numbers, and hyphens.'],
    maxlength: 200,
  },
  description: {
    type: String,
    required: [true, 'Project description is required.'],
    trim: true,
    maxlength: 10000,
  },
  category: {
    type: String,
    required: [true, 'Project category is required.'],
    enum: ['creative', 'web', 'mobile', 'ecommerce', 'ai', 'marketing'],
    index: true,
  },
  image: {
    type: String,
    trim: true,
    maxlength: 2048,
  },
  mediaUrl: {
    type: String,
    trim: true,
    maxlength: 2048,
  },
  mediaType: {
    type: String,
    enum: ['image', 'video', 'youtube'],
  },
  portfolioSection: {
    type: String,
    enum: ['creative', 'web', 'impact'],
    index: true,
  },
  sector: {
    type: String,
    trim: true,
    maxlength: 120,
  },
  linkUrl: {
    type: String,
    trim: true,
    maxlength: 2048,
  },
  gallery: {
    type: [{
      type: String,
      trim: true,
      maxlength: 2048,
    }],
    default: [],
    validate: {
      validator: (images) => images.length <= 30,
      message: 'A project gallery cannot contain more than 30 images.',
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
      message: 'A project cannot have more than 50 technologies.',
    },
  },
  client: {
    type: String,
    trim: true,
    maxlength: 160,
  },
  year: {
    type: Number,
    min: 1900,
    max: 2200,
  },
  featured: {
    type: Boolean,
    default: false,
    index: true,
  },
  isPublished: {
    type: Boolean,
    default: false,
    index: true,
  },
}, {
  timestamps: true,
  strict: 'throw',
})

projectSchema.pre('validate', function validateProjectMedia(next) {
  if (!this.image && !this.mediaUrl) {
    this.invalidate('mediaUrl', 'A project media URL is required.')
  }
  next()
})

projectSchema.index({ isPublished: 1, featured: -1, createdAt: -1 })
projectSchema.index({ title: 'text', description: 'text', client: 'text' })

const Project = mongoose.model('Project', projectSchema)

export default Project
