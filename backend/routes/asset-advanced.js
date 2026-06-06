const express = require('express')
const { query, transaction } = require('../config/database')
const { authenticateToken, requireDeptAdminOrHigher, requireAdminOrHigher } = require('../middleware/auth')
const { createPagination, getRepairStatusName, getFaultLevelName, getAssetCategoryName, getBorrowStatusName } = require('../utils/helper')

const router = express.Router()

router.get('/repairs', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const userRole = req.user.role
    const { page, pageSize, status, asset_id } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = []
    let params = []

    if (!['dept_admin', 'admin', 'super_admin'].includes(userRole)) {
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
              u.real_name as reporter_name,
              ru.real_name as repaired_by_name
       FROM asset_repairs ar
       LEFT JOIN assets a ON ar.asset_id = a.id
       LEFT JOIN users u ON ar.reporter_id = u.id
       LEFT JOIN users ru ON ar.repaired_by = ru.id
       ${whereSql}
       ORDER BY ar.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const list = repairs.map(r => ({
      ...r,
      status_name: getRepairStatusName(r.status),
      fault_level_name: getFaultLevelName(r.fault_level),
      asset_category_name: getAssetCategoryName(r.asset_category)
    }))

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM asset_repairs ar ${whereSql}`,
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

router.post('/repairs', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { asset_id, title, description, fault_level } = req.body

    if (!asset_id || !title) {
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

    const [result] = await query(
      `INSERT INTO asset_repairs (asset_id, reporter_id, title, description, fault_level, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [asset_id, userId, title, description || '', fault_level || 'minor', 'pending']
    )

    await query(
      'INSERT INTO asset_usage_logs (asset_id, user_id, action, quantity, remark) VALUES (?, ?, ?, ?, ?)',
      [asset_id, userId, 'repair', 1, `报修: ${title}`]
    )

    const admins = await query(
      "SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND status = 1"
    )
    for (const admin of admins) {
      await query(
        'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)',
        [admin.id, 'asset', '新的资产报修', 
         `资产「${assets[0].name}」有新的报修：${title}`,
         result.insertId]
      )
    }

    res.success({ id: result.insertId }, '报修提交成功')
  } catch (error) {
    next(error)
  }
})

router.put('/repairs/:id', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { status, repair_note } = req.body

    const repairs = await query('SELECT * FROM asset_repairs WHERE id = ?', [id])
    if (repairs.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '报修记录不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const repair = repairs[0]

    if (!['pending', 'repairing', 'resolved', 'cancelled'].includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '无效的状态值',
        data: null,
        timestamp: Date.now()
      })
    }

    const updates = []
    const values = []

    updates.push('status = ?')
    values.push(status)

    if (repair_note !== undefined) {
      updates.push('repair_note = ?')
      values.push(repair_note)
    }

    if (status === 'resolved' || status === 'repairing') {
      updates.push('repaired_by = ?')
      values.push(userId)
      if (status === 'resolved') {
        updates.push('repaired_at = CURRENT_TIMESTAMP')
      }
    }

    values.push(id)

    await transaction(async (conn) => {
      await conn.execute(
        `UPDATE asset_repairs SET ${updates.join(', ')} WHERE id = ?`,
        values
      )

      if (status === 'resolved') {
        const [faultCount] = await conn.execute(
          "SELECT COUNT(*) as count FROM asset_repairs WHERE asset_id = ? AND status = 'pending' OR status = 'repairing'",
          [repair.asset_id]
        )
        if (faultCount[0].count === 0) {
          const asset = await conn.execute('SELECT * FROM assets WHERE id = ?', [repair.asset_id])
          if (asset[0].length > 0 && asset[0][0].fault_quantity > 0) {
            await conn.execute(
              'UPDATE assets SET fault_quantity = GREATEST(0, fault_quantity - 1) WHERE id = ?',
              [repair.asset_id]
            )
          }
        }
      }

      if (status === 'pending' || status === 'repairing') {
        const asset = await conn.execute('SELECT * FROM assets WHERE id = ?', [repair.asset_id])
        if (asset[0].length > 0) {
          const currentFault = asset[0][0].fault_quantity || 0
          const totalQty = asset[0][0].total_quantity || 0
          if (currentFault < totalQty) {
            await conn.execute(
              'UPDATE assets SET fault_quantity = fault_quantity + 1 WHERE id = ?',
              [repair.asset_id]
            )
          }
        }
      }

      const statusText = getRepairStatusName(status)
      await conn.execute(
        'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)',
        [repair.reporter_id, 'asset', '报修状态更新', 
         `您的报修「${repair.title}」状态已更新为：${statusText}`,
         id]
      )
    })

    res.success(null, '状态更新成功')
  } catch (error) {
    next(error)
  }
})

router.get('/usage-logs/:assetId', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { assetId } = req.params
    const { page, pageSize, action } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = ['aul.asset_id = ?']
    let params = [assetId]

    if (action) {
      whereClauses.push('aul.action = ?')
      params.push(action)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const logs = await query(
      `SELECT aul.*, a.name as asset_name, u.real_name as user_name, b.meeting_title
       FROM asset_usage_logs aul
       LEFT JOIN assets a ON aul.asset_id = a.id
       LEFT JOIN users u ON aul.user_id = u.id
       LEFT JOIN bookings b ON aul.booking_id = b.id
       ${whereSql}
       ORDER BY aul.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM asset_usage_logs aul ${whereSql}`,
      params
    )

    const actionStats = await query(
      `SELECT action, COUNT(*) as count 
       FROM asset_usage_logs 
       WHERE asset_id = ?
       GROUP BY action`,
      [assetId]
    )

    res.success({
      list: logs,
      total: countResult.total,
      page: parseInt(page) || 1,
      page_size: parseInt(pageSize) || 10,
      action_stats: actionStats
    })
  } catch (error) {
    next(error)
  }
})

router.get('/overdue', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { page, pageSize, keyword, reminder_status } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = ["br.status = 'overdue'"]
    let params = []

    if (keyword) {
      whereClauses.push('(a.name LIKE ? OR u.real_name LIKE ?)')
      const keywordPattern = `%${keyword}%`
      params.push(keywordPattern, keywordPattern)
    }

    if (reminder_status !== '' && reminder_status !== undefined) {
      whereClauses.push('br.reminder_sent = ?')
      params.push(parseInt(reminder_status))
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const overdueRecords = await query(
      `SELECT br.*, a.name as asset_name, a.category as asset_category,
              u.real_name as borrower_name, u.username, d.name as borrower_department,
              b.meeting_title, b.date, b.start_time
       FROM borrowing_records br
       LEFT JOIN assets a ON br.asset_id = a.id
       LEFT JOIN users u ON br.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN bookings b ON br.booking_id = b.id
       ${whereSql}
       ORDER BY br.borrowed_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const list = overdueRecords.map(br => {
      const expectedDate = br.expected_return_date ? new Date(br.expected_return_date) : null
      const now = new Date()
      const overdueDays = expectedDate ? Math.ceil((now - expectedDate) / (1000 * 60 * 60 * 24)) : 0
      return {
        ...br,
        borrow_time: br.borrowed_at,
        expected_return_time: br.expected_return_date,
        reminder_status: br.reminder_sent,
        reminder_count: br.reminder_sent ? 1 : 0,
        status_name: getBorrowStatusName(br.status),
        asset_category_name: getAssetCategoryName(br.asset_category),
        overdue_days: overdueDays
      }
    })

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM borrowing_records br 
       LEFT JOIN assets a ON br.asset_id = a.id
       LEFT JOIN users u ON br.user_id = u.id
       ${whereSql}`,
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

router.post('/send-reminder/:borrowId', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { borrowId } = req.params

    const borrowings = await query(
      `SELECT br.*, a.name as asset_name, u.real_name as user_name, u.id as user_id
       FROM borrowing_records br
       LEFT JOIN assets a ON br.asset_id = a.id
       LEFT JOIN users u ON br.user_id = u.id
       WHERE br.id = ?`,
      [borrowId]
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

    if (br.status === 'returned') {
      return res.status(400).json({
        code: 400,
        message: '该资产已归还',
        data: null,
        timestamp: Date.now()
      })
    }

    const expectedDate = br.expected_return_date || '尽快'
    await query(
      'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)',
      [br.user_id, 'asset', '资产归还提醒', 
       `请尽快归还资产「${br.asset_name}」，预计归还日期：${expectedDate}`,
       borrowId]
    )

    await query(
      'UPDATE borrowing_records SET reminder_sent = 1 WHERE id = ?',
      [borrowId]
    )

    res.success(null, '提醒已发送')
  } catch (error) {
    next(error)
  }
})

router.post('/process-overdue', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    const overdueRecords = await query(
      `SELECT br.*, a.name as asset_name, u.real_name as user_name
       FROM borrowing_records br
       LEFT JOIN assets a ON br.asset_id = a.id
       LEFT JOIN users u ON br.user_id = u.id
       WHERE br.status = 'borrowed' 
         AND br.expected_return_date IS NOT NULL 
         AND br.expected_return_date < ?`,
      [today]
    )

    let processedCount = 0

    for (const br of overdueRecords) {
      await transaction(async (conn) => {
        await conn.execute(
          "UPDATE borrowing_records SET status = 'overdue' WHERE id = ?",
          [br.id]
        )

        await conn.execute(
          'INSERT INTO user_violations (user_id, type, borrowing_id, description) VALUES (?, ?, ?, ?)',
          [br.user_id, 'late_return', br.id, 
           `资产「${br.asset_name}」逾期未归还，预计归还日期：${br.expected_return_date}`]
        )

        const [violationCount] = await conn.execute(
          "SELECT COUNT(*) as count FROM user_violations WHERE user_id = ? AND type = 'late_return' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
          [br.user_id]
        )

        const [rule] = await conn.execute(
          "SELECT * FROM exception_rules WHERE rule_type = 'late_return' AND is_enabled = 1 ORDER BY threshold DESC LIMIT 1"
        )

        let notificationContent = `您借用的资产「${br.asset_name}」已逾期未归还，请尽快归还。`
        
        if (rule[0].length > 0 && violationCount[0].count >= rule[0][0].threshold) {
          const penaltyText = rule[0][0].penalty_action === 'restrict_assets' 
            ? `将被限制借用资产${rule[0][0].penalty_duration}天`
            : '将收到警告'
          notificationContent += ` 您在30天内已逾期${violationCount[0].count}次，根据规则${penaltyText}。`
        }

        await conn.execute(
          'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)',
          [br.user_id, 'violation', '资产逾期提醒', notificationContent, br.id]
        )

        processedCount++
      })
    }

    res.success({ processed_count: processedCount }, `已处理 ${processedCount} 条逾期记录`)
  } catch (error) {
    next(error)
  }
})

module.exports = router
