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
    const [approvedBookings] = await query(`SELECT COUNT(*) as count FROM bookings ${dateWhere ? dateWhere + " AND" : "WHERE"} status = 'approved'`, dateParams)
    const [completedBookings] = await query(`SELECT COUNT(*) as count FROM bookings ${dateWhere ? dateWhere + " AND" : "WHERE"} status = 'completed'`, dateParams)
    const [cancelledBookings] = await query(`SELECT COUNT(*) as count FROM bookings ${dateWhere ? dateWhere + " AND" : "WHERE"} status = 'cancelled'`, dateParams)
    const [noShowBookings] = await query(`SELECT COUNT(*) as count FROM bookings ${dateWhere ? dateWhere + " AND" : "WHERE"} status = 'no_show'`, dateParams)
    const [pendingApproval] = await query(`SELECT COUNT(*) as count FROM bookings ${dateWhere ? dateWhere + " AND" : "WHERE"} approval_status IN ('pending_dept', 'pending_admin')`, dateParams)

    const [borrowedAssets] = await query("SELECT COUNT(*) as count FROM borrowing_records WHERE status = 'borrowed'")
    const [overdueAssets] = await query("SELECT COUNT(*) as count FROM borrowing_records WHERE status = 'overdue'")
    const [pendingRepairs] = await query("SELECT COUNT(*) as count FROM asset_repairs WHERE status IN ('pending', 'repairing')")

    const [totalAssetQty] = await query('SELECT SUM(total_quantity) as total, SUM(available_quantity) as available, SUM(fault_quantity) as fault FROM assets WHERE status = 1')

    const roomUsage = await query(
      `SELECT r.id, r.name, r.room_type, r.capacity, COUNT(b.id) as booking_count,
              SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
              SUM(CASE WHEN b.status = 'no_show' THEN 1 ELSE 0 END) as no_show_count
       FROM meeting_rooms r
       LEFT JOIN bookings b ON r.id = b.room_id ${dateWhere ? 'AND ' + dateWhere.replace('WHERE ', '') : ''}
       WHERE r.status = 1
       GROUP BY r.id, r.name, r.room_type, r.capacity
       ORDER BY booking_count DESC
       LIMIT 10`,
      dateParams
    )

    const dailyBookings = await query(
      `SELECT date, COUNT(*) as count,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
              SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_show_count
       FROM bookings ${dateWhere}
       GROUP BY date
       ORDER BY date DESC
       LIMIT 30`,
      dateParams
    )

    const deptBookingCount = await query(
      `SELECT d.id, d.name, COUNT(b.id) as booking_count,
              SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed_count
       FROM departments d
       LEFT JOIN users u ON d.id = u.department_id
       LEFT JOIN bookings b ON u.id = b.user_id ${dateWhere ? 'AND ' + dateWhere.replace('WHERE ', '') : ''}
       GROUP BY d.id, d.name
       ORDER BY booking_count DESC`,
      dateParams
    )

    const approvalStats = await query(
      `SELECT approval_status, COUNT(*) as count 
       FROM bookings 
       ${dateWhere}
       GROUP BY approval_status`,
      dateParams
    )

    const checkinStats = await query(
      `SELECT checkin_status, COUNT(*) as count 
       FROM bookings 
       ${dateWhere ? dateWhere + ' AND' : 'WHERE'} checkin_status IS NOT NULL
       GROUP BY checkin_status`,
      dateParams
    )

    const violationStats = await query(
      `SELECT v.violation_type, COUNT(*) as count, u.real_name, u.username
       FROM violation_records v
       LEFT JOIN users u ON v.user_id = u.id
       LEFT JOIN bookings b ON v.booking_id = b.id
       ${dateWhere ? 'WHERE ' + dateWhere.replace('WHERE ', '') + ' AND b.id IS NOT NULL' : ''}
       GROUP BY v.violation_type, v.user_id, u.real_name, u.username
       ORDER BY count DESC
       LIMIT 10`,
      dateParams
    )

    const timeSlotStats = await query(
      `SELECT 
        CASE 
          WHEN TIME(start_time) < '10:00:00' THEN '上午(08:00-10:00)'
          WHEN TIME(start_time) < '12:00:00' THEN '上午(10:00-12:00)'
          WHEN TIME(start_time) < '14:00:00' THEN '下午(12:00-14:00)'
          WHEN TIME(start_time) < '16:00:00' THEN '下午(14:00-16:00)'
          WHEN TIME(start_time) < '18:00:00' THEN '下午(16:00-18:00)'
          ELSE '晚间(18:00以后)'
        END as time_slot,
        COUNT(*) as booking_count
       FROM bookings ${dateWhere}
       GROUP BY time_slot
       ORDER BY booking_count DESC`,
      dateParams
    )

    const assetUsageStats = await query(
      `SELECT a.id, a.name, a.category, 
              COUNT(DISTINCT l.id) as usage_count,
              SUM(CASE WHEN l.action = 'borrow' THEN l.quantity ELSE 0 END) as total_borrowed
       FROM assets a
       LEFT JOIN asset_usage_logs l ON a.id = l.asset_id
       WHERE a.status = 1
       GROUP BY a.id, a.name, a.category
       ORDER BY total_borrowed DESC
       LIMIT 10`
    )

    const topUsers = await query(
      `SELECT u.id, u.real_name, u.username, d.name as department_name,
              COUNT(b.id) as booking_count,
              SUM(CASE WHEN b.status = 'no_show' THEN 1 ELSE 0 END) as no_show_count
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN bookings b ON u.id = b.user_id ${dateWhere ? 'AND ' + dateWhere.replace('WHERE ', '') : ''}
       WHERE u.status = 1
       GROUP BY u.id, u.real_name, u.username, d.name
       ORDER BY booking_count DESC
       LIMIT 10`,
      dateParams
    )

    const today = new Date().toISOString().split('T')[0]
    const todayBookings = await query(
      `SELECT b.*, r.name as room_name, r.location as room_location,
              u.real_name as user_name, d.name as department_name
       FROM bookings b
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE b.date = ?
       ORDER BY b.start_time ASC`,
      [today]
    )

    const anomalies = await query(
      `SELECT 'high_no_show' as type, d.name as department_name, 
              COUNT(v.id) as count, '高爽约率' as description
       FROM violation_records v
       LEFT JOIN users u ON v.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE v.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY d.name
       HAVING count > 3
       UNION ALL
       SELECT 'overdue_asset' as type, a.name as department_name,
              COUNT(br.id) as count, '资产逾期未还' as description
       FROM borrowing_records br
       LEFT JOIN assets a ON br.asset_id = a.id
       WHERE br.status IN ('borrowed', 'overdue')
       AND br.expected_return_date < CURDATE()
       GROUP BY a.name
       UNION ALL
       SELECT 'pending_repair' as type, a.name as department_name,
              COUNT(ar.id) as count, '资产待维修' as description
       FROM asset_repairs ar
       LEFT JOIN assets a ON ar.asset_id = a.id
       WHERE ar.status IN ('pending', 'repairing')
       GROUP BY a.name
       UNION ALL
       SELECT 'pending_approval' as type, d.name as department_name,
              COUNT(b.id) as count, '预约待审批' as description
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE b.approval_status IN ('pending_dept', 'pending_admin')
       AND b.created_at >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
       GROUP BY d.name`
    )

    res.success({
      overview: {
        total_rooms: (totalRooms[0] || {}).count || 0,
        total_assets: (totalAssets[0] || {}).count || 0,
        total_users: (totalUsers[0] || {}).count || 0,
        total_bookings: (totalBookings[0] || {}).count || 0,
        pending_bookings: (pendingBookings[0] || {}).count || 0,
        approved_bookings: (approvedBookings[0] || {}).count || 0,
        completed_bookings: (completedBookings[0] || {}).count || 0,
        cancelled_bookings: (cancelledBookings[0] || {}).count || 0,
        no_show_bookings: (noShowBookings[0] || {}).count || 0,
        pending_approval: (pendingApproval[0] || {}).count || 0,
        borrowed_assets: (borrowedAssets[0] || {}).count || 0,
        overdue_assets: (overdueAssets[0] || {}).count || 0,
        pending_repairs: (pendingRepairs[0] || {}).count || 0,
        total_asset_quantity: (totalAssetQty[0] || {}).total || 0,
        available_asset_quantity: (totalAssetQty[0] || {}).available || 0,
        fault_asset_quantity: (totalAssetQty[0] || {}).fault || 0
      },
      room_usage: roomUsage,
      daily_bookings: dailyBookings,
      department_bookings: deptBookingCount,
      approval_stats: approvalStats,
      checkin_stats: checkinStats,
      violation_stats: violationStats,
      time_slot_stats: timeSlotStats,
      asset_usage_stats: assetUsageStats,
      top_users: topUsers,
      today_bookings: todayBookings,
      anomalies: anomalies
    })
  } catch (error) {
    next(error)
  }
})

router.get('/dashboard', authenticateToken, async (req, res, next) => {
  try {
    const userRole = req.user.role
    const userId = req.user.id
    const deptId = req.user.department_id

    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    let myBookingCount = 0
    let pendingMyApproval = 0

    const [myBookings] = await query(
      'SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND date >= ?',
      [userId, sevenDaysAgo]
    )
    myBookingCount = (myBookings[0] || {}).count || 0

    if (['dept_admin', 'admin', 'super_admin'].includes(userRole)) {
      let whereClause = "WHERE approval_status IN ('pending_dept', 'pending_admin')"
      let params = []
      
      if (userRole === 'dept_admin') {
        whereClause += " AND EXISTS (SELECT 1 FROM users u WHERE u.id = b.user_id AND u.department_id = ? AND approval_status = 'pending_dept')"
        params = [deptId]
      }
      
      const [pending] = await query(
        `SELECT COUNT(*) as count FROM bookings b ${whereClause}`,
        params
      )
      pendingMyApproval = (pending[0] || {}).count || 0
    }

    const [myViolations] = await query(
      'SELECT COUNT(*) as count, violation_count FROM users u LEFT JOIN violation_records v ON u.id = v.user_id WHERE u.id = ?',
      [userId]
    )

    const [notifications] = await query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    )

    const [todayAllBookings] = await query(
      `SELECT COUNT(*) as count,
              SUM(CASE WHEN checkin_status = 'checked_in' THEN 1 ELSE 0 END) as checked_in,
              SUM(CASE WHEN checkin_status = 'no_show' THEN 1 ELSE 0 END) as no_show
       FROM bookings WHERE date = ?`,
      [today]
    )

    const [weekStats] = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_show
       FROM bookings WHERE date >= ? AND date <= ?`,
      [sevenDaysAgo, today]
    )

    const upcomingBookings = await query(
      `SELECT b.*, r.name as room_name, r.location as room_location
       FROM bookings b
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       WHERE b.user_id = ? AND b.date >= ? AND b.status IN ('approved', 'pending')
       ORDER BY b.date ASC, b.start_time ASC
       LIMIT 5`,
      [userId, today]
    )

    res.success({
      my_booking_count: myBookingCount,
      pending_my_approval: pendingMyApproval,
      my_violation_count: (myViolations[0] || {}).violation_count || 0,
      unread_notifications: (notifications[0] || {}).unread_count || 0,
      today_stats: todayAllBookings[0] || {},
      week_stats: weekStats[0] || {},
      upcoming_bookings: upcomingBookings
    })
  } catch (error) {
    next(error)
  }
})

router.get('/anomalies', authenticateToken, async (req, res, next) => {
  try {
    const userRole = req.user.role

    if (!['admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '无权查看异常数据',
        data: null,
        timestamp: Date.now()
      })
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const highNoShowDepts = await query(
      `SELECT d.id, d.name, COUNT(v.id) as violation_count,
              (COUNT(v.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM bookings b WHERE b.user_id IN (SELECT id FROM users WHERE department_id = d.id) AND b.date >= ?), 0)) as violation_rate
       FROM violation_records v
       LEFT JOIN users u ON v.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE v.created_at >= ?
       AND v.violation_type = 'no_show'
       GROUP BY d.id, d.name
       HAVING violation_count > 2
       ORDER BY violation_rate DESC`,
      [sevenDaysAgo, sevenDaysAgo]
    )

    const overdueAssets = await query(
      `SELECT br.id, a.name as asset_name, a.category, br.quantity,
              br.expected_return_date, br.borrowed_at,
              u.real_name as user_name, u.username, u.phone, u.email,
              DATEDIFF(CURDATE(), br.expected_return_date) as overdue_days,
              b.meeting_title
       FROM borrowing_records br
       LEFT JOIN assets a ON br.asset_id = a.id
       LEFT JOIN users u ON br.user_id = u.id
       LEFT JOIN bookings b ON br.booking_id = b.id
       WHERE br.status IN ('borrowed', 'overdue')
       AND br.expected_return_date < CURDATE()
       ORDER BY overdue_days DESC`
    )

    const pendingRepairs = await query(
      `SELECT ar.id, a.name as asset_name, a.category, ar.quantity,
              ar.description, ar.created_at, ar.status,
              u.real_name as reporter_name
       FROM asset_repairs ar
       LEFT JOIN assets a ON ar.asset_id = a.id
       LEFT JOIN users u ON ar.reporter_id = u.id
       WHERE ar.status IN ('pending', 'repairing')
       ORDER BY ar.created_at ASC`
    )

    const pendingApprovals = await query(
      `SELECT b.id, b.meeting_title, b.date, b.start_time, b.end_time,
              r.name as room_name, u.real_name as user_name,
              d.name as department_name, b.approval_status, b.created_at,
              TIMESTAMPDIFF(HOUR, b.created_at, NOW()) as pending_hours
       FROM bookings b
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE b.approval_status IN ('pending_dept', 'pending_admin')
       ORDER BY pending_hours DESC`
    )

    const frequentNoShowUsers = await query(
      `SELECT u.id, u.real_name, u.username, d.name as department_name,
              COUNT(v.id) as violation_count, u.violation_count
       FROM users u
       LEFT JOIN violation_records v ON u.id = v.user_id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE v.created_at >= ?
       AND v.violation_type = 'no_show'
       GROUP BY u.id, u.real_name, u.username, d.name, u.violation_count
       HAVING violation_count >= 2
       ORDER BY u.violation_count DESC`,
      [sevenDaysAgo]
    )

    res.success({
      high_no_show_departments: highNoShowDepts,
      overdue_assets: overdueAssets,
      pending_repairs: pendingRepairs,
      pending_approvals: pendingApprovals,
      frequent_no_show_users: frequentNoShowUsers
    })
  } catch (error) {
    next(error)
  }
})

router.get('/settings', authenticateToken, async (req, res, next) => {
  try {
    const userRole = req.user.role

    if (!['admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '无权查看系统设置',
        data: null,
        timestamp: Date.now()
      })
    }

    const settings = await query('SELECT * FROM system_settings ORDER BY id ASC')

    res.success({ list: settings })
  } catch (error) {
    next(error)
  }
})

router.put('/settings', authenticateToken, async (req, res, next) => {
  try {
    const userRole = req.user.role
    const { settings } = req.body

    if (!['super_admin'].includes(userRole)) {
      return res.status(403).json({
        code: 403,
        message: '只有超级管理员可以修改系统设置',
        data: null,
        timestamp: Date.now()
      })
    }

    if (!settings || !Array.isArray(settings)) {
      return res.status(400).json({
        code: 400,
        message: '请提供设置数据',
        data: null,
        timestamp: Date.now()
      })
    }

    for (const setting of settings) {
      if (setting.setting_key && setting.setting_value !== undefined) {
        await query(
          'UPDATE system_settings SET setting_value = ?, description = ? WHERE setting_key = ?',
          [setting.setting_value, setting.description || '', setting.setting_key]
        )
      }
    }

    res.success(null, '系统设置已更新')
  } catch (error) {
    next(error)
  }
})

module.exports = router
