const express = require('express')
const { query, transaction } = require('../config/database')
const { authenticateToken } = require('../middleware/auth')
const { createPagination, getCheckinStatusName, getCheckinMethodName, getViolationTypeName, getStatusName } = require('../utils/helper')

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

function generateQRCodeToken(bookingId) {
  return Buffer.from(`booking_${bookingId}_${Date.now()}`).toString('base64')
}

router.get('/qrcode/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const userRole = req.user.role

    const bookings = await query(
      `SELECT b.*, u.department_id as user_dept_id, r.name as room_name
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

    if (booking.user_id !== userId && !['dept_admin', 'admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '无权获取此预约的签到二维码',
        data: null,
        timestamp: Date.now()
      })
    }

    if (!['approved', 'in_use'].includes(booking.status) && booking.approval_status !== 'approved') {
      return res.status(400).json({
        code: 400,
        message: '该预约尚未通过审批，无法签到',
        data: null,
        timestamp: Date.now()
      })
    }

    const qrToken = generateQRCodeToken(id)

    res.success({
      booking_id: id,
      qr_token: qrToken,
      qr_content: JSON.stringify({
        booking_id: id,
        token: qrToken,
        timestamp: Date.now()
      }),
      meeting_title: booking.meeting_title,
      room_name: booking.room_name,
      date: booking.date,
      start_time: booking.start_time,
      end_time: booking.end_time
    })
  } catch (error) {
    next(error)
  }
})

router.post('/checkin', authenticateToken, async (req, res, next) => {
  try {
    const { booking_id, checkin_method = 'manual', qr_token } = req.body
    const userId = req.user.id
    const userRole = req.user.role

    if (!booking_id) {
      return res.status(400).json({
        code: 400,
        message: '请提供预约ID',
        data: null,
        timestamp: Date.now()
      })
    }

    const bookings = await query(
      `SELECT b.*, u.department_id as user_dept_id, u.real_name as user_name
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.id = ?`,
      [booking_id]
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

    if (booking.checkin_status === 'checked_in') {
      return res.status(400).json({
        code: 400,
        message: '该预约已签到',
        data: null,
        timestamp: Date.now()
      })
    }

    if (booking.checkin_status === 'no_show') {
      return res.status(400).json({
        code: 400,
        message: '该预约已标记为爽约，无法签到',
        data: null,
        timestamp: Date.now()
      })
    }

    if (!['approved', 'in_use'].includes(booking.status)) {
      return res.status(400).json({
        code: 400,
        message: '该预约状态不允许签到',
        data: null,
        timestamp: Date.now()
      })
    }

    if (booking.user_id !== userId && !['dept_admin', 'admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '无权为此预约签到',
        data: null,
        timestamp: Date.now()
      })
    }

    const settings = await getSystemSettings()
    const graceMinutes = parseInt(settings.checkin_grace_minutes || 15)

    const now = new Date()
    const bookingDateTime = new Date(`${booking.date}T${booking.start_time}`)
    const graceEndTime = new Date(bookingDateTime.getTime() + graceMinutes * 60 * 1000)

    if (now > graceEndTime) {
      return res.status(400).json({
        code: 400,
        message: `已超过签到宽限时间（${graceMinutes}分钟），无法签到`,
        data: null,
        timestamp: Date.now()
      })
    }

    if (checkin_method === 'qrcode' && !qr_token) {
      return res.status(400).json({
        code: 400,
        message: '二维码签到需要提供token',
        data: null,
        timestamp: Date.now()
      })
    }

    await transaction(async (conn) => {
      await conn.execute(
        'INSERT INTO checkin_records (booking_id, user_id, checkin_method, status, remark) VALUES (?, ?, ?, ?, ?)',
        [booking_id, userId, checkin_method, 'success', `签到成功，方式：${checkin_method === 'qrcode' ? '二维码' : '后台'}`]
      )

      await conn.execute(
        "UPDATE bookings SET checkin_status = 'checked_in', checkin_time = CURRENT_TIMESTAMP, checkin_method = ?, status = 'in_use', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [checkin_method, booking_id]
      )
    })

    res.success({
      booking_id,
      checkin_status: 'checked_in',
      checkin_time: new Date(),
      checkin_method
    }, '签到成功')
  } catch (error) {
    next(error)
  }
})

router.post('/mark-no-show', authenticateToken, async (req, res, next) => {
  try {
    const { booking_id, remark } = req.body
    const userId = req.user.id
    const userRole = req.user.role

    if (!['admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '只有管理员可以标记爽约',
        data: null,
        timestamp: Date.now()
      })
    }

    if (!booking_id) {
      return res.status(400).json({
        code: 400,
        message: '请提供预约ID',
        data: null,
        timestamp: Date.now()
      })
    }

    const bookings = await query('SELECT * FROM bookings WHERE id = ?', [booking_id])
    if (bookings.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '预约不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const booking = bookings[0]

    if (booking.checkin_status === 'checked_in') {
      return res.status(400).json({
        code: 400,
        message: '该预约已签到，无法标记爽约',
        data: null,
        timestamp: Date.now()
      })
    }

    if (booking.checkin_status === 'no_show') {
      return res.status(400).json({
        code: 400,
        message: '该预约已标记为爽约',
        data: null,
        timestamp: Date.now()
      })
    }

    await transaction(async (conn) => {
      await conn.execute(
        'INSERT INTO checkin_records (booking_id, user_id, checkin_method, status, remark) VALUES (?, ?, ?, ?, ?)',
        [booking_id, userId, 'manual', 'failed', remark || '管理员标记爽约']
      )

      await conn.execute(
        "UPDATE bookings SET checkin_status = 'no_show', status = 'no_show', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [booking_id]
      )

      await conn.execute(
        'INSERT INTO violation_records (user_id, booking_id, violation_type, description) VALUES (?, ?, ?, ?)',
        [booking.user_id, booking_id, 'no_show', remark || '未签到爽约']
      )

      await conn.execute(
        'UPDATE users SET violation_count = violation_count + 1, last_violation_reset = COALESCE(last_violation_reset, CURDATE()) WHERE id = ?',
        [booking.user_id]
      )

      const borrowings = await conn.execute(
        "SELECT * FROM borrowing_records WHERE booking_id = ? AND status = 'borrowed'",
        [booking_id]
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
        'checkin',
        '预约被标记为爽约',
        `您的预约「${booking.meeting_title}」被标记为爽约，请准时参加会议。累计多次爽约将被限制预约。`,
        booking_id
      )
    })

    res.success(null, '已标记为爽约')
  } catch (error) {
    next(error)
  }
})

router.get('/violations/my', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { page, pageSize, start_date, end_date } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = ['v.user_id = ?']
    let params = [userId]

    if (start_date) {
      whereClauses.push('DATE(v.created_at) >= ?')
      params.push(start_date)
    }
    if (end_date) {
      whereClauses.push('DATE(v.created_at) <= ?')
      params.push(end_date)
    }

    const whereSql = whereClauses.join(' AND ')

    const violations = await query(
      `SELECT v.*, b.meeting_title, b.date, b.start_time, r.name as room_name
       FROM violation_records v
       LEFT JOIN bookings b ON v.booking_id = b.id
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       WHERE ${whereSql}
       ORDER BY v.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM violation_records v WHERE ${whereSql}`,
      params
    )

    const [userData] = await query('SELECT violation_count, last_violation_reset FROM users WHERE id = ?', [userId])

    const list = violations.map(v => ({
      ...v,
      violation_type_name: getViolationTypeName(v.violation_type)
    }))

    res.success({
      list,
      total: countResult.total,
      page: parseInt(page) || 1,
      page_size: parseInt(pageSize) || 10,
      violation_count: userData[0].violation_count || 0,
      last_violation_reset: userData[0].last_violation_reset
    })
  } catch (error) {
    next(error)
  }
})

router.get('/violations', authenticateToken, async (req, res, next) => {
  try {
    const userRole = req.user.role
    const { page, pageSize, user_id, start_date, end_date } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    if (!['admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '无权查看违规记录',
        data: null,
        timestamp: Date.now()
      })
    }

    let whereClauses = []
    let params = []

    if (user_id) {
      whereClauses.push('v.user_id = ?')
      params.push(parseInt(user_id))
    }
    if (start_date) {
      whereClauses.push('DATE(v.created_at) >= ?')
      params.push(start_date)
    }
    if (end_date) {
      whereClauses.push('DATE(v.created_at) <= ?')
      params.push(end_date)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const violations = await query(
      `SELECT v.*, b.meeting_title, b.date, b.start_time, r.name as room_name,
              u.real_name as user_name, u.username
       FROM violation_records v
       LEFT JOIN bookings b ON v.booking_id = b.id
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       LEFT JOIN users u ON v.user_id = u.id
       ${whereSql}
       ORDER BY v.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM violation_records v ${whereSql}`,
      params
    )

    const list = violations.map(v => ({
      ...v,
      violation_type_name: getViolationTypeName(v.violation_type)
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

router.post('/auto-process', authenticateToken, async (req, res, next) => {
  try {
    const userRole = req.user.role

    if (!['admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '只有管理员可以执行自动处理',
        data: null,
        timestamp: Date.now()
      })
    }

    const settings = await getSystemSettings()
    const graceMinutes = parseInt(settings.checkin_grace_minutes || 15)
    const autoCheckoutMinutes = parseInt(settings.auto_checkout_minutes || 30)

    const now = new Date()
    const today = now.toISOString().split('T')[0]

    const pendingBookings = await query(
      `SELECT b.* FROM bookings b
       WHERE b.date = ? 
       AND b.status IN ('approved', 'in_use')
       AND b.checkin_status = 'pending'`,
      [today]
    )

    let noShowCount = 0
    let autoCompleteCount = 0

    for (const booking of pendingBookings) {
      const bookingStart = new Date(`${booking.date}T${booking.start_time}`)
      const graceEnd = new Date(bookingStart.getTime() + graceMinutes * 60 * 1000)
      const bookingEnd = new Date(`${booking.date}T${booking.end_time}`)
      const autoCompleteTime = new Date(bookingEnd.getTime() + autoCheckoutMinutes * 60 * 1000)

      if (now > graceEnd && booking.status === 'approved') {
        await transaction(async (conn) => {
          await conn.execute(
            'INSERT INTO checkin_records (booking_id, user_id, checkin_method, status, remark) VALUES (?, ?, ?, ?, ?)',
            [booking.id, booking.user_id, 'manual', 'failed', '系统自动标记爽约']
          )

          await conn.execute(
            "UPDATE bookings SET checkin_status = 'no_show', status = 'no_show', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [booking.id]
          )

          await conn.execute(
            'INSERT INTO violation_records (user_id, booking_id, violation_type, description) VALUES (?, ?, ?, ?)',
            [booking.user_id, booking.id, 'no_show', '系统自动标记：未签到爽约']
          )

          await conn.execute(
            'UPDATE users SET violation_count = violation_count + 1, last_violation_reset = COALESCE(last_violation_reset, CURDATE()) WHERE id = ?',
            [booking.user_id]
          )

          const borrowings = await conn.execute(
            "SELECT * FROM borrowing_records WHERE booking_id = ? AND status = 'borrowed'",
            [booking.id]
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
            'checkin',
            '预约被系统标记为爽约',
            `您的预约「${booking.meeting_title}」未按时签到，被系统自动标记为爽约。`,
            booking.id
          )
        })
        noShowCount++
      }

      if (now > autoCompleteTime && booking.status === 'in_use') {
        await query(
          "UPDATE bookings SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [booking.id]
        )
        autoCompleteCount++
      }
    }

    res.success({
      no_show_count: noShowCount,
      auto_complete_count: autoCompleteCount,
      processed_count: noShowCount + autoCompleteCount
    }, `自动处理完成，标记爽约${noShowCount}个，自动结束${autoCompleteCount}个`)
  } catch (error) {
    next(error)
  }
})

router.get('/records/:bookingId', authenticateToken, async (req, res, next) => {
  try {
    const { bookingId } = req.params
    const userId = req.user.id
    const userRole = req.user.role

    const bookings = await query('SELECT * FROM bookings WHERE id = ?', [bookingId])
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
        message: '无权查看此签到记录',
        data: null,
        timestamp: Date.now()
      })
    }

    const records = await query(
      `SELECT cr.*, u.real_name as user_name, u.username
       FROM checkin_records cr
       LEFT JOIN users u ON cr.user_id = u.id
       WHERE cr.booking_id = ?
       ORDER BY cr.checkin_time DESC`,
      [bookingId]
    )

    const list = records.map(r => ({
      ...r,
      checkin_method_name: getCheckinMethodName(r.checkin_method)
    }))

    res.success({ list })
  } catch (error) {
    next(error)
  }
})

module.exports = router
