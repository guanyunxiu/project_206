const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
require('dotenv').config()

async function initDatabase() {
  console.log('开始初始化数据库...')

  const rootConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  })

  try {
    await rootConn.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'meeting_room_db'} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    console.log('数据库创建成功')

    await rootConn.end()

    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'meeting_room_db'
    })

    const tableSQLs = [
      `CREATE TABLE IF NOT EXISTS departments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        real_name VARCHAR(50) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(20),
        avatar VARCHAR(255),
        department_id INT,
        role ENUM('employee', 'dept_admin', 'admin', 'super_admin') NOT NULL DEFAULT 'employee',
        status TINYINT DEFAULT 1 COMMENT '1-正常 0-禁用',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS meeting_rooms (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        capacity INT NOT NULL,
        location VARCHAR(200) NOT NULL,
        facilities TEXT,
        description TEXT,
        image_url VARCHAR(255),
        status TINYINT DEFAULT 1 COMMENT '1-可用 0-不可用',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS assets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL COMMENT 'projector,camera,whiteboard,microphone,other',
        description TEXT,
        total_quantity INT NOT NULL DEFAULT 0,
        available_quantity INT NOT NULL DEFAULT 0,
        status TINYINT DEFAULT 1 COMMENT '1-可用 0-不可用',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS bookings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        room_id INT NOT NULL,
        meeting_title VARCHAR(200) NOT NULL,
        meeting_description TEXT,
        attendee_count INT NOT NULL DEFAULT 0,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_cross_department TINYINT DEFAULT 0 COMMENT '0-部门内 1-跨部门',
        meeting_type ENUM('normal', 'large') NOT NULL DEFAULT 'normal' COMMENT 'normal-普通会议 large-大型会议',
        approval_status ENUM('auto_approved', 'pending_dept', 'pending_admin', 'approved', 'rejected') NOT NULL DEFAULT 'auto_approved',
        current_approver_id INT,
        rejection_reason TEXT,
        checkin_code VARCHAR(50),
        status ENUM('pending', 'in_use', 'completed', 'cancelled', 'missed') NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id) REFERENCES meeting_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (current_approver_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_room_date (room_id, date),
        INDEX idx_approval_status (approval_status),
        INDEX idx_user_status (user_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS approval_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        booking_id INT NOT NULL,
        approver_id INT,
        approver_role ENUM('dept_admin', 'admin') NOT NULL,
        status ENUM('approved', 'rejected') NOT NULL,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS checkin_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        booking_id INT NOT NULL,
        user_id INT NOT NULL,
        checkin_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        checkin_method ENUM('qrcode', 'manual') NOT NULL,
        is_late TINYINT DEFAULT 0 COMMENT '0-准时 1-迟到',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uk_booking_user (booking_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS user_violations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        type ENUM('missed', 'late_return') NOT NULL,
        booking_id INT,
        borrowing_id INT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
        FOREIGN KEY (borrowing_id) REFERENCES borrowing_records(id) ON DELETE SET NULL,
        INDEX idx_user_type (user_id, type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS assets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL COMMENT 'projector,camera,whiteboard,microphone,other',
        description TEXT,
        total_quantity INT NOT NULL DEFAULT 0,
        available_quantity INT NOT NULL DEFAULT 0,
        fault_quantity INT NOT NULL DEFAULT 0 COMMENT '故障数量',
        status TINYINT DEFAULT 1 COMMENT '1-可用 0-不可用',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS borrowing_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        booking_id INT NOT NULL,
        user_id INT NOT NULL,
        asset_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        expected_return_date DATE COMMENT '预计归还日期',
        status ENUM('borrowed', 'returned', 'overdue') NOT NULL DEFAULT 'borrowed',
        borrowed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        returned_at DATETIME,
        reminder_sent TINYINT DEFAULT 0 COMMENT '0-未提醒 1-已提醒',
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
        INDEX idx_status_expected (status, expected_return_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS asset_repairs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT NOT NULL,
        reporter_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        fault_level ENUM('minor', 'major', 'critical') NOT NULL DEFAULT 'minor',
        status ENUM('pending', 'repairing', 'resolved', 'cancelled') NOT NULL DEFAULT 'pending',
        repair_note TEXT,
        repaired_by INT,
        repaired_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (repaired_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS asset_usage_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT NOT NULL,
        user_id INT NOT NULL,
        booking_id INT,
        action ENUM('borrow', 'return', 'repair', 'scrap') NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
        INDEX idx_asset_time (asset_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS exception_rules (
        id INT PRIMARY KEY AUTO_INCREMENT,
        rule_name VARCHAR(100) NOT NULL,
        rule_type ENUM('missed_meeting', 'late_return', 'booking_conflict', 'over_capacity') NOT NULL,
        threshold INT NOT NULL DEFAULT 3 COMMENT '触发阈值',
        time_window INT NOT NULL DEFAULT 30 COMMENT '时间窗口(天)',
        penalty_action ENUM('warn', 'restrict_booking', 'restrict_assets', 'disable_account') NOT NULL DEFAULT 'warn',
        penalty_duration INT NOT NULL DEFAULT 7 COMMENT '处罚持续时间(天)',
        is_enabled TINYINT DEFAULT 1,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        type ENUM('approval', 'checkin', 'asset', 'violation', 'system') NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT,
        related_id INT,
        is_read TINYINT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_read (user_id, is_read)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ]

    for (const sql of tableSQLs) {
      await conn.execute(sql)
    }
    console.log('数据表创建成功')

    const [deptCount] = await conn.execute('SELECT COUNT(*) as count FROM departments')
    if (deptCount[0].count === 0) {
      const departments = [
        ['技术研发部', '负责公司技术研发工作'],
        ['产品设计部', '负责产品规划和设计'],
        ['市场营销部', '负责市场推广和销售'],
        ['人力资源部', '负责招聘和员工管理'],
        ['财务部', '负责财务和预算管理'],
        ['行政部', '负责行政事务和资产管理']
      ]
      for (const [name, desc] of departments) {
        await conn.execute('INSERT INTO departments (name, description) VALUES (?, ?)', [name, desc])
      }
      console.log('部门数据初始化完成')
    }

    const [userCount] = await conn.execute('SELECT COUNT(*) as count FROM users')
    if (userCount[0].count === 0) {
      const defaultPassword = await bcrypt.hash('123456', 10)
      const users = [
        ['admin', defaultPassword, '超级管理员', 'admin@company.com', '13800000000', 6, 'super_admin'],
        ['admin_office', defaultPassword, '行政管理员', 'admin_office@company.com', '13800000001', 6, 'admin'],
        ['dept_tech', defaultPassword, '技术部管理员', 'dept_tech@company.com', '13800000002', 1, 'dept_admin'],
        ['employee1', defaultPassword, '张三', 'zhangsan@company.com', '13800000003', 1, 'employee'],
        ['employee2', defaultPassword, '李四', 'lisi@company.com', '13800000004', 2, 'employee'],
        ['employee3', defaultPassword, '王五', 'wangwu@company.com', '13800000005', 3, 'employee']
      ]
      for (const user of users) {
        await conn.execute(
          'INSERT INTO users (username, password, real_name, email, phone, department_id, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
          user
        )
      }
      console.log('用户数据初始化完成，默认密码: 123456')
      console.log('默认账号:')
      console.log('  超级管理员: admin / 123456')
      console.log('  行政管理员: admin_office / 123456')
      console.log('  部门管理员: dept_tech / 123456')
      console.log('  普通员工: employee1 / 123456, employee2 / 123456, employee3 / 123456')
    }

    const [roomCount] = await conn.execute('SELECT COUNT(*) as count FROM meeting_rooms')
    if (roomCount[0].count === 0) {
      const rooms = [
        ['创新会议厅', 20, 'A座3楼301', '投影仪,白板,音响系统,视频会议', '可容纳20人的中型会议室', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600'],
        ['协作小会议室', 8, 'A座4楼402', '投影仪,白板,电视屏幕', '小型讨论会议室', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=600'],
        ['董事会议室', 30, 'B座1楼101', '投影仪,白板,音响系统,视频会议,同声传译', '高端董事会议专用', 'https://images.unsplash.com/photo-1462826303086-329426d1aef5?w=600'],
        ['培训室', 50, 'C座2楼201', '投影仪,白板,音响系统,麦克风', '大型培训专用', 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600'],
        ['视频会议室', 15, 'A座5楼501', '投影仪,视频会议系统,音响系统,麦克风', '远程视频会议专用', 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?w=600']
      ]
      for (const room of rooms) {
        await conn.execute(
          'INSERT INTO meeting_rooms (name, capacity, location, facilities, description, image_url) VALUES (?, ?, ?, ?, ?, ?)',
          room
        )
      }
      console.log('会议室数据初始化完成')
    }

    const [assetCount] = await conn.execute('SELECT COUNT(*) as count FROM assets')
    if (assetCount[0].count === 0) {
      const assets = [
        ['便携投影仪', 'projector', '高清便携投影仪，支持1080P', 10, 10],
        ['高清摄像机', 'camera', '4K高清会议摄像机', 5, 5],
        ['移动白板', 'whiteboard', '可移动白板，带支架', 15, 15],
        ['无线麦克风', 'microphone', 'U段无线手持麦克风', 20, 20],
        ['激光翻页笔', 'other', '激光翻页笔，支持遥控', 25, 25],
        ['音响系统', 'other', '便携蓝牙音响', 8, 8]
      ]
      for (const asset of assets) {
        await conn.execute(
          'INSERT INTO assets (name, category, description, total_quantity, available_quantity) VALUES (?, ?, ?, ?, ?)',
          asset
        )
      }
      console.log('资产数据初始化完成')
    }

    const [bookingCount] = await conn.execute('SELECT COUNT(*) as count FROM bookings')
    if (bookingCount[0].count === 0) {
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const formatDate = (d) => d.toISOString().split('T')[0]
      
      const bookings = [
        [4, 1, '技术方案评审会', '讨论Q2技术方案', 8, formatDate(tomorrow), '09:00:00', '10:30:00', 0, 'normal', 'auto_approved'],
        [4, 2, '产品需求讨论', '新功能需求评审', 5, formatDate(tomorrow), '14:00:00', '15:00:00', 0, 'normal', 'auto_approved'],
        [5, 3, '市场营销会议', 'Q2市场推广计划', 15, formatDate(today), '10:00:00', '12:00:00', 0, 'normal', 'auto_approved']
      ]
      for (const booking of bookings) {
        const [result] = await conn.execute(
          'INSERT INTO bookings (user_id, room_id, meeting_title, meeting_description, attendee_count, date, start_time, end_time, is_cross_department, meeting_type, approval_status, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [...booking, 'pending']
        )
      }
      console.log('预约数据初始化完成')
    }

    const [ruleCount] = await conn.execute('SELECT COUNT(*) as count FROM exception_rules')
    if (ruleCount[0].count === 0) {
      const rules = [
        ['爽约会议限制', 'missed_meeting', 3, 30, 'restrict_booking', 7, '30天内爽约3次以上，将禁止预约7天'],
        ['逾期归还警告', 'late_return', 2, 30, 'warn', 7, '30天内逾期归还2次以上，将收到警告'],
        ['逾期归还限制', 'late_return', 5, 30, 'restrict_assets', 14, '30天内逾期归还5次以上，将禁止借用资产14天'],
        ['频繁预约冲突', 'booking_conflict', 5, 30, 'warn', 7, '30天内预约冲突5次以上，将收到警告']
      ]
      for (const rule of rules) {
        await conn.execute(
          'INSERT INTO exception_rules (rule_name, rule_type, threshold, time_window, penalty_action, penalty_duration, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
          rule
        )
      }
      console.log('异常规则数据初始化完成')
    }

    await conn.end()
    console.log('数据库初始化完成！')

  } catch (error) {
    console.error('数据库初始化失败:', error)
    process.exit(1)
  }
}

initDatabase()
