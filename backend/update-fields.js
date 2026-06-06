const mysql = require('mysql2/promise');

async function columnExists(conn, table, column) {
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

(async () => {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'meeting_room_db'
  });

  const columnsToAdd = [
    { table: 'asset_repairs', column: 'repaired_by', def: 'INT' },
    { table: 'asset_repairs', column: 'repair_note', def: 'TEXT' },
    { table: 'asset_repairs', column: 'repaired_at', def: 'DATETIME' },
    { table: 'bookings', column: 'meeting_type', def: 'ENUM("normal", "large") NOT NULL DEFAULT "normal"' },
    { table: 'bookings', column: 'is_cross_department', def: 'TINYINT(1) NOT NULL DEFAULT 0' },
    { table: 'bookings', column: 'approval_status', def: 'ENUM("auto_approved", "pending_dept", "pending_admin", "approved", "rejected") NOT NULL DEFAULT "auto_approved"' },
    { table: 'bookings', column: 'current_approver_id', def: 'INT' },
    { table: 'bookings', column: 'rejection_reason', def: 'TEXT' },
    { table: 'bookings', column: 'checkin_code', def: 'VARCHAR(50)' },
    { table: 'bookings', column: 'approved_at', def: 'DATETIME' },
    { table: 'approval_records', column: 'approver_role', def: 'ENUM("dept_admin", "admin")' },
    { table: 'approval_records', column: 'comment', def: 'TEXT' },
    { table: 'borrowing_records', column: 'expected_return_date', def: 'DATE' },
    { table: 'borrowing_records', column: 'reminder_count', def: 'INT NOT NULL DEFAULT 0' },
    { table: 'borrowing_records', column: 'last_reminder_at', def: 'DATETIME' },
    { table: 'assets', column: 'fault_quantity', def: 'INT NOT NULL DEFAULT 0' }
  ];

  for (const { table, column, def } of columnsToAdd) {
    if (!(await columnExists(conn, table, column))) {
      try {
        await conn.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
        console.log(`✓ 已添加 ${table}.${column}`);
      } catch (e) {
        console.log(`✗ 添加 ${table}.${column} 失败:`, e.message);
      }
    } else {
      console.log(`! ${table}.${column} 已存在`);
    }
  }

  try {
    await conn.execute('ALTER TABLE asset_repairs ADD FOREIGN KEY (repaired_by) REFERENCES users(id) ON DELETE SET NULL');
    console.log('✓ 已添加外键 asset_repairs.repaired_by');
  } catch (e) {
    console.log('! 外键已存在或无需添加:', e.message.substring(0, 50));
  }

  await conn.end();
  console.log('\n数据库字段更新完成！');
})();
