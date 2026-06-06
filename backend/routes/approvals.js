const express = require('express')
const { query, transaction } = require('../config/database')
const { authenticateToken } = require('../middleware/auth')
const { createPagination, getStatusName, getApprovalStatusName } = require('../utils/helper')

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

router.get('/pending', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const userRole = req.user.role
    const userDeptId = req.user.department_id
    const { page, pageSize, status } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = []
    let params = []

    if (userRole === 'dept_admin') {
      whereClauses.push('(b.approval_status = ? AND u.department_id = ?)')
      params.push('pending_dept', userDeptId)
    } else if (['admin', 'super_admin'].includes(userRole)) {
      whereClauses.push('b.approval_status IN (?, ?)')
      params.push('pending_dept', 'pending_admin')
    } else {
      return res.status(403).json({
        code: 403,
        message: '无权查看待审批列表',
        data: null,
        timestamp: Date.now()
      })
    }

    if (status) {
      whereClauses.push('b.status = ?')
      params.push(status)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const bookings = await query(
      `SELECT b.*, r.name as room_name, r.location as room_location, r.capacity as room_capacity, r.room_type,
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

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       ${whereSql}`,
      params
    )

    const list = bookings.map(b => ({
      ...b,
      status_name: getStatusName(b.status),
      approval_status_name: getApprovalStatusName(b.approval_status)
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

router.get('/my', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { page, pageSize, approval_status } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = ['b.user_id = ?']
    let params = [userId]

    if (approval_status) {
      whereClauses.push('b.approval_status = ?')
      params.push(approval_status)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const bookings = await query(
      `SELECT b.*, r.name as room_name, r.location as room_location, r.room_type
       FROM bookings b
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       ${whereSql}
       ORDER BY b.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM bookings b ${whereSql}`,
      params
    )

    const list = []
    for (const b of bookings) {
      const approvalRecords = await query(
        `SELECT ar.*, u.real_name as approver_name
         FROM approval_records ar
         LEFT JOIN users u ON ar.approver_id = u.id
         WHERE ar.booking_id = ?
         ORDER BY ar.step ASC, ar.created_at ASC`,
        [b.id]
      )

      list.push({
        ...b,
        status_name: getStatusName(b.status),
        approval_status_name: getApprovalStatusName(b.approval_status),
        approval_records: approvalRecords
      })
    }

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

router.post('/:id/approve', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const approverId = req.user.id
    const userRole = req.user.role
    const userDeptId = req.user.department_id
    const { comment } = req.body

    const bookings = await query(
      `SELECT b.*, u.department_id as user_dept_id, u.real_name as user_name, r.room_type, r.name as room_name
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
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

    if (booking.approval_status === 'approved') {
      return res.status(400).json({
        code: 400,
        message: '该预约已通过审批',
        data: null,
        timestamp: Date.now()
      })
    }

    if (booking.approval_status === 'rejected') {
      return res.status(400).json({
        code: 400,
        message: '该预约已被拒绝',
        data: null,
        timestamp: Date.now()
      })
    }

    let approvalStep = 0
    if (booking.approval_status === 'pending_dept') {
      approvalStep = 1
      if (userRole === 'dept_admin') {
        if (parseInt(userDeptId) !== parseInt(booking.user_dept_id)) {
          return res.status(403).json({
            code: 403,
            message: '只能审批本部门的预约',
            data: null,
            timestamp: Date.now()
          })
        }
      } else if (!['admin', 'super_admin'].includes(userRole)) {
        return res.status(403).json({
          code: 403,
          message: '无权审批此预约',
          data: null,
          timestamp: Date.now()
        })
      }
    } else if (booking.approval_status === 'pending_admin') {
      approvalStep = 2
      if (!['admin', 'super_admin'].includes(userRole)) {
        return res.status(403).json({
          code: 403,
          message: '只有行政管理员可以执行此操作',
          data: null,
          timestamp: Date.now()
        })
      }
    } else {
      return res.status(400).json({
        code: 400,
        message: '该预约无需审批',
        data: null,
        timestamp: Date.now()
      })
    }

    await transaction(async (conn) => {
      await conn.execute(
        'INSERT INTO approval_records (booking_id, approver_id, step, status, comment) VALUES (?, ?, ?, ?, ?)',
        [id, approverId, approvalStep, 'approved', comment || '']
      )

      let nextStatus = booking.approval_status
      let nextStep = booking.current_approval_step

      if (approvalStep === 1) {
        nextStatus = 'pending_admin'
        nextStep = 2
      } else if (approvalStep === 2) {
        nextStatus = 'approved'
        nextStep = 3
      }

      await conn.execute(
        'UPDATE bookings SET approval_status = ?, current_approval_step = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [nextStatus, nextStep, nextStatus === 'approved' ? 'approved' : booking.status, id]
      )

      if (nextStatus === 'approved') {
        await createNotification(
          booking.user_id,
          'approval',
          '预约审批通过',
          `您的预约「${booking.meeting_title}」已通过审批，可以正常使用。`,
          id
        )
      } else if (nextStatus === 'pending_admin') {
        const admins = await conn.execute(
          "SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND status = 1"
        )
        for (const admin of admins[0]) {
          await createNotification(
            admin.id,
            'approval',
            '新的预约待行政确认',
            `预约「${booking.meeting_title}」已通过部门审批，待行政确认。`,
            id
          )
        }
      }
    })

    res.success(null, '审批通过')
  } catch (error) {
    next(error)
  }
})

router.post('/:id/reject', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const approverId = req.user.id
    const userRole = req.user.role
    const userDeptId = req.user.department_id
    const { comment } = req.body

    if (!comment) {
      return res.status(400).json({
        code: 400,
        message: '请填写驳回原因',
        data: null,
        timestamp: Date.now()
      })
    }

    const bookings = await query(
      `SELECT b.*, u.department_id as user_dept_id, u.real_name as user_name, r.room_type, r.name as room_name
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
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

    if (!['pending_dept', 'pending_admin'].includes(booking.approval_status)) {
      return res.status(400).json({
        code: 400,
        message: '该预约无需审批或已处理',
        data: null,
        timestamp: Date.now()
      })
    }

    let approvalStep = 0
    if (booking.approval_status === 'pending_dept') {
      approvalStep = 1
      if (userRole === 'dept_admin') {
        if (parseInt(userDeptId) !== parseInt(booking.user_dept_id)) {
          return res.status(403).json({
            code: 403,
            message: '只能审批本部门的预约',
            data: null,
            timestamp: Date.now()
          })
        }
      } else if (!['admin', 'super_admin'].includes(userRole)) {
        return res.status(403).json({
          code: 403,
          message: '无权审批此预约',
          data: null,
          timestamp: Date.now()
        })
      }
    } else if (booking.approval_status === 'pending_admin') {
      approvalStep = 2
      if (!['admin', 'super_admin'].includes(userRole)) {
        return res.status(403).json({
          code: 403,
          message: '只有行政管理员可以执行此操作',
          data: null,
          timestamp: Date.now()
        })
      }
    }

    await transaction(async (conn) => {
      await conn.execute(
        'INSERT INTO approval_records (booking_id, approver_id, step, status, comment) VALUES (?, ?, ?, ?, ?)',
        [id, approverId, approvalStep, 'rejected', comment]
      )

      await conn.execute(
        "UPDATE bookings SET approval_status = 'rejected', status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
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

      await createNotification(
        booking.user_id,
        'approval',
        '预约审批被驳回',
        `您的预约「${booking.meeting_title}」被驳回，原因：${comment}。您可以修改后重新提交。`,
        id
      )
    })

    res.success(null, '审批驳回')
  } catch (error) {
    next(error)
  }
})

router.put('/:id/resubmit', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { room_id, meeting_title, meeting_description, attendee_count, date, start_time, end_time, assets, attendee_departments, is_cross_department } = req.body

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

    if (booking.status !== 'rejected') {
      return res.status(400).json({
        code: 400,
        message: '只有被驳回的预约才能重新提交',
        data: null,
        timestamp: Date.now()
      })
    }

    const updateRoomId = room_id || booking.room_id
    const rooms = await query('SELECT * FROM meeting_rooms WHERE id = ? AND status = 1', [updateRoomId])
    if (rooms.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '会议室不存在或不可用',
        data: null,
        timestamp: Date.now()
      })
    }

    const settings = await getSystemSettings()
    const crossDept = is_cross_department || booking.is_cross_department
    const attendeeCount = attendee_count || booking.attendee_count
    const requiresApproval = needsApproval(rooms[0].room_type, attendeeCount, crossDept, settings)

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
      await conn.execute('DELETE FROM approval_records WHERE booking_id = ?', [id])

      const updates = []
      const values = []

      if (meeting_title) { updates.push('meeting_title = ?'); values.push(meeting_title) }
      if (meeting_description !== undefined) { updates.push('meeting_description = ?'); values.push(meeting_description) }
      if (attendee_count !== undefined) { updates.push('attendee_count = ?'); values.push(attendee_count) }
      if (date) { updates.push('date = ?'); values.push(date) }
      if (start_time) { updates.push('start_time = ?'); values.push(start_time) }
      if (end_time) { updates.push('end_time = ?'); values.push(end_time) }
      if (room_id) { updates.push('room_id = ?'); values.push(room_id) }
      if (attendee_departments !== undefined) { updates.push('attendee_departments = ?'); values.push(JSON.stringify(attendee_departments)) }
      if (is_cross_department !== undefined) { updates.push('is_cross_department = ?'); values.push(is_cross_department ? 1 : 0) }

      let newStatus, newApprovalStatus, newStep
      if (requiresApproval) {
        newStatus = 'pending_approval'
        newApprovalStatus = 'pending_dept'
        newStep = 1
      } else {
        newStatus = 'approved'
        newApprovalStatus = 'auto_approved'
        newStep = 0
      }

      updates.push('status = ?')
      values.push(newStatus)
      updates.push('approval_status = ?')
      values.push(newApprovalStatus)
      updates.push('current_approval_step = ?')
      values.push(newStep)
      updates.push('checkin_status = ?')
      values.push('pending')
      updates.push('updated_at = CURRENT_TIMESTAMP')

      values.push(id)
      await conn.execute(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`, values)

      const assetList = assets || []
      if (assetList.length > 0) {
        for (const assetItem of assetList) {
          const asset = await conn.execute('SELECT * FROM assets WHERE id = ? AND status = 1', [assetItem.asset_id])
          if (asset[0].length === 0 || asset[0][0].available_quantity < assetItem.quantity) {
            throw new Error(`资产 ${assetItem.asset_id} 不可用或库存不足`)
          }
          await conn.execute(
            'INSERT INTO borrowing_records (booking_id, user_id, asset_id, quantity, status) VALUES (?, ?, ?, ?, ?)',
            [id, userId, assetItem.asset_id, assetItem.quantity, 'borrowed']
          )
          await conn.execute(
            'UPDATE assets SET available_quantity = available_quantity - ? WHERE id = ?',
            [assetItem.quantity, assetItem.asset_id]
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
            `预约「${meeting_title || booking.meeting_title}」待您审批。`,
            id
          )
        }
      }
    })

    res.success({ booking_id: id }, '预约重新提交成功')
  } catch (error) {
    next(error)
  }
})

router.get('/:id/records', authenticateToken, async (req, res, next) => {
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
        message: '无权查看此审批记录',
        data: null,
        timestamp: Date.now()
      })
    }

    const records = await query(
      `SELECT ar.*, u.real_name as approver_name, u.role as approver_role
       FROM approval_records ar
       LEFT JOIN users u ON ar.approver_id = u.id
       WHERE ar.booking_id = ?
       ORDER BY ar.step ASC, ar.created_at ASC`,
      [id]
    )

    res.success({ list: records })
  } catch (error) {
    next(error)
  }
})

module.exports = router
