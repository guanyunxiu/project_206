const express = require('express')
const { query, transaction } = require('../config/database')
const { authenticateToken } = require('../middleware/auth')
const { createPagination, checkTimeConflict, getStatusName, getApprovalStatusName, getMeetingTypeName } = require('../utils/helper')

const router = express.Router()

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

router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { room_id, meeting_title, meeting_description, attendee_count, date, start_time, end_time, is_cross_department, meeting_type, assets, expected_return_date } = req.body

    if (!room_id || !meeting_title || !date || !start_time || !end_time) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整的预约信息',
        data: null,
        timestamp: Date.now()
      })
    }

    const [violationCheck] = await query(
      "SELECT COUNT(*) as count FROM user_violations uv " +
      "INNER JOIN exception_rules er ON er.rule_type = 'missed_meeting' AND er.is_enabled = 1 " +
      "WHERE uv.user_id = ? AND uv.type = 'missed' " +
      "AND uv.created_at >= DATE_SUB(NOW(), INTERVAL er.time_window DAY) " +
      "GROUP BY uv.user_id, er.threshold " +
      "HAVING COUNT(*) >= er.threshold " +
      "LIMIT 1",
      [userId]
    )
    if (violationCheck) {
      return res.status(400).json({
        code: 400,
        message: '您近期爽约次数过多，暂时无法预约，请联系管理员',
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

    const newIsCross = is_cross_department ? 1 : 0
    const newMeetingType = meeting_type || 'normal'

    const isLargeMeeting = rooms[0].capacity >= 20 && (attendee_count || 0) >= 10
    const finalMeetingType = isLargeMeeting ? 'large' : newMeetingType
    const needApproval = finalMeetingType === 'large' || newIsCross

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

    const result = await transaction(async (conn) => {
      let approvalStatus = 'auto_approved'
      let currentApproverId = null
      let checkinCode = null

      if (needApproval) {
        approvalStatus = 'pending_dept'
        const userDept = await conn.execute(
          'SELECT department_id FROM users WHERE id = ?',
          [userId]
        )
        if (userDept[0].length > 0 && userDept[0][0].department_id) {
          const deptAdmins = await conn.execute(
            "SELECT id FROM users WHERE department_id = ? AND role = 'dept_admin' AND status = 1 LIMIT 1",
            [userDept[0][0].department_id]
          )
          if (deptAdmins[0].length > 0) {
            currentApproverId = deptAdmins[0][0].id
          }
        }
      } else {
        checkinCode = `CHECKIN-${Date.now().toString(36).toUpperCase()}`
      }

      const [bookingResult] = await conn.execute(
        `INSERT INTO bookings (user_id, room_id, meeting_title, meeting_description, attendee_count, date, start_time, end_time, is_cross_department, meeting_type, approval_status, current_approver_id, checkin_code, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, room_id, meeting_title, meeting_description || '', attendee_count || 0, date, start_time, end_time, newIsCross, finalMeetingType, approvalStatus, currentApproverId, checkinCode]
      )

      const bookingId = bookingResult.insertId

      if (assets && assets.length > 0) {
        for (const assetItem of assets) {
          await conn.execute(
            'INSERT INTO borrowing_records (booking_id, user_id, asset_id, quantity, expected_return_date, status) VALUES (?, ?, ?, ?, ?, ?)',
            [bookingId, userId, assetItem.asset_id, assetItem.quantity, expected_return_date || null, 'borrowed']
          )
          await conn.execute(
            'UPDATE assets SET available_quantity = available_quantity - ? WHERE id = ?',
            [assetItem.quantity, assetItem.asset_id]
          )
          await conn.execute(
            'INSERT INTO asset_usage_logs (asset_id, user_id, booking_id, action, quantity, remark) VALUES (?, ?, ?, ?, ?, ?)',
            [assetItem.asset_id, userId, bookingId, 'borrow', assetItem.quantity, '预约借用']
          )
        }
      }

      if (approvalStatus === 'pending_dept' && currentApproverId) {
        await conn.execute(
          'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)',
          [currentApproverId, 'approval', '新的预约待审批', 
           `有新的预约「${meeting_title}」等待您审批`,
           bookingId]
        )
      }

      return { 
        booking_id: bookingId,
        approval_status: approvalStatus,
        need_approval: needApproval
      }
    })

    const message = result.need_approval ? '预约已提交，等待审批' : '预约创建成功'
    res.success(result, message)
  } catch (error) {
    next(error)
  }
})

router.get('/my', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { page, pageSize, status, date_from, date_to } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = ['b.user_id = ?']
    let params = [userId]

    if (status) {
      whereClauses.push('b.status = ?')
      params.push(status)
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
      `SELECT b.*, r.name as room_name, r.location as room_location, r.image_url as room_image
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
      meeting_type_name: getMeetingTypeName(b.meeting_type)
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
              r.facilities as room_facilities, r.image_url as room_image,
              u.real_name as user_name, u.username, d.name as department_name
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
      `SELECT ar.*, u.real_name as approver_name
       FROM approval_records ar
       LEFT JOIN users u ON ar.approver_id = u.id
       WHERE ar.booking_id = ?
       ORDER BY ar.created_at DESC`,
      [id]
    )

    const checkinRecords = await query(
      `SELECT cr.*, u.real_name as user_name, u.avatar
       FROM checkin_records cr
       LEFT JOIN users u ON cr.user_id = u.id
       WHERE cr.booking_id = ?
       ORDER BY cr.checkin_time ASC`,
      [id]
    )

    res.success({
      ...booking,
      status_name: getStatusName(booking.status),
      approval_status_name: getApprovalStatusName(booking.approval_status),
      meeting_type_name: getMeetingTypeName(booking.meeting_type),
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
