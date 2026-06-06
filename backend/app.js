const express = require('express')
const cors = require('cors')
const detectPort = require('detect-port')
require('dotenv').config()

const { successHandler, errorHandler, notFoundHandler } = require('./middleware/response')

const authRoutes = require('./routes/auth')
const roomRoutes = require('./routes/rooms')
const bookingRoutes = require('./routes/bookings')
const assetRoutes = require('./routes/assets')
const adminRoutes = require('./routes/admin')
const statisticsRoutes = require('./routes/statistics')

const app = express()
const DEFAULT_PORT = parseInt(process.env.PORT) || 3000

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use(successHandler)

app.get('/api/health', (req, res) => {
  res.success({ status: 'ok', timestamp: Date.now() }, '服务运行正常')
})

app.use('/api/auth', authRoutes)
app.use('/api/rooms', roomRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/assets', assetRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/statistics', statisticsRoutes)

app.use(notFoundHandler)

app.use(errorHandler)

async function startServer() {
  try {
    const port = await detectPort(DEFAULT_PORT)
    
    if (port !== DEFAULT_PORT) {
      console.log(`\n⚠️  端口 ${DEFAULT_PORT} 已被占用，自动切换到端口 ${port}\n`)
    }

    app.listen(port, () => {
      console.log('=========================================')
      console.log('  智能会议室预约与资产管理系统 - 后端服务')
      console.log('=========================================')
      console.log(`🚀 服务已启动: http://localhost:${port}`)
      console.log(`📊 健康检查: http://localhost:${port}/api/health`)
      console.log(`🔌 API 前缀: /api`)
      console.log('=========================================')
      console.log()
      console.log('默认账号:')
      console.log('  超级管理员: admin / 123456')
      console.log('  行政管理员: admin_office / 123456')
      console.log('  部门管理员: dept_tech / 123456')
      console.log('  普通员工: employee1 / 123456')
      console.log()
    })
  } catch (error) {
    console.error('启动服务器失败:', error)
    process.exit(1)
  }
}

startServer()
