const express = require('express')
const { query, transaction } = require('../config/database')
const { authenticateToken, requireDeptAdminOrHigher, requireAdminOrHigher } = require('../middleware/auth')
const { createPagination, getApprovalStatusName, getStatusName, getMeetingTypeName } = require('../utils/helper')

const router = express.Router()

function generateCheckinCode(bookingId) {
  return `CHECKIN-${bookingId}-${Date.now().toString(36).toUpperCase()}`
}

router.get('/pending', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const userId = req.user.id
    const userRole = req.user.role
    const { page, pageSize } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = []
    let params = []

    if (userRole === 'dept_admin') {
      whereClauses.push('b.approval_status = ?')
      params.push('pending_dept')
      const userDept = await query('SELECT department_id FROM users WHERE id = ?', [userId])
      if (userDept.length > 0 && userDept[0].department_id) {
        whereClauses.push('u.department_id = ?')
        params.push(userDept[0].department_id)
      }
    } else if (['admin', 'super_admin'].includes(userRole)) {
      whereClauses.push('b.approval_status = ?')
      params.push('pending_admin')
    } else {
      return res.status(403).json({
        code: 403,
        message: '无权查看待审批列表',
        data: null,
        timestamp: Date.now()
      })
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const bookings = await query(
      `SELECT b.*, r.name as room_name, r.location as room_location,
              u.real_name as user_name, u.username, d.name as department_name
       FROM bookings b
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       ${whereSql}
       ORDER BY b.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const list = bookings.map(b => ({
      ...b,
      status_name: getStatusName(b.status),
      approval_status_name: getApprovalStatusName(b.approval_status),
      meeting_type_name: getMeetingTypeName(b.meeting_type)
    }))

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
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

router.get('/my-approvals', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { page, pageSize, status } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = ['b.user_id = ?']
    let params = [userId]

    if (status) {
      whereClauses.push('b.approval_status = ?')
      params.push(status)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const bookings = await query(
      `SELECT b.*, r.name as room_name, r.location as room_location
       FROM bookings b
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       ${whereSql}
       ORDER BY b.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const list = []
    for (const b of bookings) {
      const approvalRecords = await query(
        `SELECT ar.*, u.real_name as approver_name
         FROM approval_records ar
         LEFT JOIN users u ON ar.approver_id = u.id
         WHERE ar.booking_id = ?
         ORDER BY ar.created_at DESC`,
        [b.id]
      )
      list.push({
        ...b,
        status_name: getStatusName(b.status),
        approval_status_name: getApprovalStatusName(b.approval_status),
        meeting_type_name: getMeetingTypeName(b.meeting_type),
        approval_records: approvalRecords
      })
    }

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM bookings b ${whereSql}`,
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

router.post('/:id/approve', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const userRole = req.user.role
    const { comment } = req.body

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

    if (userRole === 'dept_admin' && booking.approval_status !== 'pending_dept') {
      return res.status(400).json({
        code: 400,
        message: '当前预约不需要部门审核',
        data: null,
        timestamp: Date.now()
      })
    }

    if (userRole === 'dept_admin') {
      const bookingUser = await query('SELECT department_id FROM users WHERE id = ?', [booking.user_id])
      const currentUser = await query('SELECT department_id FROM users WHERE id = ?', [userId])
      if (bookingUser[0].department_id !== currentUser[0].department_id) {
        return res.status(403).json({
          code: 403,
          message: '只能审核本部门的预约',
          data: null,
          timestamp: Date.now()
        })
      }
    }

    if (['admin', 'super_admin'].includes(userRole) && booking.approval_status !== 'pending_admin') {
      return res.status(400).json({
        code: 400,
        message: '当前预约不需要行政确认',
        data: null,
        timestamp: Date.now()
      })
    }

    await transaction(async (conn) => {
      let newStatus = 'approved'
      let approverRole = userRole === 'dept_admin' ? 'dept_admin' : 'admin'

      if (userRole === 'dept_admin' && booking.is_cross_department) {
        newStatus = 'pending_admin'
        const admins = await conn.execute(
          "SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND status = 1 LIMIT 1"
        )
        if (admins[0].length > 0) {
          await conn.execute(
            'UPDATE bookings SET approval_status = ?, current_approver_id = ? WHERE id = ?',
            [newStatus, admins[0][0].id, id]
          )
        } else {
          newStatus = 'approved'
          await conn.execute(
            'UPDATE bookings SET approval_status = ?, current_approver_id = NULL, checkin_code = ? WHERE id = ?',
            [newStatus, generateCheckinCode(id), id]
          )
        }
      } else {
        await conn.execute(
          'UPDATE bookings SET approval_status = ?, current_approver_id = NULL, checkin_code = ? WHERE id = ?',
          [newStatus, generateCheckinCode(id), id]
        )
      }

      await conn.execute(
        'INSERT INTO approval_records (booking_id, approver_id, approver_role, status, comment) VALUES (?, ?, ?, ?, ?)',
        [id, userId, approverRole, 'approved', comment || '']
      )

      await conn.execute(
        'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)',
        [booking.user_id, 'approval', '预约审批通知', 
         newStatus === 'approved' ? `您的预约「${booking.meeting_title}」已通过审批` : `您的预约「${booking.meeting_title}」部门审核已通过，等待行政确认`,
         id]
      )
    })

    res.success(null, '审批通过')
  } catch (error) {
    next(error)
  }
})

router.post('/:id/reject', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const userRole = req.user.role
    const { comment } = req.body

    if (!comment) {
      return res.status(400).json({
        code: 400,
        message: '请填写驳回理由',
        data: null,
        timestamp: Date.now()
      })
    }

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

    const validStatuses = userRole === 'dept_admin' ? ['pending_dept'] : ['pending_admin']
    if (!validStatuses.includes(booking.approval_status)) {
      return res.status(400).json({
        code: 400,
        message: '当前预约状态不允许驳回',
        data: null,
        timestamp: Date.now()
      })
    }

    if (userRole === 'dept_admin') {
      const bookingUser = await query('SELECT department_id FROM users WHERE id = ?', [booking.user_id])
      const currentUser = await query('SELECT department_id FROM users WHERE id = ?', [userId])
      if (bookingUser[0].department_id !== currentUser[0].department_id) {
        return res.status(403).json({
          code: 403,
          message: '只能驳回本部门的预约',
          data: null,
          timestamp: Date.now()
        })
      }
    }

    await transaction(async (conn) => {
      const approverRole = userRole === 'dept_admin' ? 'dept_admin' : 'admin'

      await conn.execute(
        'UPDATE bookings SET approval_status = ?, rejection_reason = ?, current_approver_id = NULL WHERE id = ?',
        ['rejected', comment, id]
      )

      await conn.execute(
        'INSERT INTO approval_records (booking_id, approver_id, approver_role, status, comment) VALUES (?, ?, ?, ?, ?)',
        [id, userId, approverRole, 'rejected', comment]
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

      await conn.execute(
        'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)',
        [booking.user_id, 'approval', '预约被驳回', 
         `您的预约「${booking.meeting_title}」已被驳回，驳回理由：${comment}`,
         id]
      )
    })

    res.success(null, '已驳回')
  } catch (error) {
    next(error)
  }
})

router.put('/:id/resubmit', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { room_id, meeting_title, meeting_description, attendee_count, date, start_time, end_time, is_cross_department, meeting_type, assets } = req.body

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

    if (booking.user_id !== userId) {
      return res.status(403).json({
        code: 403,
        message: '只能重新提交自己的预约',
        data: null,
        timestamp: Date.now()
      })
    }

    if (booking.approval_status !== 'rejected') {
      return res.status(400).json({
        code: 400,
        message: '只有被驳回的预约才能重新提交',
        data: null,
        timestamp: Date.now()
      })
    }

    const newRoomId = room_id || booking.room_id
    const newDate = date || booking.date
    const newStartTime = start_time || booking.start_time
    const newEndTime = end_time || booking.end_time

    if (newStartTime >= newEndTime) {
      return res.status(400).json({
        code: 400,
        message: '开始时间必须早于结束时间',
        data: null,
        timestamp: Date.now()
      })
    }

    const rooms = await query('SELECT * FROM meeting_rooms WHERE id = ? AND status = 1', [newRoomId])
    if (rooms.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '会议室不存在或不可用',
        data: null,
        timestamp: Date.now()
      })
    }

    const capacity = attendee_count || booking.attendee_count
    if (parseInt(capacity) > rooms[0].capacity) {
      return res.status(400).json({
        code: 400,
        message: `参会人数不能超过会议室容量(${rooms[0].capacity}人)`,
        data: null,
        timestamp: Date.now()
      })
    }

    const existingBookings = await query(
      'SELECT * FROM bookings WHERE room_id = ? AND date = ? AND id != ?',
      [newRoomId, newDate, id]
    )

    const { checkTimeConflict } = require('../utils/helper')
    const conflictResult = checkTimeConflict(existingBookings, newStartTime, newEndTime)
    if (conflictResult.conflict) {
      return res.status(400).json({
        code: 400,
        message: '该时间段已被预约，请选择其他时间',
        data: { conflict: conflictResult.conflictBooking },
        timestamp: Date.now()
      })
    }

    const newIsCross = is_cross_department !== undefined ? is_cross_department : booking.is_cross_department
    const newMeetingType = meeting_type || booking.meeting_type

    let approvalStatus = 'auto_approved'
    let currentApproverId = null

    if (newMeetingType === 'large' || newIsCross) {
      approvalStatus = 'pending_dept'
      const userDept = await query('SELECT department_id FROM users WHERE id = ?', [userId])
      if (userDept.length > 0 && userDept[0].department_id) {
        const deptAdmins = await query(
          "SELECT id FROM users WHERE department_id = ? AND role = 'dept_admin' AND status = 1 LIMIT 1",
          [userDept[0].department_id]
        )
        if (deptAdmins.length > 0) {
          currentApproverId = deptAdmins[0].id
        }
      }
    }

    await transaction(async (conn) => {
      const oldBorrowings = await conn.execute(
        "SELECT * FROM borrowing_records WHERE booking_id = ?",
        [id]
      )
      for (const br of oldBorrowings[0]) {
        if (br.status === 'borrowed') {
          await conn.execute(
            'UPDATE assets SET available_quantity = available_quantity + ? WHERE id = ?',
            [br.quantity, br.asset_id]
          )
        }
      }
      await conn.execute('DELETE FROM borrowing_records WHERE booking_id = ?', [id])

      await conn.execute(
        `UPDATE bookings SET 
          room_id = ?, meeting_title = ?, meeting_description = ?, attendee_count = ?,
          date = ?, start_time = ?, end_time = ?, is_cross_department = ?, meeting_type = ?,
          approval_status = ?, current_approver_id = ?, rejection_reason = NULL, status = ?
         WHERE id = ?`,
        [
          newRoomId,
          meeting_title || booking.meeting_title,
          meeting_description !== undefined ? meeting_description : booking.meeting_description,
          capacity,
          newDate,
          newStartTime,
          newEndTime,
          newIsCross,
          newMeetingType,
          approvalStatus,
          currentApproverId,
          'pending',
          id
        ]
      )

      if (assets && assets.length > 0) {
        for (const assetItem of assets) {
          const asset = await query('SELECT * FROM assets WHERE id = ? AND status = 1', [assetItem.asset_id])
          if (asset.length === 0 || asset[0].available_quantity < assetItem.quantity) {
            throw new Error(`资产 ${assetItem.asset_id} 不存在或库存不足`)
          }
          await conn.execute(
            'INSERT INTO borrowing_records (booking_id, user_id, asset_id, quantity, status) VALUES (?, ?, ?, ?, ?)',
            [id, userId, assetItem.asset_id, assetItem.quantity, 'borrowed']
          )
          await conn.execute(
            'UPDATE assets SET available_quantity = available_quantity - ? WHERE id = ?',
            [assetItem.quantity, assetItem.asset_id]
          )
          await conn.execute(
            'INSERT INTO asset_usage_logs (asset_id, user_id, booking_id, action, quantity, remark) VALUES (?, ?, ?, ?, ?, ?)',
            [assetItem.asset_id, userId, id, 'borrow', assetItem.quantity, '预约借用']
          )
        }
      }

      if (approvalStatus === 'pending_dept' && currentApproverId) {
        await conn.execute(
          'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)',
          [currentApproverId, 'approval', '新的预约待审批', 
           `有新的预约「${meeting_title || booking.meeting_title}」等待您审批`,
           id]
        )
      }
    })

    res.success({ booking_id: id }, '重新提交成功')
  } catch (error) {
    next(error)
  }
})

module.exports = router
