const express = require('express')
const { query, transaction } = require('../config/database')
const { authenticateToken } = require('../middleware/auth')
const { createPagination, checkTimeConflict, getStatusName, getApprovalStatusName, getCheckinStatusName, getRoomTypeName } = require('../utils/helper')

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

function needsApproval(roomType, attendeeCount, isCrossDepartment, settings) {
  const largeThreshold = parseInt(settings.large_meeting_threshold || 20)
  const approvalRequiredTypes = (settings.approval_required_room_types || 'large,training').split(',')
  
  if (isCrossDepartment) return true
  if (approvalRequiredTypes.includes(roomType)) return true
  if (attendeeCount >= largeThreshold) return true
  
  return false
}

router.post('/check', authenticateToken, async (req, res, next) => {
  try {
    const { room_id, date, start_time, end_time, exclude_id } = req.body

    if (!room_id || !date || !start_time || !end_time) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整的预约信息',
        data: null,
        timestamp: Date.now()
      })
    }

    const rooms = await query('SELECT * FROM meeting_rooms WHERE id = ? AND status = 1', [room_id])
    if (rooms.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '会议室不存在或不可用',
        data: null,
        timestamp: Date.now()
      })
    }

    const existingBookings = await query(
      'SELECT * FROM bookings WHERE room_id = ? AND date = ?',
      [room_id, date]
    )

    const conflictResult = checkTimeConflict(existingBookings, start_time, end_time, exclude_id)

    if (conflictResult.conflict) {
      const cb = conflictResult.conflictBooking
      return res.success({
        has_conflict: true,
        conflict_info: {
          booking_id: cb.id,
          title: cb.meeting_title,
          start_time: cb.start_time,
          end_time: cb.end_time,
          status: cb.status,
          status_name: getStatusName(cb.status)
        }
      }, '存在时间冲突')
    }

    res.success({ has_conflict: false }, '无时间冲突')
  } catch (error) {
    next(error)
  }
})

router.post('/check-violation', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const settings = await getSystemSettings()
    const maxViolations = parseInt(settings.max_violation_count || 3)

    const [userData] = await query('SELECT violation_count, last_violation_reset FROM users WHERE id = ?', [userId])
    
    let violationCount = userData[0].violation_count || 0
    const resetPeriod = parseInt(settings.violation_reset_period || 30)
    
    if (userData[0].last_violation_reset) {
      const lastReset = new Date(userData[0].last_violation_reset)
      const now = new Date()
      const daysSinceReset = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24))
      
      if (daysSinceReset >= resetPeriod) {
        await query('UPDATE users SET violation_count = 0, last_violation_reset = CURDATE() WHERE id = ?', [userId])
        violationCount = 0
      }
    }

    const isBlocked = violationCount >= maxViolations

    res.success({
      violation_count: violationCount,
      max_violations: maxViolations,
      is_blocked: isBlocked,
      remaining_violations: maxViolations - violationCount
    })
  } catch (error) {
    next(error)
  }
})

router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { room_id, meeting_title, meeting_description, attendee_count, date, start_time, end_time, assets, attendee_departments, is_cross_department } = req.body

    if (!room_id || !meeting_title || !date || !start_time || !end_time) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整的预约信息',
        data: null,
        timestamp: Date.now()
      })
    }

    if (start_time >= end_time) {
      return res.status(400).json({
        code: 400,
        message: '开始时间必须早于结束时间',
        data: null,
        timestamp: Date.now()
      })
    }

    const startTimeMin = parseInt(start_time.split(':')[0]) * 60 + parseInt(start_time.split(':')[1])
    const endTimeMin = parseInt(end_time.split(':')[0]) * 60 + parseInt(end_time.split(':')[1])
    if ((endTimeMin - startTimeMin) % 30 !== 0) {
      return res.status(400).json({
        code: 400,
        message: '预约时长必须是30分钟的整数倍',
        data: null,
        timestamp: Date.now()
      })
    }

    const rooms = await query('SELECT * FROM meeting_rooms WHERE id = ? AND status = 1', [room_id])
    if (rooms.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '会议室不存在或不可用',
        data: null,
        timestamp: Date.now()
      })
    }

    if (attendee_count && parseInt(attendee_count) > rooms[0].capacity) {
      return res.status(400).json({
        code: 400,
        message: `参会人数不能超过会议室容量(${rooms[0].capacity}人)`,
        data: null,
        timestamp: Date.now()
      })
    }

    const settings = await getSystemSettings()
    const maxViolations = parseInt(settings.max_violation_count || 3)
    const [userData] = await query('SELECT violation_count, last_violation_reset FROM users WHERE id = ?', [userId])
    let violationCount = userData[0].violation_count || 0
    
    if (violationCount >= maxViolations) {
      return res.status(400).json({
        code: 400,
        message: `您的爽约次数已达${maxViolations}次，暂时无法预约，请联系管理员`,
        data: { violation_count: violationCount, max_violations: maxViolations },
        timestamp: Date.now()
      })
    }

    const existingBookings = await query(
      'SELECT * FROM bookings WHERE room_id = ? AND date = ?',
      [room_id, date]
    )

    const conflictResult = checkTimeConflict(existingBookings, start_time, end_time)
    if (conflictResult.conflict) {
      return res.status(400).json({
        code: 400,
        message: '该时间段已被预约，请选择其他时间',
        data: { conflict: conflictResult.conflictBooking },
        timestamp: Date.now()
      })
    }

    if (assets && assets.length > 0) {
      for (const assetItem of assets) {
        const asset = await query('SELECT * FROM assets WHERE id = ? AND status = 1', [assetItem.asset_id])
        if (asset.length === 0) {
          return res.status(400).json({
            code: 400,
            message: `资产ID ${assetItem.asset_id} 不存在或不可用`,
            data: null,
            timestamp: Date.now()
          })
        }
        if (asset[0].available_quantity < assetItem.quantity) {
          return res.status(400).json({
            code: 400,
            message: `资产 ${asset[0].name} 库存不足，当前可用: ${asset[0].available_quantity}`,
            data: null,
            timestamp: Date.now()
          })
        }
      }
    }

    const crossDept = is_cross_department ? 1 : 0
    const attendeeCount = attendee_count || 0
    const requiresApproval = needsApproval(rooms[0].room_type, attendeeCount, crossDept, settings)

    let initialStatus, approvalStatus, approvalStep
    if (requiresApproval) {
      initialStatus = 'pending_approval'
      approvalStatus = 'pending_dept'
      approvalStep = 1
    } else {
      initialStatus = 'approved'
      approvalStatus = 'auto_approved'
      approvalStep = 0
    }

    const returnDays = parseInt(settings.asset_return_days || 3)
    const expectedReturnDate = new Date(date)
    expectedReturnDate.setDate(expectedReturnDate.getDate() + returnDays)
    const expectedReturnDateStr = expectedReturnDate.toISOString().split('T')[0]

    const result = await transaction(async (conn) => {
      const [bookingResult] = await conn.execute(
        `INSERT INTO bookings (user_id, room_id, meeting_title, meeting_description, attendee_count, attendee_departments, is_cross_department, date, start_time, end_time, status, approval_status, current_approval_step, checkin_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, room_id, meeting_title, meeting_description || '', attendeeCount, attendee_departments ? JSON.stringify(attendee_departments) : null, crossDept, date, start_time, end_time, initialStatus, approvalStatus, approvalStep]
      )

      const bookingId = bookingResult.insertId

      if (assets && assets.length > 0) {
        for (const assetItem of assets) {
          await conn.execute(
            'INSERT INTO borrowing_records (booking_id, user_id, asset_id, quantity, status, expected_return_date) VALUES (?, ?, ?, ?, ?, ?)',
            [bookingId, userId, assetItem.asset_id, assetItem.quantity, 'borrowed', expectedReturnDateStr]
          )
          await conn.execute(
            'UPDATE assets SET available_quantity = available_quantity - ? WHERE id = ?',
            [assetItem.quantity, assetItem.asset_id]
          )
          await conn.execute(
            'INSERT INTO asset_usage_logs (asset_id, user_id, booking_id, action, quantity, remark) VALUES (?, ?, ?, ?, ?, ?)',
            [assetItem.asset_id, userId, bookingId, 'borrow', assetItem.quantity, `预约「${meeting_title}」借用`]
          )
        }
      }

      if (requiresApproval) {
        const deptAdmins = await conn.execute(
          "SELECT id FROM users WHERE role = 'dept_admin' AND department_id = (SELECT department_id FROM users WHERE id = ?) AND status = 1",
          [userId]
        )
        for (const admin of deptAdmins[0]) {
          await createNotification(
            admin.id,
            'approval',
            '新的预约待审批',
            `预约「${meeting_title}」待您审批。`,
            bookingId
          )
        }
      }

      return { 
        booking_id: bookingId,
        requires_approval: requiresApproval,
        approval_status: approvalStatus
      }
    })

    res.success(result, requiresApproval ? '预约已提交，等待审批' : '预约创建成功')
  } catch (error) {
    next(error)
  }
})

router.get('/my', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { page, pageSize, status, date_from, date_to, approval_status } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = ['b.user_id = ?']
    let params = [userId]

    if (status) {
      whereClauses.push('b.status = ?')
      params.push(status)
    }
    if (approval_status) {
      whereClauses.push('b.approval_status = ?')
      params.push(approval_status)
    }
    if (date_from) {
      whereClauses.push('b.date >= ?')
      params.push(date_from)
    }
    if (date_to) {
      whereClauses.push('b.date <= ?')
      params.push(date_to)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const bookings = await query(
      `SELECT b.*, r.name as room_name, r.location as room_location, r.image_url as room_image, r.room_type
       FROM bookings b
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       ${whereSql}
       ORDER BY b.date DESC, b.start_time DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM bookings b ${whereSql}`,
      params
    )

    const list = bookings.map(b => ({
      ...b,
      status_name: getStatusName(b.status),
      approval_status_name: getApprovalStatusName(b.approval_status),
      checkin_status_name: getCheckinStatusName(b.checkin_status),
      room_type_name: getRoomTypeName(b.room_type)
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

router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const userRole = req.user.role

    const bookings = await query(
      `SELECT b.*, r.name as room_name, r.location as room_location, r.capacity as room_capacity,
              r.facilities as room_facilities, r.image_url as room_image, r.room_type,
              u.real_name as user_name, u.username, d.name as department_name, d.id as department_id
       FROM bookings b
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE b.id = ?`,
      [id]
    )

    if (bookings.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '预约不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const booking = bookings[0]

    if (booking.user_id !== userId && !['dept_admin', 'admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '无权查看此预约详情',
        data: null,
        timestamp: Date.now()
      })
    }

    const borrowings = await query(
      `SELECT br.*, a.name as asset_name, a.category as asset_category
       FROM borrowing_records br
       LEFT JOIN assets a ON br.asset_id = a.id
       WHERE br.booking_id = ?`,
      [id]
    )

    const approvalRecords = await query(
      `SELECT ar.*, u.real_name as approver_name, u.role as approver_role
       FROM approval_records ar
       LEFT JOIN users u ON ar.approver_id = u.id
       WHERE ar.booking_id = ?
       ORDER BY ar.step ASC, ar.created_at ASC`,
      [id]
    )

    const checkinRecords = await query(
      `SELECT cr.*, u.real_name as user_name
       FROM checkin_records cr
       LEFT JOIN users u ON cr.user_id = u.id
       WHERE cr.booking_id = ?
       ORDER BY cr.checkin_time DESC`,
      [id]
    )

    res.success({
      ...booking,
      status_name: getStatusName(booking.status),
      approval_status_name: getApprovalStatusName(booking.approval_status),
      checkin_status_name: getCheckinStatusName(booking.checkin_status),
      room_type_name: getRoomTypeName(booking.room_type),
      borrowings,
      approval_records: approvalRecords,
      checkin_records: checkinRecords
    })
  } catch (error) {
    next(error)
  }
})

router.put('/:id/cancel', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const userRole = req.user.role

    const bookings = await query('SELECT * FROM bookings WHERE id = ?', [id])
    if (bookings.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '预约不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const booking = bookings[0]

    if (booking.user_id !== userId && !['dept_admin', 'admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '无权取消此预约',
        data: null,
        timestamp: Date.now()
      })
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        code: 400,
        message: '预约已取消',
        data: null,
        timestamp: Date.now()
      })
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        code: 400,
        message: '已完成的预约无法取消',
        data: null,
        timestamp: Date.now()
      })
    }

    await transaction(async (conn) => {
      await conn.execute(
        "UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id]
      )

      const borrowings = await conn.execute(
        "SELECT * FROM borrowing_records WHERE booking_id = ? AND status = 'borrowed'",
        [id]
      )

      for (const br of borrowings[0]) {
        await conn.execute(
          "UPDATE borrowing_records SET status = 'returned', returned_at = CURRENT_TIMESTAMP WHERE id = ?",
          [br.id]
        )
        await conn.execute(
          'UPDATE assets SET available_quantity = available_quantity + ? WHERE id = ?',
          [br.quantity, br.asset_id]
        )
      }
    })

    res.success(null, '预约取消成功')
  } catch (error) {
    next(error)
  }
})

module.exports = router
