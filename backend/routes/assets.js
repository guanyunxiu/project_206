const express = require('express')
const { query, transaction } = require('../config/database')
const { authenticateToken } = require('../middleware/auth')
const { createPagination, getBorrowStatusName, getAssetCategoryName, getRepairStatusName, getAssetActionName } = require('../utils/helper')

const router = express.Router()

async function getSystemSettings() {
  const settings = await query('SELECT setting_key, setting_value FROM system_settings')
  const result = {}
  settings.forEach(s => {
    result[s.setting_key] = s.setting_value
  })
  return result
}

async function createNotification(userId, type, title, content, relatedId = null) {
  await query(
    'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)',
    [userId, type, title, content, relatedId]
  )
}

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
    if (status !== undefined && status !== '') {
      whereClauses.push('status = ?')
      params.push(parseInt(status))
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const assets = await query(
      `SELECT * FROM assets ${whereSql} ORDER BY id ASC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
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
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
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

router.post('/repair', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { asset_id, quantity, description } = req.body

    if (!asset_id || !quantity || !description) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整的报修信息',
        data: null,
        timestamp: Date.now()
      })
    }

    const assets = await query('SELECT * FROM assets WHERE id = ?', [asset_id])
    if (assets.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '资产不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const asset = assets[0]
    const qty = parseInt(quantity)

    if (asset.available_quantity < qty) {
      return res.status(400).json({
        code: 400,
        message: `可用资产不足，当前可用: ${asset.available_quantity}`,
        data: null,
        timestamp: Date.now()
      })
    }

    const result = await transaction(async (conn) => {
      const [repairResult] = await conn.execute(
        'INSERT INTO asset_repairs (asset_id, reporter_id, quantity, description, status) VALUES (?, ?, ?, ?, ?)',
        [asset_id, userId, qty, description, 'pending']
      )

      await conn.execute(
        'UPDATE assets SET available_quantity = available_quantity - ?, fault_quantity = fault_quantity + ? WHERE id = ?',
        [qty, qty, asset_id]
      )

      await conn.execute(
        'INSERT INTO asset_usage_logs (asset_id, user_id, action, quantity, remark) VALUES (?, ?, ?, ?, ?)',
        [asset_id, userId, 'repair', qty, description]
      )

      const admins = await conn.execute(
        "SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND status = 1"
      )
      for (const admin of admins[0]) {
        await createNotification(
          admin.id,
          'asset',
          '新的资产报修申请',
          `资产「${asset.name}」有${qty}件需要维修，请及时处理。`,
          repairResult.insertId
        )
      }

      return { repair_id: repairResult.insertId }
    })

    res.success(result, '报修申请已提交')
  } catch (error) {
    next(error)
  }
})

router.get('/repairs', authenticateToken, async (req, res, next) => {
  try {
    const userRole = req.user.role
    const userId = req.user.id
    const { page, pageSize, status, asset_id } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = []
    let params = []

    if (!['admin', 'super_admin'].includes(userRole)) {
      whereClauses.push('ar.reporter_id = ?')
      params.push(userId)
    }

    if (status) {
      whereClauses.push('ar.status = ?')
      params.push(status)
    }
    if (asset_id) {
      whereClauses.push('ar.asset_id = ?')
      params.push(parseInt(asset_id))
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const repairs = await query(
      `SELECT ar.*, a.name as asset_name, a.category as asset_category,
              u.real_name as reporter_name, u.username
       FROM asset_repairs ar
       LEFT JOIN assets a ON ar.asset_id = a.id
       LEFT JOIN users u ON ar.reporter_id = u.id
       ${whereSql}
       ORDER BY ar.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM asset_repairs ar ${whereSql}`,
      params
    )

    const list = repairs.map(r => ({
      ...r,
      status_name: getRepairStatusName(r.status),
      category_name: getAssetCategoryName(r.asset_category)
    }))

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

router.put('/repair/:id/process', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const userRole = req.user.role
    const { status, repair_note } = req.body

    if (!['admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '只有管理员可以处理报修',
        data: null,
        timestamp: Date.now()
      })
    }

    if (!status) {
      return res.status(400).json({
        code: 400,
        message: '请提供处理状态',
        data: null,
        timestamp: Date.now()
      })
    }

    const repairs = await query(
      `SELECT ar.*, a.name as asset_name
       FROM asset_repairs ar
       LEFT JOIN assets a ON ar.asset_id = a.id
       WHERE ar.id = ?`,
      [id]
    )

    if (repairs.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '报修记录不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const repair = repairs[0]

    if (['completed', 'cancelled'].includes(repair.status)) {
      return res.status(400).json({
        code: 400,
        message: '该报修已处理完成',
        data: null,
        timestamp: Date.now()
      })
    }

    await transaction(async (conn) => {
      const updates = []
      const values = []

      if (status) {
        updates.push('status = ?')
        values.push(status)
      }
      if (repair_note) {
        updates.push('repair_note = ?')
        values.push(repair_note)
      }
      if (status === 'completed') {
        updates.push('repaired_at = CURRENT_TIMESTAMP')
      }
      updates.push('updated_at = CURRENT_TIMESTAMP')

      values.push(id)
      await conn.execute(`UPDATE asset_repairs SET ${updates.join(', ')} WHERE id = ?`, values)

      if (status === 'completed') {
        await conn.execute(
          'UPDATE assets SET available_quantity = available_quantity + ?, fault_quantity = fault_quantity - ? WHERE id = ?',
          [repair.quantity, repair.quantity, repair.asset_id]
        )
        await conn.execute(
          'INSERT INTO asset_usage_logs (asset_id, user_id, action, quantity, remark) VALUES (?, ?, ?, ?, ?)',
          [repair.asset_id, userId, 'repair_complete', repair.quantity, repair_note || '维修完成']
        )
      } else if (status === 'cancelled') {
        await conn.execute(
          'UPDATE assets SET available_quantity = available_quantity + ?, fault_quantity = fault_quantity - ? WHERE id = ?',
          [repair.quantity, repair.quantity, repair.asset_id]
        )
      }

      let notificationContent = ''
      if (status === 'repairing') {
        notificationContent = `您报修的资产「${repair.asset_name}」正在维修中。`
      } else if (status === 'completed') {
        notificationContent = `您报修的资产「${repair.asset_name}」已维修完成。`
      } else if (status === 'cancelled') {
        notificationContent = `您报修的资产「${repair.asset_name}」已取消。`
      }

      if (notificationContent) {
        await createNotification(
          repair.reporter_id,
          'asset',
          '报修状态更新',
          notificationContent,
          id
        )
      }
    })

    res.success(null, '报修处理成功')
  } catch (error) {
    next(error)
  }
})

router.get('/usage-logs/:assetId', authenticateToken, async (req, res, next) => {
  try {
    const { assetId } = req.params
    const userRole = req.user.role
    const { page, pageSize, action } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    if (!['admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '只有管理员可以查看资产使用日志',
        data: null,
        timestamp: Date.now()
      })
    }

    let whereClauses = ['l.asset_id = ?']
    let params = [parseInt(assetId)]

    if (action) {
      whereClauses.push('l.action = ?')
      params.push(action)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const logs = await query(
      `SELECT l.*, a.name as asset_name, u.real_name as user_name, u.username,
              b.meeting_title
       FROM asset_usage_logs l
       LEFT JOIN assets a ON l.asset_id = a.id
       LEFT JOIN users u ON l.user_id = u.id
       LEFT JOIN bookings b ON l.booking_id = b.id
       ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM asset_usage_logs l ${whereSql}`,
      params
    )

    const list = logs.map(l => ({
      ...l,
      action_name: getAssetActionName(l.action)
    }))

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

router.get('/overdue', authenticateToken, async (req, res, next) => {
  try {
    const userRole = req.user.role
    const userId = req.user.id
    const { page, pageSize } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = [
      "br.status = 'borrowed'",
      'br.expected_return_date < CURDATE()'
    ]
    let params = []

    if (!['admin', 'super_admin'].includes(userRole)) {
      whereClauses.push('br.user_id = ?')
      params.push(userId)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const overdue = await query(
      `SELECT br.*, a.name as asset_name, a.category as asset_category,
              u.real_name as user_name, u.username, u.phone, u.email,
              b.meeting_title, b.date, r.name as room_name
       FROM borrowing_records br
       LEFT JOIN assets a ON br.asset_id = a.id
       LEFT JOIN users u ON br.user_id = u.id
       LEFT JOIN bookings b ON br.booking_id = b.id
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       ${whereSql}
       ORDER BY br.expected_return_date ASC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM borrowing_records br ${whereSql}`,
      params
    )

    const list = overdue.map(br => {
      const expected = new Date(br.expected_return_date)
      const now = new Date()
      const overdueDays = Math.floor((now - expected) / (1000 * 60 * 60 * 24))

      return {
        ...br,
        status_name: getBorrowStatusName('overdue'),
        category_name: getAssetCategoryName(br.asset_category),
        overdue_days: overdueDays
      }
    })

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

router.post('/remind-overdue', authenticateToken, async (req, res, next) => {
  try {
    const userRole = req.user.role
    const { borrowing_id } = req.body

    if (!['admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '只有管理员可以发送催还通知',
        data: null,
        timestamp: Date.now()
      })
    }

    if (!borrowing_id) {
      return res.status(400).json({
        code: 400,
        message: '请提供借用记录ID',
        data: null,
        timestamp: Date.now()
      })
    }

    const borrowings = await query(
      `SELECT br.*, a.name as asset_name, u.real_name as user_name
       FROM borrowing_records br
       LEFT JOIN assets a ON br.asset_id = a.id
       LEFT JOIN users u ON br.user_id = u.id
       WHERE br.id = ?`,
      [borrowing_id]
    )

    if (borrowings.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '借用记录不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const br = borrowings[0]

    if (br.status !== 'borrowed') {
      return res.status(400).json({
        code: 400,
        message: '该借用已归还',
        data: null,
        timestamp: Date.now()
      })
    }

    const expected = new Date(br.expected_return_date)
    const now = new Date()
    const overdueDays = Math.floor((now - expected) / (1000 * 60 * 60 * 24))

    await createNotification(
      br.user_id,
      'asset',
      '资产逾期提醒',
      `您借用的资产「${br.asset_name}」已逾期${overdueDays}天，请尽快归还。`,
      br.id
    )

    res.success(null, '催还通知已发送')
  } catch (error) {
    next(error)
  }
})

router.get('/reminders/my', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { page, pageSize } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    const settings = await getSystemSettings()
    const reminderDays = parseInt(settings.overdue_reminder_days || 1)

    const reminders = await query(
      `SELECT n.* FROM notifications n
       WHERE n.user_id = ?
       AND n.is_read = 0
       ORDER BY n.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      [userId]
    )

    const [countResult] = await query(
      'SELECT COUNT(*) as total FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    )

    const [unreadCount] = await query(
      'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    )

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const returnReminders = await query(
      `SELECT br.*, a.name as asset_name, br.expected_return_date
       FROM borrowing_records br
       LEFT JOIN assets a ON br.asset_id = a.id
       WHERE br.user_id = ? 
       AND br.status = 'borrowed'
       AND DATEDIFF(br.expected_return_date, ?) <= ?
       AND DATEDIFF(br.expected_return_date, ?) >= 0
       ORDER BY br.expected_return_date ASC`,
      [userId, todayStr, reminderDays, todayStr]
    )

    res.success({
      notifications: reminders,
      return_reminders: returnReminders,
      unread_count: unreadCount[0].unread,
      total: countResult.total,
      page: parseInt(page) || 1,
      page_size: parseInt(pageSize) || 10
    })
  } catch (error) {
    next(error)
  }
})

router.put('/notification/:id/read', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const notifications = await query('SELECT * FROM notifications WHERE id = ?', [id])
    if (notifications.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '通知不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    if (notifications[0].user_id !== userId) {
      return res.status(403).json({
        code: 403,
        message: '无权操作此通知',
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

router.put('/notifications/read-all', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id

    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId])

    res.success(null, '已全部标记为已读')
  } catch (error) {
    next(error)
  }
})

router.post('/auto-check-overdue', authenticateToken, async (req, res, next) => {
  try {
    const userRole = req.user.role

    if (!['admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '只有管理员可以执行此操作',
        data: null,
        timestamp: Date.now()
      })
    }

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    const overdue = await query(
      `SELECT br.*, a.name as asset_name, u.real_name as user_name
       FROM borrowing_records br
       LEFT JOIN assets a ON br.asset_id = a.id
       LEFT JOIN users u ON br.user_id = u.id
       WHERE br.status = 'borrowed' 
       AND br.expected_return_date < ?`,
      [todayStr]
    )

    let updatedCount = 0
    for (const br of overdue) {
      if (br.status !== 'overdue') {
        await query(
          "UPDATE borrowing_records SET status = 'overdue' WHERE id = ?",
          [br.id]
        )
        updatedCount++

        await createNotification(
          br.user_id,
          'asset',
          '资产逾期提醒',
          `您借用的资产「${br.asset_name}」已逾期，请尽快归还。`,
          br.id
        )
      }
    }

    res.success({
      updated_count: updatedCount,
      total_overdue: overdue.length
    }, `已更新${updatedCount}条逾期记录`)
  } catch (error) {
    next(error)
  }
})

module.exports = router
