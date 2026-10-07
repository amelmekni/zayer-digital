import Job from '../models/Job.js'
import Application from '../models/Application.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getAllowedFields,
  getSortOrder,
  paginationMeta,
  parsePagination,
  parseSearch,
} from '../utils/apiQuery.js'

const sortOptions = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  title: { title: 1 },
}

export const getJobs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query)
  const filter = { isActive: true }
  const sort = getSortOrder(req.query.sort, sortOptions, sortOptions.newest)

  if (req.query.department) filter.department = String(req.query.department).trim()
  if (req.query.type) {
    const allowedTypes = Job.schema.path('type').enumValues
    if (!allowedTypes.includes(req.query.type)) {
      return res.status(400).json({
        success: false,
        error: { message: `Invalid type filter. Allowed values: ${allowedTypes.join(', ')}.` },
      })
    }
    filter.type = req.query.type
  }
  const search = parseSearch(req.query.search)
  if (search) {
    filter.$or = [{ title: search }, { department: search }, { location: search }, { description: search }]
  }

  const [jobs, total] = await Promise.all([
    Job.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Job.countDocuments(filter),
  ])

  res.json({
    success: true,
    data: jobs,
    meta: { pagination: paginationMeta(page, limit, total) },
  })
})

export const getJobBySlug = asyncHandler(async (req, res) => {
  const job = await Job.findOne({ slug: req.params.slug, isActive: true }).lean()
  if (!job) {
    return res.status(404).json({ success: false, error: { message: 'Job not found.' } })
  }
  return res.json({ success: true, data: job })
})

export const createJob = asyncHandler(async (req, res) => {
  const job = await Job.create(req.body)
  return res.status(201).json({ success: true, data: job })
})

export const updateJob = asyncHandler(async (req, res) => {
  const update = getAllowedFields(req.body, [
    'title',
    'slug',
    'department',
    'location',
    'type',
    'experience',
    'description',
    'requirements',
    'responsibilities',
    'isActive',
  ])
  const job = await Job.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  })
  if (!job) {
    return res.status(404).json({ success: false, error: { message: 'Job not found.' } })
  }
  return res.json({ success: true, data: job })
})

export const deleteJob = asyncHandler(async (req, res) => {
  const applicationExists = await Application.exists({ job: req.params.id })
  if (applicationExists) {
    return res.status(409).json({
      success: false,
      error: { message: 'This job has applications and cannot be deleted. Deactivate it instead.' },
    })
  }

  const job = await Job.findByIdAndDelete(req.params.id)
  if (!job) {
    return res.status(404).json({ success: false, error: { message: 'Job not found.' } })
  }
  return res.json({ success: true, data: { id: job.id } })
})
