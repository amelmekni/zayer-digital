import mongoose from 'mongoose'
import Application from '../models/Application.js'
import Job from '../models/Job.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getAllowedFields,
  paginationMeta,
  parseEnumFilter,
  parsePagination,
  parseSearch,
} from '../utils/apiQuery.js'

const applicationStatuses = Application.schema.path('status').enumValues

export const createApplication = asyncHandler(async (req, res) => {
  const body = getAllowedFields(req.body, [
    'job',
    'firstName',
    'lastName',
    'email',
    'phone',
    'cv',
    'message',
  ])

  if (body.job && !mongoose.isValidObjectId(body.job)) {
    return res.status(400).json({
      success: false,
      error: { message: 'A valid job ID is required when applying for a specific role.' },
    })
  }

  if (body.job) {
    const jobExists = await Job.exists({ _id: body.job, isActive: true })
    if (!jobExists) {
      return res.status(404).json({
        success: false,
        error: { message: 'Open job not found.' },
      })
    }
  }

  const application = await Application.create(body)
  if (application.job) await application.populate('job', 'title slug')
  const responseApplication = application.toObject()
  delete responseApplication.cv
  return res.status(201).json({ success: true, data: responseApplication })
})

export const getApplications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query)
  const filter = {}
  const status = parseEnumFilter(req.query.status, applicationStatuses, 'status')

  if (status) filter.status = status
  if (req.query.job) {
    if (!mongoose.isValidObjectId(req.query.job)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid job filter.' },
      })
    }
    filter.job = req.query.job
  }
  const search = parseSearch(req.query.search)
  if (search) {
    filter.$or = [{ firstName: search }, { lastName: search }, { email: search }]
  }

  const [applications, total] = await Promise.all([
    Application.find(filter)
      .select('-cv')
      .populate('job', 'title slug department')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Application.countDocuments(filter),
  ])

  res.json({
    success: true,
    data: applications,
    meta: { pagination: paginationMeta(page, limit, total) },
  })
})

export const getApplicationById = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id)
    .select('-cv')
    .populate('job', 'title slug department')
    .lean()

  if (!application) {
    return res.status(404).json({ success: false, error: { message: 'Application not found.' } })
  }
  return res.json({ success: true, data: application })
})

export const updateApplication = asyncHandler(async (req, res) => {
  const update = getAllowedFields(req.body, ['status'])
  const application = await Application.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  })
    .select('-cv')
    .populate('job', 'title slug department')

  if (!application) {
    return res.status(404).json({ success: false, error: { message: 'Application not found.' } })
  }
  return res.json({ success: true, data: application })
})
