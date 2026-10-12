export function requireSalesRole(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required.' },
    })
  }

  if (!['admin', 'sales_agent'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: { message: 'Sales access required.' },
    })
  }

  return next()
}
