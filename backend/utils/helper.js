const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

function generateToken(userId, role, secret, expiresIn = '24h') {
  return jwt.sign(
    { id: userId, role },
    secret,
    { expiresIn }
  )
}

async function hashPassword(password) {
  return await bcrypt.hash(password, 10)
}

async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash)
}

function createPagination(page = 1, pageSize = 10) {
  const p = Math.max(1, parseInt(page) || 1)
  const ps = Math.max(1, Math.min(100, parseInt(pageSize) || 10))
  const offset = (p - 1) * ps
  return { page: p, pageSize: ps, offset, limit: ps }
}

function getRoleName(role) {
  const roleMap = {
    'employee': '普通员工',
    'dept_admin': '部门管理员',
    'admin': '行政管理员',
    'super_admin': '超级管理员'
  }
  return roleMap[role] || role
}

function getStatusName(status) {
  const statusMap = {
    'pending': '待使用',
    'pending_approval': '待审批',
    'approved': '已通过',
    'rejected': '已拒绝',
    'in_use': '使用中',
    'completed': '已完成',
    'cancelled': '已取消',
    'no_show': '已爽约'
  }
  return statusMap[status] || status
}

function getApprovalStatusName(status) {
  const statusMap = {
    'auto_approved': '自动通过',
    'pending_dept': '待部门审批',
    'pending_admin': '待行政确认',
    'approved': '已通过',
    'rejected': '已拒绝'
  }
  return statusMap[status] || status
}

function getCheckinStatusName(status) {
  const statusMap = {
    'pending': '待签到',
    'checked_in': '已签到',
    'no_show': '未签到'
  }
  return statusMap[status] || status
}

function getCheckinMethodName(method) {
  const methodMap = {
    'qrcode': '二维码签到',
    'manual': '后台签到'
  }
  return methodMap[method] || method
}

function getViolationTypeName(type) {
  const typeMap = {
    'no_show': '未签到爽约',
    'late_cancel': '临时取消',
    'other': '其他违规'
  }
  return typeMap[type] || type
}

function getBorrowStatusName(status) {
  const statusMap = {
    'borrowed': '借用中',
    'returned': '已归还',
    'overdue': '已逾期'
  }
  return statusMap[status] || status
}

function getRepairStatusName(status) {
  const statusMap = {
    'pending': '待处理',
    'repairing': '维修中',
    'completed': '已完成',
    'cancelled': '已取消'
  }
  return statusMap[status] || status
}

function getAssetActionName(action) {
  const actionMap = {
    'borrow': '借用',
    'return': '归还',
    'repair': '报修',
    'repair_complete': '维修完成'
  }
  return actionMap[action] || action
}

function getRoomTypeName(type) {
  const typeMap = {
    'small': '小型会议室',
    'medium': '中型会议室',
    'large': '大型会议室',
    'training': '培训室'
  }
  return typeMap[type] || type
}

function getNotificationTypeName(type) {
  const typeMap = {
    'approval': '审批通知',
    'checkin': '签到提醒',
    'asset': '资产通知',
    'system': '系统通知'
  }
  return typeMap[type] || type
}

function getAssetCategoryName(category) {
  const categoryMap = {
    'projector': '投影仪',
    'camera': '摄像机',
    'whiteboard': '白板',
    'microphone': '麦克风',
    'other': '其他'
  }
  return categoryMap[category] || category
}

function checkTimeConflict(existingBookings, newStart, newEnd, excludeId = null) {
  const toMinutes = (time) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const newStartMin = toMinutes(newStart)
  const newEndMin = toMinutes(newEnd)

  for (const booking of existingBookings) {
    if (excludeId && booking.id === excludeId) continue
    if (booking.status === 'cancelled') continue

    const existStartMin = toMinutes(booking.start_time)
    const existEndMin = toMinutes(booking.end_time)

    if (newStartMin < existEndMin && newEndMin > existStartMin) {
      return {
        conflict: true,
        conflictBooking: booking
      }
    }
  }

  return { conflict: false }
}

module.exports = {
  generateToken,
  hashPassword,
  comparePassword,
  createPagination,
  getRoleName,
  getStatusName,
  getApprovalStatusName,
  getCheckinStatusName,
  getCheckinMethodName,
  getViolationTypeName,
  getBorrowStatusName,
  getRepairStatusName,
  getAssetActionName,
  getAssetCategoryName,
  getRoomTypeName,
  getNotificationTypeName,
  checkTimeConflict
}
