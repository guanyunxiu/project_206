const express = require('express')
const { query } = require('../config/database')
const { authenticateToken, requireAdminOrHigher } = require('../middleware/auth')
const { createPagination, getRuleTypeName, getPenaltyActionName } = require('../utils/helper')

const router = express.Router()

router.get('/', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const { page, pageSize, rule_type, is_enabled } = req.query
    const { offset, limit } = createPagination(page, pageSize)

    let whereClauses = []
    let params = []

    if (rule_type) {
      whereClauses.push('rule_type = ?')
      params.push(rule_type)
    }
    if (is_enabled !== undefined && is_enabled !== '') {
      whereClauses.push('is_enabled = ?')
      params.push(parseInt(is_enabled))
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const rules = await query(
      `SELECT * FROM exception_rules ${whereSql} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    )

    const list = rules.map(r => ({
      ...r,
      rule_type_name: getRuleTypeName(r.rule_type),
      penalty_action_name: getPenaltyActionName(r.penalty_action)
    }))

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM exception_rules ${whereSql}`,
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

router.get('/:id', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const { id } = req.params

    const rules = await query('SELECT * FROM exception_rules WHERE id = ?', [id])
    if (rules.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '规则不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    res.success({
      ...rules[0],
      rule_type_name: getRuleTypeName(rules[0].rule_type),
      penalty_action_name: getPenaltyActionName(rules[0].penalty_action)
    })
  } catch (error) {
    next(error)
  }
})

router.post('/', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const { rule_name, rule_type, threshold, time_window, penalty_action, penalty_duration, is_enabled, description } = req.body

    if (!rule_name || !rule_type || !threshold || !penalty_action) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整的规则信息',
        data: null,
        timestamp: Date.now()
      })
    }

    if (!['missed_meeting', 'late_return', 'booking_conflict', 'over_capacity'].includes(rule_type)) {
      return res.status(400).json({
        code: 400,
        message: '无效的规则类型',
        data: null,
        timestamp: Date.now()
      })
    }

    if (!['warn', 'restrict_booking', 'restrict_assets', 'disable_account'].includes(penalty_action)) {
      return res.status(400).json({
        code: 400,
        message: '无效的处罚类型',
        data: null,
        timestamp: Date.now()
      })
    }

    const [result] = await query(
      `INSERT INTO exception_rules 
       (rule_name, rule_type, threshold, time_window, penalty_action, penalty_duration, is_enabled, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rule_name,
        rule_type,
        parseInt(threshold),
        parseInt(time_window) || 30,
        penalty_action,
        parseInt(penalty_duration) || 7,
        is_enabled !== undefined ? parseInt(is_enabled) : 1,
        description || ''
      ]
    )

    res.success({ id: result.insertId }, '规则创建成功')
  } catch (error) {
    next(error)
  }
})

router.put('/:id', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const { id } = req.params
    const { rule_name, rule_type, threshold, time_window, penalty_action, penalty_duration, is_enabled, description } = req.body

    const rules = await query('SELECT * FROM exception_rules WHERE id = ?', [id])
    if (rules.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '规则不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    const updates = []
    const values = []

    if (rule_name) {
      updates.push('rule_name = ?')
      values.push(rule_name)
    }
    if (rule_type) {
      if (!['missed_meeting', 'late_return', 'booking_conflict', 'over_capacity'].includes(rule_type)) {
        return res.status(400).json({
          code: 400,
          message: '无效的规则类型',
          data: null,
          timestamp: Date.now()
        })
      }
      updates.push('rule_type = ?')
      values.push(rule_type)
    }
    if (threshold !== undefined) {
      updates.push('threshold = ?')
      values.push(parseInt(threshold))
    }
    if (time_window !== undefined) {
      updates.push('time_window = ?')
      values.push(parseInt(time_window))
    }
    if (penalty_action) {
      if (!['warn', 'restrict_booking', 'restrict_assets', 'disable_account'].includes(penalty_action)) {
        return res.status(400).json({
          code: 400,
          message: '无效的处罚类型',
          data: null,
          timestamp: Date.now()
        })
      }
      updates.push('penalty_action = ?')
      values.push(penalty_action)
    }
    if (penalty_duration !== undefined) {
      updates.push('penalty_duration = ?')
      values.push(parseInt(penalty_duration))
    }
    if (is_enabled !== undefined) {
      updates.push('is_enabled = ?')
      values.push(parseInt(is_enabled))
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
    await query(`UPDATE exception_rules SET ${updates.join(', ')} WHERE id = ?`, values)

    res.success(null, '规则更新成功')
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', authenticateToken, requireAdminOrHigher(), async (req, res, next) => {
  try {
    const { id } = req.params

    const rules = await query('SELECT * FROM exception_rules WHERE id = ?', [id])
    if (rules.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '规则不存在',
        data: null,
        timestamp: Date.now()
      })
    }

    await query('DELETE FROM exception_rules WHERE id = ?', [id])

    res.success(null, '规则删除成功')
  } catch (error) {
    next(error)
  }
})

module.exports = router
