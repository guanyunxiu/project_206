const express = require('express')
const { query, transaction } = require('../config/database')
const { authenticateToken, requireDeptAdminOrHigher, requireAdminOrHigher } = require('../middleware/auth')
const { createPagination, getStatusName, getCheckinMethodName, getViolationTypeName } = require('../utils/helper')

const router = express.Router()

router.get('/my-violations', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { page, pageSize, type } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = ['user_id = ?']
    let params = [userId]

    if (type) {
      whereClauses.push('type = ?')
      params.push(type)
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

    const violations = await query(
      `SELECT * FROM user_violations ${whereSql} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const list = violations.map(v => ({
      ...v,
      type_name: getViolationTypeName(v.type)
    }))

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM user_violations ${whereSql}`,
      params
    )

    const [missedCount] = await query(
      "SELECT COUNT(*) as count FROM user_violations WHERE user_id = ? AND type = 'missed' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
      [userId]
    )

    const [lateReturnCount] = await query(
      "SELECT COUNT(*) as count FROM user_violations WHERE user_id = ? AND type = 'late_return' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
      [userId]
    )

    const [bookingRule] = await query(
      "SELECT * FROM exception_rules WHERE rule_type = 'missed_meeting' AND is_enabled = 1 LIMIT 1",
      []
    )

    let isBookingRestricted = false
    let restrictionInfo = null
    if (bookingRule && missedCount[0].count >= bookingRule.threshold) {
      isBookingRestricted = true
      restrictionInfo = {
        rule_name: bookingRule.rule_name,
        violation_count: missedCount[0].count,
        threshold: bookingRule.threshold,
        penalty_action: bookingRule.penalty_action,
        penalty_duration: bookingRule.penalty_duration
      }
    }

    res.success({
      list,
      total: countResult.total,
      page: parseInt(page) || 1,
      page_size: parseInt(pageSize) || 10,
      stats: {
        missed_count_30d: missedCount[0].count,
        late_return_count_30d: lateReturnCount[0].count
      },
      is_booking_restricted: isBookingRestricted,
      restriction_info: restrictionInfo
    })
  } catch (error) {
    next(error)
  }
})

router.get('/qrcode/:bookingId', authenticateToken, async (req, res, next) => {
  try {
    const { bookingId } = req.params
    const userId = req.user.id

    const bookings = await query(
      `SELECT b.*, r.name as room_name, r.location as room_location
       FROM bookings b
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       WHERE b.id = ?`,
      [bookingId]
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

    if (booking.user_id !== userId) {
      return res.status(403).json({
        code: 403,
        message: '无权查看此预约的签到码',
        data: null,
        timestamp: Date.now()
      })
    }

    if (!booking.checkin_code) {
      return res.status(400).json({
        code: 400,
        message: '预约尚未通过审批，无法生成签到码',
        data: null,
        timestamp: Date.now()
      })
    }

    if (!['pending', 'in_use'].includes(booking.status)) {
      return res.status(400).json({
        code: 400,
        message: '当前预约状态不支持签到',
        data: null,
        timestamp: Date.now()
      })
    }

    const qrContent = JSON.stringify({
      booking_id: booking.id,
      checkin_code: booking.checkin_code,
      room_id: booking.room_id,
      user_id: booking.user_id,
      timestamp: Date.now()
    })

    res.success({
      booking_id: booking.id,
      meeting_title: booking.meeting_title,
      room_name: booking.room_name,
      date: booking.date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      checkin_code: booking.checkin_code,
      qr_content: qrContent
    })
  } catch (error) {
    next(error)
  }
})

router.post('/scan', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { checkin_code, booking_id } = req.body

    if (!checkin_code || !booking_id) {
      return res.status(400).json({
        code: 400,
        message: '请提供签到码和预约ID',
        data: null,
        timestamp: Date.now()
      })
    }

    const bookings = await query('SELECT * FROM bookings WHERE id = ? AND checkin_code = ?', [booking_id, checkin_code])
    if (bookings.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '签到码无效或预约不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const booking = bookings[0]

    if (!['pending', 'in_use'].includes(booking.status)) {
      return res.status(400).json({
        code: 400,
        message: '当前预约状态不支持签到',
        data: null,
        timestamp: Date.now()
      })
    }

    const bookingDate = new Date(booking.date)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const bookingDay = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate())

    if (bookingDay.getTime() !== today.getTime()) {
      return res.status(400).json({
        code: 400,
        message: '只能在会议当天签到',
        data: null,
        timestamp: Date.now()
      })
    }

    const [startH, startM] = booking.start_time.split(':').map(Number)
    const startTime = new Date(bookingDate)
    startTime.setHours(startH, startM, 0, 0)

    const fifteenMinutesBefore = new Date(startTime.getTime() - 15 * 60 * 1000)
    const thirtyMinutesAfter = new Date(startTime.getTime() + 30 * 60 * 1000)

    if (now < fifteenMinutesBefore) {
      return res.status(400).json({
        code: 400,
        message: '签到时间未到，请在会议开始前15分钟内签到',
        data: null,
        timestamp: Date.now()
      })
    }

    if (now > thirtyMinutesAfter) {
      return res.status(400).json({
        code: 400,
        message: '签到时间已过，会议开始30分钟后无法签到',
        data: null,
        timestamp: Date.now()
      })
    }

    const isLate = now > startTime

    await transaction(async (conn) => {
      try {
        await conn.execute(
          'INSERT INTO checkin_records (booking_id, user_id, checkin_method, is_late) VALUES (?, ?, ?, ?)',
          [booking_id, userId, 'qrcode', isLate ? 1 : 0]
        )
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          throw new Error('您已经签到过了')
        }
        throw e
      }

      if (isLate) {
        await conn.execute(
          'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)',
          [userId, 'checkin', '迟到提醒', 
           `您在会议「${booking.meeting_title}」中迟到签到，请准时参加会议`,
           booking_id]
        )
      }

      await conn.execute(
        "UPDATE bookings SET status = 'in_use' WHERE id = ? AND status = 'pending'",
        [booking_id]
      )
    })

    res.success({
      booking_id: booking.id,
      meeting_title: booking.meeting_title,
      checkin_time: new Date(),
      is_late: isLate,
      checkin_method: 'qrcode'
    }, isLate ? '签到成功（迟到）' : '签到成功')
  } catch (error) {
    next(error)
  }
})

router.post('/manual/:bookingId', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { bookingId } = req.params
    const { user_id } = req.body

    if (!user_id) {
      return res.status(400).json({
        code: 400,
        message: '请选择要签到的用户',
        data: null,
        timestamp: Date.now()
      })
    }

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

    if (!['pending', 'in_use'].includes(booking.status)) {
      return res.status(400).json({
        code: 400,
        message: '当前预约状态不支持签到',
        data: null,
        timestamp: Date.now()
      })
    }

    await transaction(async (conn) => {
      try {
        await conn.execute(
          'INSERT INTO checkin_records (booking_id, user_id, checkin_method, is_late) VALUES (?, ?, ?, ?)',
          [bookingId, user_id, 'manual', 0]
        )
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          throw new Error('该用户已经签到过了')
        }
        throw e
      }

      const user = await conn.execute('SELECT real_name FROM users WHERE id = ?', [user_id])
      const userName = user[0][0]?.real_name || '用户'

      await conn.execute(
        'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)',
        [user_id, 'checkin', '签到通知', 
         `您已被后台签到至会议「${booking.meeting_title}」`,
         bookingId]
      )

      await conn.execute(
        "UPDATE bookings SET status = 'in_use' WHERE id = ? AND status = 'pending'",
        [bookingId]
      )
    })

    res.success(null, '后台签到成功')
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
        message: '无权查看此预约的签到记录',
        data: null,
        timestamp: Date.now()
      })
    }

    const records = await query(
      `SELECT cr.*, u.real_name, u.username, u.avatar
       FROM checkin_records cr
       LEFT JOIN users u ON cr.user_id = u.id
       WHERE cr.booking_id = ?
       ORDER BY cr.checkin_time ASC`,
      [bookingId]
    )

    const list = records.map(r => ({
      ...r,
      checkin_method_name: getCheckinMethodName(r.checkin_method)
    }))

    res.success({
      booking_id: bookingId,
      meeting_title: booking.meeting_title,
      checkin_records: list,
      total_checked: list.length
    })
  } catch (error) {
    next(error)
  }
})

router.post('/process-missed', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const { booking_id } = req.body

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

    if (booking.status !== 'pending') {
      return res.status(400).json({
        code: 400,
        message: '只有待使用的预约可以标记为爽约',
        data: null,
        timestamp: Date.now()
      })
    }

    const now = new Date()
    const bookingDate = new Date(booking.date)
    const [endH, endM] = booking.end_time.split(':').map(Number)
    const endTime = new Date(bookingDate)
    endTime.setHours(endH, endM, 0, 0)

    if (now < endTime) {
      return res.status(400).json({
        code: 400,
        message: '会议尚未结束，无法标记为爽约',
        data: null,
        timestamp: Date.now()
      })
    }

    const checkinRecords = await query(
      'SELECT * FROM checkin_records WHERE booking_id = ? AND user_id = ?',
      [booking_id, booking.user_id]
    )

    if (checkinRecords.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '用户已签到，不能标记为爽约',
        data: null,
        timestamp: Date.now()
      })
    }

    await transaction(async (conn) => {
      await conn.execute(
        "UPDATE bookings SET status = 'missed' WHERE id = ?",
        [booking_id]
      )

      await conn.execute(
        'INSERT INTO user_violations (user_id, type, booking_id, description) VALUES (?, ?, ?, ?)',
        [booking.user_id, 'missed', booking_id, `会议「${booking.meeting_title}」未签到，标记为爽约`]
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

      const [violationCount] = await conn.execute(
        "SELECT COUNT(*) as count FROM user_violations WHERE user_id = ? AND type = 'missed' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
        [booking.user_id]
      )

      const [rule] = await conn.execute(
        "SELECT * FROM exception_rules WHERE rule_type = 'missed_meeting' AND is_enabled = 1 LIMIT 1"
      )

      let notificationContent = `您的会议「${booking.meeting_title}」因未签到被标记为爽约。`
      
      if (rule[0].length > 0 && violationCount[0].count >= rule[0][0].threshold) {
        notificationContent += ` 您在30天内已爽约${violationCount[0].count}次，根据规则将被限制预约${rule[0][0].penalty_duration}天。`
      }

      await conn.execute(
        'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)',
        [booking.user_id, 'violation', '会议爽约通知', notificationContent, booking_id]
      )
    })

    res.success(null, '已标记为爽约')
  } catch (error) {
    next(error)
  }
})

module.exports = router
