const express = require('express')
const { query } = require('../config/database')
const { authenticateToken } = require('../middleware/auth')

const router = express.Router()

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query

    let dateWhere = ''
    let dateParams = []
    if (start_date && end_date) {
      dateWhere = 'WHERE date >= ? AND date <= ?'
      dateParams = [start_date, end_date]
    } else if (start_date) {
      dateWhere = 'WHERE date >= ?'
      dateParams = [start_date]
    } else if (end_date) {
      dateWhere = 'WHERE date <= ?'
      dateParams = [end_date]
    }

    const [totalRooms] = await query('SELECT COUNT(*) as count FROM meeting_rooms WHERE status = 1')
    const [totalAssets] = await query('SELECT COUNT(*) as count FROM assets WHERE status = 1')
    const [totalUsers] = await query("SELECT COUNT(*) as count FROM users WHERE status = 1")
    const [totalBookings] = await query(`SELECT COUNT(*) as count FROM bookings ${dateWhere}`, dateParams)
    const [pendingBookings] = await query(`SELECT COUNT(*) as count FROM bookings ${dateWhere ? dateWhere + " AND" : "WHERE"} status = 'pending'`, dateParams)
    const [completedBookings] = await query(`SELECT COUNT(*) as count FROM bookings ${dateWhere ? dateWhere + " AND" : "WHERE"} status = 'completed'`, dateParams)
    const [cancelledBookings] = await query(`SELECT COUNT(*) as count FROM bookings ${dateWhere ? dateWhere + " AND" : "WHERE"} status = 'cancelled'`, dateParams)

    const [borrowedAssets] = await query("SELECT COUNT(*) as count FROM borrowing_records WHERE status = 'borrowed'")

    const [totalAssetQty] = await query('SELECT SUM(total_quantity) as total, SUM(available_quantity) as available FROM assets WHERE status = 1')

    const roomUsage = await query(
      `SELECT r.id, r.name, COUNT(b.id) as booking_count
       FROM meeting_rooms r
       LEFT JOIN bookings b ON r.id = b.room_id ${dateWhere ? 'AND ' + dateWhere.replace('WHERE ', '') : ''}
       WHERE r.status = 1
       GROUP BY r.id, r.name
       ORDER BY booking_count DESC
       LIMIT 5`,
      dateParams
    )

    const dailyBookings = await query(
      `SELECT date, COUNT(*) as count
       FROM bookings ${dateWhere}
       GROUP BY date
       ORDER BY date DESC
       LIMIT 14`,
      dateParams
    )

    const deptBookingCount = await query(
      `SELECT d.id, d.name, COUNT(b.id) as booking_count
       FROM departments d
       LEFT JOIN users u ON d.id = u.department_id
       LEFT JOIN bookings b ON u.id = b.user_id ${dateWhere ? 'AND ' + dateWhere.replace('WHERE ', '') : ''}
       GROUP BY d.id, d.name
       ORDER BY booking_count DESC`,
      dateParams
    )

    res.success({
      overview: {
        total_rooms: totalRooms[0].count,
        total_assets: totalAssets[0].count,
        total_users: totalUsers[0].count,
        total_bookings: totalBookings[0].count,
        pending_bookings: pendingBookings[0].count,
        completed_bookings: completedBookings[0].count,
        cancelled_bookings: cancelledBookings[0].count,
        borrowed_assets: borrowedAssets[0].count,
        total_asset_quantity: totalAssetQty[0].total || 0,
        available_asset_quantity: totalAssetQty[0].available || 0
      },
      room_usage: roomUsage,
      daily_bookings: dailyBookings,
      department_bookings: deptBookingCount
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
