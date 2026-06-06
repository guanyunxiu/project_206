const express = require('express')
const { query } = require('../config/database')
const { authenticateToken } = require('../middleware/auth')
const { createPagination } = require('../utils/helper')

const router = express.Router()

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { page, pageSize, is_read, type } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = ['user_id = ?']
    let params = [userId]

    if (is_read !== undefined && is_read !== '') {
      whereClauses.push('is_read = ?')
      params.push(parseInt(is_read))
    }
    if (type) {
      whereClauses.push('type = ?')
      params.push(type)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const notifications = await query(
      `SELECT * FROM notifications ${whereSql} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM notifications ${whereSql}`,
      params
    )

    const [unreadCount] = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    )

    res.success({
      list: notifications,
      total: countResult.total,
      page: parseInt(page) || 1,
      page_size: parseInt(pageSize) || 10,
      unread_count: unreadCount.count
    })
  } catch (error) {
    next(error)
  }
})

router.get('/unread-count', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id

    const [unreadCount] = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    )

    res.success({
      unread_count: unreadCount.count
    })
  } catch (error) {
    next(error)
  }
})

router.put('/:id/read', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const notifications = await query('SELECT * FROM notifications WHERE id = ? AND user_id = ?', [id, userId])
    if (notifications.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '通知不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    await query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id])

    res.success(null, '已标记为已读')
  } catch (error) {
    next(error)
  }
})

router.put('/read-all', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id

    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId])

    res.success(null, '已全部标记为已读')
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const notifications = await query('SELECT * FROM notifications WHERE id = ? AND user_id = ?', [id, userId])
    if (notifications.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '通知不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    await query('DELETE FROM notifications WHERE id = ?', [id])

    res.success(null, '删除成功')
  } catch (error) {
    next(error)
  }
})

module.exports = router
