const express = require('express')
const { query, transaction } = require('../config/database')
const { authenticateToken, requireDeptAdminOrHigher, requireAdminOrHigher, requireSuperAdmin } = require('../middleware/auth')
const { createPagination, getRoleName, getStatusName, hashPassword, getAssetCategoryName, getCheckinMethodName } = require('../utils/helper')

const router = express.Router()

router.get('/rooms', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { page, pageSize, keyword, status } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = []
    let params = []

    if (keyword) {
      whereClauses.push('(name LIKE ? OR location LIKE ?)')
      const keywordParam = `%${keyword}%`
      params.push(keywordParam, keywordParam)
    }
    if (status !== undefined && status !== '') {
      whereClauses.push('status = ?')
      params.push(parseInt(status))
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const rooms = await query(
      `SELECT * FROM meeting_rooms ${whereSql} ORDER BY id DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
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

router.post('/rooms', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { name, capacity, location, facilities, description, image_url, status } = req.body

    if (!name || !capacity || !location) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整的会议室信息',
        data: null,
        timestamp: Date.now()
      })
    }

    const [result] = await query(
      `INSERT INTO meeting_rooms (name, capacity, location, facilities, description, image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, parseInt(capacity), location, facilities || '', description || '', image_url || '', status !== undefined ? parseInt(status) : 1]
    )

    res.success({ id: result.insertId }, '会议室创建成功')
  } catch (error) {
    next(error)
  }
})

router.put('/rooms/:id', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, capacity, location, facilities, description, image_url, status } = req.body

    const rooms = await query('SELECT * FROM meeting_rooms WHERE id = ?', [id])
    if (rooms.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '会议室不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const updates = []
    const values = []

    if (name) {
      updates.push('name = ?')
      values.push(name)
    }
    if (capacity !== undefined) {
      updates.push('capacity = ?')
      values.push(parseInt(capacity))
    }
    if (location) {
      updates.push('location = ?')
      values.push(location)
    }
    if (facilities !== undefined) {
      updates.push('facilities = ?')
      values.push(facilities)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description)
    }
    if (image_url !== undefined) {
      updates.push('image_url = ?')
      values.push(image_url)
    }
    if (status !== undefined) {
      updates.push('status = ?')
      values.push(parseInt(status))
    }

    if (updates.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '没有需要更新的字段',
        data: null,
        timestamp: Date.now()
      })
    }

    values.push(id)
    await query(`UPDATE meeting_rooms SET ${updates.join(', ')} WHERE id = ?`, values)

    res.success(null, '会议室更新成功')
  } catch (error) {
    next(error)
  }
})

router.delete('/rooms/:id', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
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

    const activeBookings = await query(
      "SELECT COUNT(*) as count FROM bookings WHERE room_id = ? AND status IN ('pending', 'in_use')",
      [id]
    )
    if (activeBookings[0].count > 0) {
      return res.status(400).json({
        code: 400,
        message: '该会议室存在未完成的预约，无法删除',
        data: null,
        timestamp: Date.now()
      })
    }

    await query('DELETE FROM meeting_rooms WHERE id = ?', [id])

    res.success(null, '会议室删除成功')
  } catch (error) {
    next(error)
  }
})

router.get('/assets', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { page, pageSize, keyword, category, status } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = []
    let params = []

    if (keyword) {
      whereClauses.push('(name LIKE ? OR description LIKE ?)')
      const keywordParam = `%${keyword}%`
      params.push(keywordParam, keywordParam)
    }
    if (category) {
      whereClauses.push('category = ?')
      params.push(category)
    }
    if (status !== undefined && status !== '') {
      whereClauses.push('status = ?')
      params.push(parseInt(status))
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const assets = await query(
      `SELECT * FROM assets ${whereSql} ORDER BY id DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const list = assets.map(a => ({
      ...a,
      category_name: getAssetCategoryName(a.category)
    }))

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM assets ${whereSql}`,
      params
    )

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

router.post('/assets', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { name, category, description, total_quantity, status } = req.body

    if (!name || !category || total_quantity === undefined) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整的资产信息',
        data: null,
        timestamp: Date.now()
      })
    }

    const totalQty = parseInt(total_quantity)

    const [result] = await query(
      `INSERT INTO assets (name, category, description, total_quantity, available_quantity, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, category, description || '', totalQty, totalQty, status !== undefined ? parseInt(status) : 1]
    )

    res.success({ id: result.insertId }, '资产创建成功')
  } catch (error) {
    next(error)
  }
})

router.put('/assets/:id', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, category, description, total_quantity, status } = req.body

    const assets = await query('SELECT * FROM assets WHERE id = ?', [id])
    if (assets.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '资产不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const updates = []
    const values = []
    let availableAdjustment = 0
    let oldTotal = assets[0].total_quantity

    if (name) {
      updates.push('name = ?')
      values.push(name)
    }
    if (category) {
      updates.push('category = ?')
      values.push(category)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description)
    }
    if (total_quantity !== undefined) {
      const newTotal = parseInt(total_quantity)
      availableAdjustment = newTotal - oldTotal
      updates.push('total_quantity = ?')
      values.push(newTotal)
    }
    if (status !== undefined) {
      updates.push('status = ?')
      values.push(parseInt(status))
    }

    if (updates.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '没有需要更新的字段',
        data: null,
        timestamp: Date.now()
      })
    }

    if (availableAdjustment !== 0) {
      updates.push('available_quantity = available_quantity + ?')
      values.push(availableAdjustment)
    }

    values.push(id)
    await query(`UPDATE assets SET ${updates.join(', ')} WHERE id = ?`, values)

    res.success(null, '资产更新成功')
  } catch (error) {
    next(error)
  }
})

router.delete('/assets/:id', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { id } = req.params

    const assets = await query('SELECT * FROM assets WHERE id = ?', [id])
    if (assets.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '资产不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const activeBorrowings = await query(
      "SELECT COUNT(*) as count FROM borrowing_records WHERE asset_id = ? AND status = 'borrowed'",
      [id]
    )
    if (activeBorrowings[0].count > 0) {
      return res.status(400).json({
        code: 400,
        message: '该资产存在未归还的借用，无法删除',
        data: null,
        timestamp: Date.now()
      })
    }

    await query('DELETE FROM assets WHERE id = ?', [id])

    res.success(null, '资产删除成功')
  } catch (error) {
    next(error)
  }
})

router.get('/assets/borrowings', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { page, pageSize, status, asset_id, user_id } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = []
    let params = []

    if (status) {
      whereClauses.push('br.status = ?')
      params.push(status)
    }
    if (asset_id) {
      whereClauses.push('br.asset_id = ?')
      params.push(parseInt(asset_id))
    }
    if (user_id) {
      whereClauses.push('br.user_id = ?')
      params.push(parseInt(user_id))
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const borrowings = await query(
      `SELECT br.*, a.name as asset_name, a.category as asset_category,
              u.real_name as user_name, u.username,
              b.meeting_title, b.date, b.start_time, b.end_time
       FROM borrowing_records br
       LEFT JOIN assets a ON br.asset_id = a.id
       LEFT JOIN users u ON br.user_id = u.id
       LEFT JOIN bookings b ON br.booking_id = b.id
       ${whereSql}
       ORDER BY br.borrowed_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const list = borrowings.map(br => ({
      ...br,
      status_name: getBorrowStatusName(br.status),
      asset_category_name: getAssetCategoryName(br.asset_category)
    }))

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM borrowing_records br ${whereSql}`,
      params
    )

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

router.get('/bookings', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { page, pageSize, status, room_id, user_id, date_from, date_to } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = []
    let params = []

    if (status) {
      whereClauses.push('b.status = ?')
      params.push(status)
    }
    if (room_id) {
      whereClauses.push('b.room_id = ?')
      params.push(parseInt(room_id))
    }
    if (user_id) {
      whereClauses.push('b.user_id = ?')
      params.push(parseInt(user_id))
    }
    if (date_from) {
      whereClauses.push('b.date >= ?')
      params.push(date_from)
    }
    if (date_to) {
      whereClauses.push('b.date <= ?')
      params.push(date_to)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const bookings = await query(
      `SELECT b.*, r.name as room_name, r.location as room_location,
              u.real_name as user_name, u.username, d.name as department_name
       FROM bookings b
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       ${whereSql}
       ORDER BY b.date DESC, b.start_time DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const list = bookings.map(b => ({
      ...b,
      status_name: getStatusName(b.status)
    }))

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM bookings b ${whereSql}`,
      params
    )

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

router.get('/users', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const { page, pageSize, keyword, role, status, department_id } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = []
    let params = []

    if (keyword) {
      whereClauses.push('(u.username LIKE ? OR u.real_name LIKE ? OR u.email LIKE ?)')
      const keywordParam = `%${keyword}%`
      params.push(keywordParam, keywordParam, keywordParam)
    }
    if (role) {
      whereClauses.push('u.role = ?')
      params.push(role)
    }
    if (status !== undefined && status !== '') {
      whereClauses.push('u.status = ?')
      params.push(parseInt(status))
    }
    if (department_id) {
      whereClauses.push('u.department_id = ?')
      params.push(parseInt(department_id))
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const users = await query(
      `SELECT u.id, u.username, u.real_name, u.email, u.phone, u.avatar, u.role, u.status,
              u.department_id, d.name as department_name, u.created_at
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       ${whereSql}
       ORDER BY u.id DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const list = users.map(u => ({
      ...u,
      role_name: getRoleName(u.role)
    }))

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM users u ${whereSql}`,
      params
    )

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

router.post('/users', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const { username, password, real_name, email, phone, department_id, role, status } = req.body

    if (!username || !password || !real_name) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整的用户信息',
        data: null,
        timestamp: Date.now()
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        code: 400,
        message: '密码长度不能少于6位',
        data: null,
        timestamp: Date.now()
      })
    }

    const existingUsers = await query('SELECT id FROM users WHERE username = ?', [username])
    if (existingUsers.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '用户名已存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const hashedPassword = await hashPassword(password)

    const [result] = await query(
      `INSERT INTO users (username, password, real_name, email, phone, department_id, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, real_name, email || '', phone || '', department_id || null, role || 'employee', status !== undefined ? parseInt(status) : 1]
    )

    res.success({ id: result.insertId }, '用户创建成功')
  } catch (error) {
    next(error)
  }
})

router.put('/users/:id', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const { id } = req.params
    const { real_name, email, phone, department_id, role, status, password } = req.body

    const users = await query('SELECT * FROM users WHERE id = ?', [id])
    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const updates = []
    const values = []

    if (real_name) {
      updates.push('real_name = ?')
      values.push(real_name)
    }
    if (email !== undefined) {
      updates.push('email = ?')
      values.push(email)
    }
    if (phone !== undefined) {
      updates.push('phone = ?')
      values.push(phone)
    }
    if (department_id !== undefined) {
      updates.push('department_id = ?')
      values.push(department_id || null)
    }
    if (role) {
      updates.push('role = ?')
      values.push(role)
    }
    if (status !== undefined) {
      updates.push('status = ?')
      values.push(parseInt(status))
    }
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          code: 400,
          message: '密码长度不能少于6位',
          data: null,
          timestamp: Date.now()
        })
      }
      const hashedPassword = await hashPassword(password)
      updates.push('password = ?')
      values.push(hashedPassword)
    }

    if (updates.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '没有需要更新的字段',
        data: null,
        timestamp: Date.now()
      })
    }

    values.push(id)
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values)

    res.success(null, '用户更新成功')
  } catch (error) {
    next(error)
  }
})

router.delete('/users/:id', authenticateToken, requireSuperAdmin(), async (req, res, next) => {
  try {
    const { id } = req.params
    const currentUserId = req.user.id

    if (parseInt(id) === parseInt(currentUserId)) {
      return res.status(400).json({
        code: 400,
        message: '不能删除自己',
        data: null,
        timestamp: Date.now()
      })
    }

    const users = await query('SELECT * FROM users WHERE id = ?', [id])
    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    if (users[0].role === 'super_admin') {
      const superAdmins = await query("SELECT COUNT(*) as count FROM users WHERE role = 'super_admin'")
      if (superAdmins[0].count <= 1) {
        return res.status(400).json({
          code: 400,
          message: '至少需要保留一个超级管理员',
          data: null,
          timestamp: Date.now()
        })
      }
    }

    await query('DELETE FROM users WHERE id = ?', [id])

    res.success(null, '用户删除成功')
  } catch (error) {
    next(error)
  }
})

router.get('/departments', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const departments = await query('SELECT * FROM departments ORDER BY id ASC')

    const list = []
    for (const dept of departments) {
      const [userCount] = await query('SELECT COUNT(*) as user_count FROM users WHERE department_id = ?', [dept.id])
      list.push({
        ...dept,
        user_count: userCount.user_count
      })
    }

    res.success({ list, total: list.length })
  } catch (error) {
    next(error)
  }
})

router.post('/departments', authenticateToken, requireSuperAdmin(), async (req, res, next) => {
  try {
    const { name, description } = req.body

    if (!name) {
      return res.status(400).json({
        code: 400,
        message: '部门名称不能为空',
        data: null,
        timestamp: Date.now()
      })
    }

    const existingDepts = await query('SELECT id FROM departments WHERE name = ?', [name])
    if (existingDepts.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '部门名称已存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const [result] = await query(
      'INSERT INTO departments (name, description) VALUES (?, ?)',
      [name, description || '']
    )

    res.success({ id: result.insertId }, '部门创建成功')
  } catch (error) {
    next(error)
  }
})

router.put('/departments/:id', authenticateToken, requireSuperAdmin(), async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, description } = req.body

    const depts = await query('SELECT * FROM departments WHERE id = ?', [id])
    if (depts.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '部门不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const updates = []
    const values = []

    if (name) {
      const existingDepts = await query('SELECT id FROM departments WHERE name = ? AND id != ?', [name, id])
      if (existingDepts.length > 0) {
        return res.status(400).json({
          code: 400,
          message: '部门名称已存在',
          data: null,
          timestamp: Date.now()
        })
      }
      updates.push('name = ?')
      values.push(name)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description)
    }

    if (updates.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '没有需要更新的字段',
        data: null,
        timestamp: Date.now()
      })
    }

    values.push(id)
    await query(`UPDATE departments SET ${updates.join(', ')} WHERE id = ?`, values)

    res.success(null, '部门更新成功')
  } catch (error) {
    next(error)
  }
})

router.delete('/departments/:id', authenticateToken, requireSuperAdmin(), async (req, res, next) => {
  try {
    const { id } = req.params

    const depts = await query('SELECT * FROM departments WHERE id = ?', [id])
    if (depts.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '部门不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const users = await query('SELECT COUNT(*) as count FROM users WHERE department_id = ?', [id])
    if (users[0].count > 0) {
      return res.status(400).json({
        code: 400,
        message: '该部门下存在用户，无法删除',
        data: null,
        timestamp: Date.now()
      })
    }

    await query('DELETE FROM departments WHERE id = ?', [id])

    res.success(null, '部门删除成功')
  } catch (error) {
    next(error)
  }
})

router.get('/checkin-records', authenticateToken, requireDeptAdminOrHigher(), async (req, res, next) => {
  try {
    const { page, pageSize, keyword, checkin_method, is_late, date_from, date_to } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = []
    let params = []

    if (keyword) {
      whereClauses.push('(b.meeting_title LIKE ? OR u.real_name LIKE ? OR r.name LIKE ?)')
      const keywordParam = `%${keyword}%`
      params.push(keywordParam, keywordParam, keywordParam)
    }
    if (checkin_method) {
      whereClauses.push('cr.checkin_method = ?')
      params.push(checkin_method)
    }
    if (is_late !== undefined && is_late !== '') {
      whereClauses.push('cr.is_late = ?')
      params.push(parseInt(is_late))
    }
    if (date_from) {
      whereClauses.push('DATE(cr.checkin_time) >= ?')
      params.push(date_from)
    }
    if (date_to) {
      whereClauses.push('DATE(cr.checkin_time) <= ?')
      params.push(date_to)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const records = await query(
      `SELECT cr.*, b.meeting_title, b.date, b.start_time, b.end_time,
              r.name as room_name, u.real_name as user_name, u.username
       FROM checkin_records cr
       LEFT JOIN bookings b ON cr.booking_id = b.id
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       LEFT JOIN users u ON cr.user_id = u.id
       ${whereSql}
       ORDER BY cr.checkin_time DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const list = records.map(r => ({
      ...r,
      checkin_method_name: getCheckinMethodName(r.checkin_method)
    }))

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM checkin_records cr
       LEFT JOIN bookings b ON cr.booking_id = b.id
       LEFT JOIN meeting_rooms r ON b.room_id = r.id
       LEFT JOIN users u ON cr.user_id = u.id
       ${whereSql}`,
      params
    )

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

module.exports = router
