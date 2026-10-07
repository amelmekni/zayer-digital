import Project from '../models/Project.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getAllowedFields,
  getSortOrder,
  paginationMeta,
  parseBooleanFilter,
  parseEnumFilter,
  parsePagination,
  parseSearch,
} from '../utils/apiQuery.js'

const categories = Project.schema.path('category').enumValues
const sortOptions = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  title: { title: 1 },
  featured: { featured: -1, createdAt: -1 },
}

export const getProjects = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query)
  const filter = { isPublished: true }
  const category = parseEnumFilter(req.query.category, categories, 'category')
  const featured = parseBooleanFilter(req.query.featured, 'featured')
  const sort = getSortOrder(req.query.sort, sortOptions, sortOptions.newest)

  if (category) filter.category = category
  if (featured !== undefined) filter.featured = featured
  const search = parseSearch(req.query.search)
  if (search) {
    filter.$or = [{ title: search }, { description: search }, { client: search }]
  }

  const [projects, total] = await Promise.all([
    Project.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Project.countDocuments(filter),
  ])

  res.json({
    success: true,
    data: projects,
    meta: { pagination: paginationMeta(page, limit, total) },
  })
})

export const getProjectBySlug = asyncHandler(async (req, res) => {
  const project = await Project.findOne({ slug: req.params.slug, isPublished: true }).lean()
  if (!project) {
    return res.status(404).json({ success: false, error: { message: 'Project not found.' } })
  }
  return res.json({ success: true, data: project })
})

export const createProject = asyncHandler(async (req, res) => {
  const project = await Project.create(req.body)
  return res.status(201).json({ success: true, data: project })
})

export const updateProject = asyncHandler(async (req, res) => {
  const update = getAllowedFields(req.body, [
    'title',
    'slug',
    'description',
    'category',
    'image',
    'mediaUrl',
    'mediaType',
    'portfolioSection',
    'sector',
    'linkUrl',
    'gallery',
    'technologies',
    'client',
    'year',
    'featured',
    'isPublished',
  ])
  const project = await Project.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  })
  if (!project) {
    return res.status(404).json({ success: false, error: { message: 'Project not found.' } })
  }
  return res.json({ success: true, data: project })
})

export const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findByIdAndDelete(req.params.id)
  if (!project) {
    return res.status(404).json({ success: false, error: { message: 'Project not found.' } })
  }
  return res.json({ success: true, data: { id: project.id } })
})
