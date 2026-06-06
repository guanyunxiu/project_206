const express = require('express')
const { query } = require('../config/database')
const { authenticateToken, requireAdminOrHigher } = require('../middleware/auth')

const router = express.Router()

router.get('/overview', authenticateToken, async (req, res, next) => {
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
    
    const statusWhere = dateWhere ? dateWhere.replace('WHERE ', '') : ''
    const [pendingBookings] = await query(
      `SELECT COUNT(*) as count FROM bookings ${dateWhere} ${statusWhere ? 'AND' : 'WHERE'} status = 'pending'`,
      dateParams
    )
    const [completedBookings] = await query(
      `SELECT COUNT(*) as count FROM bookings ${dateWhere} ${statusWhere ? 'AND' : 'WHERE'} status = 'completed'`,
      dateParams
    )
    const [cancelledBookings] = await query(
      `SELECT COUNT(*) as count FROM bookings ${dateWhere} ${statusWhere ? 'AND' : 'WHERE'} status = 'cancelled'`,
      dateParams
    )
    const [missedBookings] = await query(
      `SELECT COUNT(*) as count FROM bookings ${dateWhere} ${statusWhere ? 'AND' : 'WHERE'} status = 'missed'`,
      dateParams
    )

    const [pendingApprovals] = await query(
      "SELECT COUNT(*) as count FROM bookings WHERE approval_status IN ('pending_dept', 'pending_admin')"
    )

    const [borrowedAssets] = await query("SELECT COUNT(*) as count FROM borrowing_records WHERE status = 'borrowed'")
    const [overdueAssets] = await query("SELECT COUNT(*) as count FROM borrowing_records WHERE status = 'overdue'")

    const [pendingRepairs] = await query("SELECT COUNT(*) as count FROM asset_repairs WHERE status IN ('pending', 'repairing')")

    const [totalAssetQty] = await query('SELECT SUM(total_quantity) as total, SUM(available_quantity) as available, SUM(fault_quantity) as fault FROM assets WHERE status = 1')

    const [todayBookings] = await query(
      "SELECT COUNT(*) as count FROM bookings WHERE date = CURDATE()"
    )
    const [todayCheckins] = await query(
      "SELECT COUNT(*) as count FROM checkin_records WHERE DATE(checkin_time) = CURDATE()"
    )

    res.success({
      total_rooms: (totalRooms[0] || {}).count || 0,
      total_assets: (totalAssets[0] || {}).count || 0,
      total_users: (totalUsers[0] || {}).count || 0,
      total_bookings: (totalBookings[0] || {}).count || 0,
      pending_bookings: (pendingBookings[0] || {}).count || 0,
      completed_bookings: (completedBookings[0] || {}).count || 0,
      cancelled_bookings: (cancelledBookings[0] || {}).count || 0,
      missed_bookings: (missedBookings[0] || {}).count || 0,
      pending_approvals: (pendingApprovals[0] || {}).count || 0,
      borrowed_assets: (borrowedAssets[0] || {}).count || 0,
      overdue_assets: (overdueAssets[0] || {}).count || 0,
      pending_repairs: (pendingRepairs[0] || {}).count || 0,
      total_asset_quantity: (totalAssetQty[0] || {}).total || 0,
      available_asset_quantity: (totalAssetQty[0] || {}).available || 0,
      fault_asset_quantity: (totalAssetQty[0] || {}).fault || 0,
      today_bookings: (todayBookings[0] || {}).count || 0,
      today_checkins: (todayCheckins[0] || {}).count || 0
    })
  } catch (error) {
    next(error)
  }
})

router.get('/room-usage', authenticateToken, async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query

    let dateWhere = ''
    let dateParams = []
    if (start_date && end_date) {
      dateWhere = 'AND b.date >= ? AND b.date <= ?'
      dateParams = [start_date, end_date]
    } else if (start_date) {
      dateWhere = 'AND b.date >= ?'
      dateParams = [start_date]
    } else if (end_date) {
      dateWhere = 'AND b.date <= ?'
      dateParams = [end_date]
    }

    const roomUsage = await query(
      `SELECT r.id, r.name, r.capacity, r.location,
              COUNT(b.id) as booking_count,
              SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
              SUM(CASE WHEN b.status = 'missed' THEN 1 ELSE 0 END) as missed_count,
              SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
              SUM(b.attendee_count) as total_attendees
       FROM meeting_rooms r
       LEFT JOIN bookings b ON r.id = b.room_id ${dateWhere}
       WHERE r.status = 1
       GROUP BY r.id, r.name, r.capacity, r.location
       ORDER BY booking_count DESC`,
      dateParams
    )

    res.success({
      list: roomUsage
    })
  } catch (error) {
    next(error)
  }
})

router.get('/daily-bookings', authenticateToken, async (req, res, next) => {
  try {
    const { start_date, end_date, days = 30 } = req.query

    let dateWhere = ''
    let dateParams = []
    if (start_date && end_date) {
      dateWhere = 'WHERE date >= ? AND date <= ?'
      dateParams = [start_date, end_date]
    } else {
      dateWhere = 'WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'
      dateParams = [parseInt(days)]
    }

    const dailyBookings = await query(
      `SELECT date, 
              COUNT(*) as total_count,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
              SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed_count,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
       FROM bookings ${dateWhere}
       GROUP BY date
       ORDER BY date ASC`,
      dateParams
    )

    res.success({
      list: dailyBookings
    })
  } catch (error) {
    next(error)
  }
})

router.get('/hourly-usage', authenticateToken, async (req, res, next) => {
  try {
    const { date } = req.query
    const targetDate = date || new Date().toISOString().split('T')[0]

    const hourlyUsage = await query(
      `SELECT 
          HOUR(start_time) as hour,
          COUNT(*) as booking_count
       FROM bookings 
       WHERE date = ? AND status != 'cancelled'
       GROUP BY HOUR(start_time)
       ORDER BY hour ASC`,
      [targetDate]
    )

    const result = []
    for (let i = 8; i <= 20; i++) {
      const hourData = hourlyUsage.find(h => h.hour === i)
      result.push({
        hour: `${i}:00`,
        hour_num: i,
        booking_count: hourData ? hourData.booking_count : 0
      })
    }

    res.success({
      date: targetDate,
      list: result
    })
  } catch (error) {
    next(error)
  }
})

router.get('/department-bookings', authenticateToken, async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query

    let dateWhere = ''
    let dateParams = []
    if (start_date && end_date) {
      dateWhere = 'AND b.date >= ? AND b.date <= ?'
      dateParams = [start_date, end_date]
    } else if (start_date) {
      dateWhere = 'AND b.date >= ?'
      dateParams = [start_date]
    } else if (end_date) {
      dateWhere = 'AND b.date <= ?'
      dateParams = [end_date]
    }

    const deptBookingCount = await query(
      `SELECT d.id, d.name, 
              COUNT(b.id) as booking_count,
              SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
              SUM(CASE WHEN b.status = 'missed' THEN 1 ELSE 0 END) as missed_count,
              SUM(b.attendee_count) as total_attendees,
              COUNT(DISTINCT u.id) as active_users
       FROM departments d
       LEFT JOIN users u ON d.id = u.department_id
       LEFT JOIN bookings b ON u.id = b.user_id ${dateWhere}
       GROUP BY d.id, d.name
       ORDER BY booking_count DESC`,
      dateParams
    )

    res.success({
      list: deptBookingCount
    })
  } catch (error) {
    next(error)
  }
})

router.get('/asset-usage', authenticateToken, async (req, res, next) => {
  try {
    const assetUsage = await query(
      `SELECT a.id, a.name, a.category, a.total_quantity, a.available_quantity, a.fault_quantity,
              COUNT(br.id) as borrow_count,
              SUM(CASE WHEN br.status = 'borrowed' THEN 1 ELSE 0 END) as borrowed_count,
              SUM(CASE WHEN br.status = 'overdue' THEN 1 ELSE 0 END) as overdue_count
       FROM assets a
       LEFT JOIN borrowing_records br ON a.id = br.asset_id
       WHERE a.status = 1
       GROUP BY a.id, a.name, a.category, a.total_quantity, a.available_quantity, a.fault_quantity
       ORDER BY borrow_count DESC
       LIMIT 10`
    )

    const categoryStats = await query(
      `SELECT category, 
              COUNT(*) as asset_count,
              SUM(total_quantity) as total_quantity,
              SUM(available_quantity) as available_quantity
       FROM assets 
       WHERE status = 1
       GROUP BY category`
    )

    res.success({
      top_assets: assetUsage,
      category_stats: categoryStats
    })
  } catch (error) {
    next(error)
  }
})

router.get('/violation-stats', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const { days = 30 } = req.query

    const violationStats = await query(
      `SELECT uv.type, 
              COUNT(*) as count,
              COUNT(DISTINCT uv.user_id) as user_count
       FROM user_violations uv
       WHERE uv.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY uv.type`,
      [parseInt(days)]
    )

    const topViolators = await query(
      `SELECT u.id, u.real_name, d.name as department_name,
              COUNT(uv.id) as violation_count,
              SUM(CASE WHEN uv.type = 'missed' THEN 1 ELSE 0 END) as missed_count,
              SUM(CASE WHEN uv.type = 'late_return' THEN 1 ELSE 0 END) as late_return_count
       FROM user_violations uv
       LEFT JOIN users u ON uv.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE uv.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY u.id, u.real_name, d.name
       ORDER BY violation_count DESC
       LIMIT 10`,
      [parseInt(days)]
    )

    res.success({
      violation_stats: violationStats,
      top_violators: topViolators,
      days: parseInt(days)
    })
  } catch (error) {
    next(error)
  }
})

router.get('/approval-stats', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const { days = 30 } = req.query

    const approvalStats = await query(
      `SELECT ar.approver_role, ar.status,
              COUNT(*) as count
       FROM approval_records ar
       WHERE ar.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY ar.approver_role, ar.status`,
      [parseInt(days)]
    )

    const avgApprovalTime = await query(
      `SELECT 
          AVG(TIMESTAMPDIFF(MINUTE, b.created_at, ar.created_at)) as avg_minutes
       FROM bookings b
       INNER JOIN approval_records ar ON b.id = ar.booking_id
       WHERE ar.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [parseInt(days)]
    )

    const pendingByDept = await query(
      `SELECT d.name as department_name,
              COUNT(b.id) as pending_count
       FROM bookings b
       INNER JOIN users u ON b.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE b.approval_status IN ('pending_dept', 'pending_admin')
       GROUP BY d.name
       ORDER BY pending_count DESC`,
      []
    )

    res.success({
      approval_stats: approvalStats,
      avg_approval_minutes: Math.round((avgApprovalTime[0] || {}).avg_minutes || 0),
      pending_by_department: pendingByDept,
      days: parseInt(days)
    })
  } catch (error) {
    next(error)
  }
})

router.get('/real-time', authenticateToken, async (req, res, next) => {
  try {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const currentTime = now.toTimeString().split(' ')[0]

    const currentMeetings = await query(
      `SELECT b.*, r.name as room_name, r.location as room_location,
              u.real_name as user_name, d.name as department_name,
              (SELECT COUNT(*) FROM checkin_records cr WHERE cr.booking_id = b.id) as checkin_count
       FROM bookings b
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE b.date = ? 
         AND b.start_time <= ? 
         AND b.end_time >= ?
         AND b.status IN ('pending', 'in_use')
         AND b.approval_status IN ('auto_approved', 'approved')
       ORDER BY b.start_time ASC`,
      [today, currentTime, currentTime]
    )

    const upcomingMeetings = await query(
      `SELECT b.*, r.name as room_name, r.location as room_location,
              u.real_name as user_name
       FROM bookings b
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.date = ? 
         AND b.start_time > ?
         AND b.status = 'pending'
         AND b.approval_status IN ('auto_approved', 'approved')
       ORDER BY b.start_time ASC
       LIMIT 5`,
      [today, currentTime]
    )

    res.success({
      current_time: currentTime,
      current_meetings: currentMeetings,
      upcoming_meetings: upcomingMeetings
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
