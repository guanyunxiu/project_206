const express = require('express')
const { query, transaction } = require('../config/database')
const { authenticateToken } = require('../middleware/auth')
const { createPagination, checkTimeConflict, getStatusName } = require('../utils/helper')

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
    const { room_id, meeting_title, meeting_description, attendee_count, date, start_time, end_time, assets } = req.body

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
      const [bookingResult] = await conn.execute(
        `INSERT INTO bookings (user_id, room_id, meeting_title, meeting_description, attendee_count, date, start_time, end_time, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, room_id, meeting_title, meeting_description || '', attendee_count || 0, date, start_time, end_time]
      )

      const bookingId = bookingResult.insertId

      if (assets && assets.length > 0) {
        for (const assetItem of assets) {
          await conn.execute(
            'INSERT INTO borrowing_records (booking_id, user_id, asset_id, quantity, status) VALUES (?, ?, ?, ?, ?)',
            [bookingId, userId, assetItem.asset_id, assetItem.quantity, 'borrowed']
          )
          await conn.execute(
            'UPDATE assets SET available_quantity = available_quantity - ? WHERE id = ?',
            [assetItem.quantity, assetItem.asset_id]
          )
        }
      }

      return { booking_id: bookingId }
    })

    res.success(result, '预约创建成功')
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
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM bookings b ${whereSql}`,
      params
    )

    const list = bookings.map(b => ({
      ...b,
      status_name: getStatusName(b.status)
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

    res.success({
      ...booking,
      status_name: getStatusName(booking.status),
      borrowings
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
