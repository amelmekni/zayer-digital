import Quote from '../models/Quote.js'
import RetainerCollection from '../models/RetainerCollection.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const quoteFilter = req.user.role === 'admin' ? {} : { createdBy: req.user.id }
  const quotes = await Quote.aggregate([
    { $match: quoteFilter },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        drafts: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        awaitingDecision: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
        approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
        unpaid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, 1, 0] } },
        depositPaid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'deposit_paid'] }, 1, 0] } },
        paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
      },
    },
  ])
  const ownedQuoteIds = req.user.role === 'admin'
    ? null
    : await Quote.find({ createdBy: req.user.id }).distinct('_id')
  const collectionFilter = ownedQuoteIds === null ? {} : { quote: { $in: ownedQuoteIds } }
  const now = new Date()
  const [overdueCollections, upcomingCollections, activeAgents] = await Promise.all([
    RetainerCollection.countDocuments({
      ...collectionFilter,
      status: { $ne: 'paid' },
      dueAt: { $lte: now },
    }),
    RetainerCollection.countDocuments({
      ...collectionFilter,
      status: { $ne: 'paid' },
      dueAt: { $gt: now },
    }),
    req.user.role === 'admin' ? User.countDocuments({ role: 'sales_agent', isActive: true }) : 0,
  ])
  let agents
  if (req.user.role === 'admin') {
    const [users, quoteStats] = await Promise.all([
      User.find({ role: 'sales_agent' }).select('name email isActive').lean(),
      Quote.aggregate([
        { $group: {
          _id: '$createdBy',
          quotesTotal: { $sum: 1 },
          awaitingDecision: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
        } },
      ]),
    ])
    const statsByAgent = new Map(quoteStats.map((row) => [String(row._id), row]))
    agents = users.map((agent) => {
      const stats = statsByAgent.get(String(agent._id))
      return {
        ...agent,
        quotesTotal: stats?.quotesTotal || 0,
        awaitingDecision: stats?.awaitingDecision || 0,
        approved: stats?.approved || 0,
      }
    })
  }

  return res.json({
    success: true,
    data: {
      quotes: quotes[0] || {
        total: 0,
        drafts: 0,
        awaitingDecision: 0,
        approved: 0,
        unpaid: 0,
        depositPaid: 0,
        paid: 0,
      },
      overdueCollections,
      upcomingCollections,
      ...(req.user.role === 'admin' && { activeAgents, agents }),
    },
  })
})
