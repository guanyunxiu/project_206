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
    'in_use': '使用中',
    'completed': '已完成',
    'cancelled': '已取消',
    'missed': '已爽约'
  }
  return statusMap[status] || status
}

function getApprovalStatusName(status) {
  const statusMap = {
    'auto_approved': '自动通过',
    'pending_dept': '待部门审核',
    'pending_admin': '待行政确认',
    'approved': '已通过',
    'rejected': '已驳回'
  }
  return statusMap[status] || status
}

function getMeetingTypeName(type) {
  const typeMap = {
    'normal': '普通会议',
    'large': '大型会议'
  }
  return typeMap[type] || type
}

function getCheckinMethodName(method) {
  const methodMap = {
    'qrcode': '二维码签到',
    'manual': '后台签到'
  }
  return methodMap[method] || method
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
    'resolved': '已解决',
    'cancelled': '已取消'
  }
  return statusMap[status] || status
}

function getFaultLevelName(level) {
  const levelMap = {
    'minor': '轻微',
    'major': '严重',
    'critical': '紧急'
  }
  return levelMap[level] || level
}

function getRuleTypeName(type) {
  const typeMap = {
    'missed_meeting': '爽约会议',
    'late_return': '逾期归还',
    'booking_conflict': '预约冲突',
    'over_capacity': '超容预约'
  }
  return typeMap[type] || type
}

function getPenaltyActionName(action) {
  const actionMap = {
    'warn': '警告',
    'restrict_booking': '限制预约',
    'restrict_assets': '限制借用资产',
    'disable_account': '禁用账户'
  }
  return actionMap[action] || action
}

function getViolationTypeName(type) {
  const typeMap = {
    'missed': '会议爽约',
    'late_return': '逾期归还'
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
  getMeetingTypeName,
  getCheckinMethodName,
  getBorrowStatusName,
  getRepairStatusName,
  getFaultLevelName,
  getRuleTypeName,
  getPenaltyActionName,
  getViolationTypeName,
  getAssetCategoryName,
  checkTimeConflict
}
