import User from '../models/User.js'
import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { withAdminAccountGuard } from '../utils/adminAccountGuard.js'
import { createUserAccountMutations } from '../utils/userAccountMutations.js'
import {
  getAllowedFields,
  getSortOrder,
  paginationMeta,
  parseEnumFilter,
  parsePagination,
  parseSearch,
} from '../utils/apiQuery.js'
import { validatePassword } from '../utils/passwordPolicy.js'

const userRoles = User.schema.path('role').enumValues
const safeUserFields = 'name email role avatar isActive createdAt updatedAt'
const sortOptions = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
}
const userAccountMutations = createUserAccountMutations({
  users: {
    findRoleById: (id, session) => User.findById(id)
      .select('role tokenVersion')
      .session(session)
      .lean(),
    countAdmins: (session) => User.countDocuments({ role: 'admin' }).session(session),
    updateById: (id, update, session) => User.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    })
      .select(safeUserFields)
      .session(session),
    deleteById: (id, session) => User.findByIdAndDelete(id)
      .select('name email')
      .session(session),
  },
  withGuard: withAdminAccountGuard,
})

function blockedUserMutation(res, message) {
  return res.status(409).json({ success: false, error: { message } })
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

export const createAgent = asyncHandler(async (req, res) => {
  const body = getAllowedFields(req.body, ['name', 'email', 'password'])
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ success: false, error: { message: 'Name must be between 2 and 100 characters.' } })
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: { message: 'Enter a valid email address.' } })
  }
  const passwordError = validatePassword(body.password)
  if (passwordError) {
    return res.status(400).json({ success: false, error: { message: passwordError } })
  }
  const password = await bcrypt.hash(body.password, env.bcryptRounds)
  const agent = await User.create({ name, email, password, role: 'sales_agent' })
  return res.status(201).json({
    success: true,
    data: {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      isActive: agent.isActive,
      createdAt: agent.createdAt,
    },
  })
})

export const setAgentStatus = asyncHandler(async (req, res) => {
  const { isActive } = getAllowedFields(req.body, ['isActive'])
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, error: { message: 'isActive must be a boolean.' } })
  }
  const agent = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'sales_agent' },
    { $set: { isActive }, $inc: { tokenVersion: 1 } },
    { new: true, runValidators: true },
  ).select(safeUserFields)
  if (!agent) return res.status(404).json({ success: false, error: { message: 'Sales agent not found.' } })
  return res.json({ success: true, data: agent })
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
  const result = update.role === undefined
    ? {
      kind: 'updated',
      user: await User.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true,
      }).select(safeUserFields),
    }
    : await userAccountMutations.update({
      actorId: req.user.id,
      targetId: req.params.id,
      update,
    })

  if (result.kind === 'self-demotion') {
    return blockedUserMutation(res, 'Administrators cannot change their own role.')
  }
  if (result.kind === 'last-admin') {
    return blockedUserMutation(res, 'The last administrator cannot lose the administrator role.')
  }
  if (result.kind === 'not-found' || !result.user) {
    return res.status(404).json({ success: false, error: { message: 'User not found.' } })
  }
  return res.json({ success: true, data: result.user })
})

export const deleteUser = asyncHandler(async (req, res) => {
  const result = await userAccountMutations.delete({
    actorId: req.user.id,
    targetId: req.params.id,
  })
  if (result.kind === 'self-deletion') {
    return blockedUserMutation(res, 'Administrators cannot delete their own account.')
  }
  if (result.kind === 'last-admin') {
    return blockedUserMutation(res, 'The last administrator cannot be deleted.')
  }
  if (result.kind === 'not-found' || !result.user) {
    return res.status(404).json({ success: false, error: { message: 'User not found.' } })
  }
  return res.json({ success: true, data: { id: result.user.id } })
})
