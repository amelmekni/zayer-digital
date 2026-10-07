import Service from '../models/Service.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getAllowedFields,
  getSortOrder,
  paginationMeta,
  parseEnumFilter,
  parsePagination,
  parseSearch,
} from '../utils/apiQuery.js'

const categories = Service.schema.path('category').enumValues
const sortOptions = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  title: { title: 1 },
}

export const getServices = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query)
  const filter = { isActive: true }
  const category = parseEnumFilter(req.query.category, categories, 'category')
  const sort = getSortOrder(req.query.sort, sortOptions, sortOptions.newest)

  if (category) filter.category = category
  const search = parseSearch(req.query.search)
  if (search) {
    filter.$or = [{ title: search }, { shortDescription: search }, { description: search }]
  }

  const [services, total] = await Promise.all([
    Service.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Service.countDocuments(filter),
  ])

  res.json({
    success: true,
    data: services,
    meta: { pagination: paginationMeta(page, limit, total) },
  })
})

export const getServiceBySlug = asyncHandler(async (req, res) => {
  const service = await Service.findOne({ slug: req.params.slug, isActive: true }).lean()
  if (!service) {
    return res.status(404).json({ success: false, error: { message: 'Service not found.' } })
  }
  return res.json({ success: true, data: service })
})

export const createService = asyncHandler(async (req, res) => {
  const service = await Service.create(req.body)
  return res.status(201).json({ success: true, data: service })
})

export const updateService = asyncHandler(async (req, res) => {
  const update = getAllowedFields(req.body, [
    'title',
    'slug',
    'shortDescription',
    'description',
    'icon',
    'image',
    'category',
    'price',
    'currency',
    'features',
    'technologies',
    'isActive',
  ])
  const service = await Service.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  })
  if (!service) {
    return res.status(404).json({ success: false, error: { message: 'Service not found.' } })
  }
  return res.json({ success: true, data: service })
})

export const deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findByIdAndDelete(req.params.id)
  if (!service) {
    return res.status(404).json({ success: false, error: { message: 'Service not found.' } })
  }
  return res.json({ success: true, data: { id: service.id } })
})
