import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getAllowedFields,
  getSortOrder,
  paginationMeta,
  parseEnumFilter,
  parsePagination,
  parseSearch,
} from '../utils/apiQuery.js'

const userRoles = User.schema.path('role').enumValues
const safeUserFields = 'name email role avatar createdAt updatedAt'
const sortOptions = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
}

export const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query)
  const filter = {}
  const role = parseEnumFilter(req.query.role, userRoles, 'role')
  const sort = getSortOrder(req.query.sort, sortOptions, sortOptions.newest)

  if (role) filter.role = role
  const search = parseSearch(req.query.search)
  if (search) {
    filter.$or = [{ name: search }, { email: search }]
  }

  const [users, total] = await Promise.all([
    User.find(filter).select(safeUserFields).sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ])

  res.json({
    success: true,
    data: users,
    meta: { pagination: paginationMeta(page, limit, total) },
  })
})

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(safeUserFields).lean()
  if (!user) {
    return res.status(404).json({ success: false, error: { message: 'User not found.' } })
  }
  return res.json({ success: true, data: user })
})

export const updateUser = asyncHandler(async (req, res) => {
  const update = getAllowedFields(req.body, ['name', 'email', 'role', 'avatar'])
  const user = await User.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  }).select(safeUserFields)

  if (!user) {
    return res.status(404).json({ success: false, error: { message: 'User not found.' } })
  }
  return res.json({ success: true, data: user })
})

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id).select('name email')
  if (!user) {
    return res.status(404).json({ success: false, error: { message: 'User not found.' } })
  }
  return res.json({ success: true, data: { id: user.id } })
})
