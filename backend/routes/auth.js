const express = require('express')
const { query } = require('../config/database')
const { generateToken, comparePassword, hashPassword, getRoleName } = require('../utils/helper')
const { authenticateToken, JWT_SECRET } = require('../middleware/auth')
require('dotenv').config()

const router = express.Router()

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        code: 400,
        message: '用户名和密码不能为空',
        data: null,
        timestamp: Date.now()
      })
    }

    const users = await query(
      `SELECT u.*, d.name as department_name 
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.username = ?`,
      [username]
    )

    if (users.length === 0) {
      return res.status(401).json({
        code: 401,
        message: '用户名或密码错误',
        data: null,
        timestamp: Date.now()
      })
    }

    const user = users[0]

    if (user.status === 0) {
      return res.status(403).json({
        code: 403,
        message: '账号已被禁用，请联系管理员',
        data: null,
        timestamp: Date.now()
      })
    }

    const isPasswordValid = await comparePassword(password, user.password)
    if (!isPasswordValid) {
      return res.status(401).json({
        code: 401,
        message: '用户名或密码错误',
        data: null,
        timestamp: Date.now()
      })
    }

    const token = generateToken(user.id, user.role, JWT_SECRET, process.env.TOKEN_EXPIRES_IN || '24h')

    res.success({
      token,
      user: {
        id: user.id,
        username: user.username,
        real_name: user.real_name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        role_name: getRoleName(user.role),
        department_id: user.department_id,
        department_name: user.department_name
      }
    }, '登录成功')
  } catch (error) {
    next(error)
  }
})

router.post('/logout', authenticateToken, (req, res) => {
  res.success(null, '退出登录成功')
})

router.get('/info', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id

    const users = await query(
      `SELECT u.*, d.name as department_name 
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.id = ?`,
      [userId]
    )

    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const user = users[0]
    res.success({
      id: user.id,
      username: user.username,
      real_name: user.real_name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      role_name: getRoleName(user.role),
      department_id: user.department_id,
      department_name: user.department_name,
      created_at: user.created_at
    })
  } catch (error) {
    next(error)
  }
})

router.put('/profile', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { real_name, email, phone, avatar } = req.body

    const updates = []
    const values = []

    if (real_name) {
      updates.push('real_name = ?')
      values.push(real_name)
    }
    if (email) {
      updates.push('email = ?')
      values.push(email)
    }
    if (phone) {
      updates.push('phone = ?')
      values.push(phone)
    }
    if (avatar) {
      updates.push('avatar = ?')
      values.push(avatar)
    }

    if (updates.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '没有需要更新的字段',
        data: null,
        timestamp: Date.now()
      })
    }

    values.push(userId)

    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values)

    const users = await query(
      `SELECT u.*, d.name as department_name 
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.id = ?`,
      [userId]
    )

    const user = users[0]
    res.success({
      id: user.id,
      username: user.username,
      real_name: user.real_name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      role_name: getRoleName(user.role),
      department_id: user.department_id,
      department_name: user.department_name
    }, '个人信息更新成功')
  } catch (error) {
    next(error)
  }
})

router.put('/password', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { old_password, new_password } = req.body

    if (!old_password || !new_password) {
      return res.status(400).json({
        code: 400,
        message: '旧密码和新密码不能为空',
        data: null,
        timestamp: Date.now()
      })
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        code: 400,
        message: '新密码长度不能少于6位',
        data: null,
        timestamp: Date.now()
      })
    }

    const users = await query('SELECT password FROM users WHERE id = ?', [userId])
    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const isPasswordValid = await comparePassword(old_password, users[0].password)
    if (!isPasswordValid) {
      return res.status(400).json({
        code: 400,
        message: '旧密码错误',
        data: null,
        timestamp: Date.now()
      })
    }

    const hashedPassword = await hashPassword(new_password)
    await query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId])

    res.success(null, '密码修改成功')
  } catch (error) {
    next(error)
  }
})

module.exports = router
