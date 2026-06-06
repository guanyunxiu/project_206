const jwt = require('jsonwebtoken')
const { query } = require('../config/database')
require('dotenv').config()

const JWT_SECRET = process.env.JWT_SECRET || 'meeting_room_secret_key_2024'

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({
      code: 401,
      message: '未提供访问令牌',
      data: null,
      timestamp: Date.now()
    })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({
        code: 401,
        message: '令牌无效或已过期',
        data: null,
        timestamp: Date.now()
      })
    }
    req.user = user
    next()
  })
}

function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const userId = req.user.id
      const users = await query('SELECT role FROM users WHERE id = ?', [userId])
      
      if (users.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '用户不存在',
          data: null,
          timestamp: Date.now()
        })
      }

      const userRole = users[0].role
      if (!roles.includes(userRole)) {
        return res.status(403).json({
          code: 403,
          message: '权限不足，无法执行此操作',
          data: null,
          timestamp: Date.now()
        })
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

function requireDeptAdminOrHigher() {
  return requireRole('dept_admin', 'admin', 'super_admin')
}

function requireAdminOrHigher() {
  return requireRole('admin', 'super_admin')
}

function requireSuperAdmin() {
  return requireRole('super_admin')
}

module.exports = {
  authenticateToken,
  requireRole,
  requireDeptAdminOrHigher,
  requireAdminOrHigher,
  requireSuperAdmin,
  JWT_SECRET
}
