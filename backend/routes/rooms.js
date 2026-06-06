const express = require('express')
const { query } = require('../config/database')
const { authenticateToken } = require('../middleware/auth')
const { createPagination } = require('../utils/helper')

const router = express.Router()

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { page, pageSize, keyword, capacity, status } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = []
    let params = []

    if (keyword) {
      whereClauses.push('(name LIKE ? OR location LIKE ? OR facilities LIKE ?)')
      const keywordParam = `%${keyword}%`
      params.push(keywordParam, keywordParam, keywordParam)
    }
    if (capacity) {
      whereClauses.push('capacity >= ?')
      params.push(parseInt(capacity))
    }
    if (status !== undefined) {
      whereClauses.push('status = ?')
      params.push(parseInt(status))
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const rooms = await query(
      `SELECT * FROM meeting_rooms ${whereSql} ORDER BY id ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM meeting_rooms ${whereSql}`,
      params
    )

    res.success({
      list: rooms,
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

    const rooms = await query('SELECT * FROM meeting_rooms WHERE id = ?', [id])

    if (rooms.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '会议室不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const room = rooms[0]
    if (room.facilities) {
      room.facilities_list = room.facilities.split(',').map(f => f.trim()).filter(f => f)
    }

    res.success(room)
  } catch (error) {
    next(error)
  }
})

router.get('/:id/schedule', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const { date } = req.query

    if (!date) {
      return res.status(400).json({
        code: 400,
        message: '请指定查询日期',
        data: null,
        timestamp: Date.now()
      })
    }

    const rooms = await query('SELECT * FROM meeting_rooms WHERE id = ?', [id])
    if (rooms.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '会议室不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const bookings = await query(
      `SELECT b.id, b.user_id, b.meeting_title, b.date, b.start_time, b.end_time, b.status,
              u.real_name as user_name
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.room_id = ? AND b.date = ? AND b.status != 'cancelled'
       ORDER BY b.start_time ASC`,
      [id, date]
    )

    const timeSlots = []
    for (let hour = 8; hour < 20; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
        timeSlots.push({
          time,
          available: true,
          booking: null
        })
      }
    }

    for (const booking of bookings) {
      const startMin = parseInt(booking.start_time.split(':')[0]) * 60 + parseInt(booking.start_time.split(':')[1])
      const endMin = parseInt(booking.end_time.split(':')[0]) * 60 + parseInt(booking.end_time.split(':')[1])

      for (let i = 0; i < timeSlots.length; i++) {
        const slotMin = parseInt(timeSlots[i].time.split(':')[0]) * 60 + parseInt(timeSlots[i].time.split(':')[1])
        if (slotMin >= startMin && slotMin < endMin) {
          timeSlots[i].available = false
          timeSlots[i].booking = {
            id: booking.id,
            title: booking.meeting_title,
            user_name: booking.user_name,
            status: booking.status
          }
        }
      }
    }

    res.success({
      room: rooms[0],
      date,
      time_slots: timeSlots,
      bookings
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
