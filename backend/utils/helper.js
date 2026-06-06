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
    'cancelled': '已取消'
  }
  return statusMap[status] || status
}

function getBorrowStatusName(status) {
  const statusMap = {
    'borrowed': '借用中',
    'returned': '已归还'
  }
  return statusMap[status] || status
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
  getBorrowStatusName,
  getAssetCategoryName,
  checkTimeConflict
}
