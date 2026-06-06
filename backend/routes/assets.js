const express = require('express')
const { query } = require('../config/database')
const { authenticateToken } = require('../middleware/auth')
const { createPagination, getBorrowStatusName, getAssetCategoryName } = require('../utils/helper')

const router = express.Router()

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { page, pageSize, keyword, category, status } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = []
    let params = []

    if (keyword) {
      whereClauses.push('(name LIKE ? OR description LIKE ?)')
      const keywordParam = `%${keyword}%`
      params.push(keywordParam, keywordParam)
    }
    if (category) {
      whereClauses.push('category = ?')
      params.push(category)
    }
    if (status !== undefined) {
      whereClauses.push('status = ?')
      params.push(parseInt(status))
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const assets = await query(
      `SELECT * FROM assets ${whereSql} ORDER BY id ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const list = assets.map(a => ({
      ...a,
      category_name: getAssetCategoryName(a.category)
    }))

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM assets ${whereSql}`,
      params
    )

    res.success({
      list,
      total: countResult.total,
      page: parseInt(page) || 1,
      page_size: parseInt(pageSize) || 10
    })
  } catch (error) {
    next(error)
  }
})

router.get('/my', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { page, pageSize, status } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = ['br.user_id = ?']
    let params = [userId]

    if (status) {
      whereClauses.push('br.status = ?')
      params.push(status)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const borrowings = await query(
      `SELECT br.*, a.name as asset_name, a.category as asset_category,
              b.meeting_title, b.date, b.start_time, b.end_time,
              r.name as room_name
       FROM borrowing_records br
       LEFT JOIN assets a ON br.asset_id = a.id
       LEFT JOIN bookings b ON br.booking_id = b.id
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       ${whereSql}
       ORDER BY br.borrowed_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const list = borrowings.map(br => ({
      ...br,
      status_name: getBorrowStatusName(br.status),
      asset_category_name: getAssetCategoryName(br.asset_category)
    }))

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM borrowing_records br ${whereSql}`,
      params
    )

    res.success({
      list,
      total: countResult.total,
      page: parseInt(page) || 1,
      page_size: parseInt(pageSize) || 10
    })
  } catch (error) {
    next(error)
  }
})

router.put('/return/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const userRole = req.user.role

    const borrowings = await query('SELECT * FROM borrowing_records WHERE id = ?', [id])
    if (borrowings.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '借用记录不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const borrowing = borrowings[0]

    if (borrowing.user_id !== userId && !['dept_admin', 'admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '无权归还此资产',
        data: null,
        timestamp: Date.now()
      })
    }

    if (borrowing.status === 'returned') {
      return res.status(400).json({
        code: 400,
        message: '资产已归还',
        data: null,
        timestamp: Date.now()
      })
    }

    await query(
      "UPDATE borrowing_records SET status = 'returned', returned_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    )

    await query(
      'UPDATE assets SET available_quantity = available_quantity + ? WHERE id = ?',
      [borrowing.quantity, borrowing.asset_id]
    )

    res.success(null, '资产归还成功')
  } catch (error) {
    next(error)
  }
})

module.exports = router
