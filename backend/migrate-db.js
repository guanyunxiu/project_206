const mysql = require('mysql2/promise')
require('dotenv').config()

async function migrateDatabase() {
  console.log('开始数据库迁移...')

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'meeting_room_db'
  })

  try {
    const migrations = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS violation_count INT NOT NULL DEFAULT 0 COMMENT '爽约次数'`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_violation_reset DATE COMMENT '上次爽约重置日期'`,
      
      `ALTER TABLE meeting_rooms ADD COLUMN IF NOT EXISTS room_type ENUM('small', 'medium', 'large', 'training') NOT NULL DEFAULT 'medium' COMMENT 'small:小型(<=10人), medium:中型(11-20人), large:大型(21-50人), training:培训室(>50人)'`,
      
      `ALTER TABLE assets ADD COLUMN IF NOT EXISTS fault_quantity INT NOT NULL DEFAULT 0 COMMENT '故障数量'`,
      
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attendee_departments TEXT COMMENT '参会部门JSON数组'`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_cross_department TINYINT DEFAULT 0 COMMENT '0-本部门 1-跨部门'`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS approval_status ENUM('auto_approved', 'pending_dept', 'pending_admin', 'approved', 'rejected') COMMENT '审批状态'`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS current_approval_step INT DEFAULT 0 COMMENT '当前审批步骤'`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checkin_status ENUM('pending', 'checked_in', 'no_show') DEFAULT 'pending' COMMENT '签到状态'`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checkin_time DATETIME COMMENT '签到时间'`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checkin_method ENUM('qrcode', 'manual') COMMENT '签到方式'`,
      
      `ALTER TABLE bookings MODIFY COLUMN status ENUM('pending', 'pending_approval', 'approved', 'rejected', 'in_use', 'completed', 'cancelled', 'no_show') NOT NULL DEFAULT 'pending'`,
      
      `ALTER TABLE approval_records ADD COLUMN IF NOT EXISTS step INT NOT NULL COMMENT '审批步骤:1-部门审批,2-行政确认'`,
      
      `ALTER TABLE borrowing_records ADD COLUMN IF NOT EXISTS expected_return_date DATE COMMENT '预期归还日期'`,
      `ALTER TABLE borrowing_records MODIFY COLUMN status ENUM('borrowed', 'returned', 'overdue') NOT NULL DEFAULT 'borrowed'`,
      
      `CREATE TABLE IF NOT EXISTS checkin_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        booking_id INT NOT NULL,
        user_id INT NOT NULL,
        checkin_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        checkin_method ENUM('qrcode', 'manual') NOT NULL,
        status ENUM('success', 'failed') NOT NULL DEFAULT 'success',
        remark TEXT,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_booking_id (booking_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      
      `CREATE TABLE IF NOT EXISTS violation_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        booking_id INT NOT NULL,
        violation_type ENUM('no_show', 'late_cancel', 'other') NOT NULL DEFAULT 'no_show',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      
      `CREATE TABLE IF NOT EXISTS asset_repairs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT NOT NULL,
        reporter_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        description TEXT NOT NULL,
        status ENUM('pending', 'repairing', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
        repair_note TEXT,
        repaired_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_asset_id (asset_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      
      `CREATE TABLE IF NOT EXISTS asset_usage_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT NOT NULL,
        user_id INT NOT NULL,
        booking_id INT,
        action ENUM('borrow', 'return', 'repair', 'repair_complete') NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
        INDEX idx_asset_id (asset_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      
      `CREATE TABLE IF NOT EXISTS system_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      
      `CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        type ENUM('approval', 'checkin', 'asset', 'system') NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT,
        related_id INT,
        is_read TINYINT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_is_read (is_read)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ]

    for (const sql of migrations) {
      try {
        await conn.execute(sql)
        console.log('执行成功:', sql.substring(0, 60) + '...')
      } catch (error) {
        if (error.code !== 'ER_DUP_FIELDNAME' && error.code !== 'ER_DUP_KEYNAME' && !error.message.includes('already exists')) {
          console.error('执行失败:', sql.substring(0, 60) + '...')
          console.error('错误:', error.message)
        } else {
          console.log('已存在，跳过:', sql.substring(0, 60) + '...')
        }
      }
    }

    const [settingCount] = await conn.execute('SELECT COUNT(*) as count FROM system_settings')
    if (settingCount[0].count === 0) {
      const settings = [
        ['max_violation_count', '3', '最大爽约次数，超过则限制预约'],
        ['violation_reset_period', '30', '爽约记录重置周期（天）'],
        ['checkin_grace_minutes', '15', '签到宽限时间（分钟），超过开始时间此分钟数未签到则标记爽约'],
        ['auto_checkout_minutes', '30', '自动结束会议时间（分钟），超过结束时间此分钟数自动标记完成'],
        ['asset_return_days', '3', '资产借用归还期限（天）'],
        ['overdue_reminder_days', '1', '超期提醒提前天数'],
        ['large_meeting_threshold', '20', '大型会议人数阈值，超过此人数需审批'],
        ['approval_required_room_types', 'large,training', '需要审批的会议室类型，逗号分隔']
      ]
      for (const [key, value, desc] of settings) {
        await conn.execute(
          'INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
          [key, value, desc]
        )
      }
      console.log('系统设置初始化完成')
    }

    await conn.end()
    console.log('数据库迁移完成！')

  } catch (error) {
    console.error('数据库迁移失败:', error)
    process.exit(1)
  }
}

migrateDatabase()
