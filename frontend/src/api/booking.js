import request from '@/utils/request'

export function checkConflict(data) {
  return request({
    url: '/bookings/check',
    method: 'post',
    data
  })
}

/**
 * 创建会议室预约
 * @param {Object} data - 预约数据
 * @param {number} data.room_id - 会议室ID
 * @param {string} data.meeting_title - 会议主题
 * @param {string} [data.meeting_description] - 会议描述
 * @param {number} [data.attendee_count] - 参会人数
 * @param {string} data.date - 预约日期 YYYY-MM-DD
 * @param {string} data.start_time - 开始时间 HH:mm
 * @param {string} data.end_time - 结束时间 HH:mm
 * @param {boolean} [data.is_cross_department] - 是否跨部门
 * @param {string} [data.meeting_type] - 会议类型: normal, large
 * @param {string} [data.expected_return_date] - 资产预计归还日期
 * @param {Array} [data.assets] - 借用资产列表
 * @param {number} data.assets[].asset_id - 资产ID
 * @param {number} data.assets[].quantity - 借用数量
 */
export function createBooking(data) {
  return request({
    url: '/bookings',
    method: 'post',
    data
  })
}

export function getMyBookings(params) {
  return request({
    url: '/bookings/my',
    method: 'get',
    params
  })
}

export function getBookingList(params) {
  return request({
    url: '/admin/bookings',
    method: 'get',
    params
  })
}

export function cancelBooking(id) {
  return request({
    url: `/bookings/${id}/cancel`,
    method: 'put'
  })
}

export function getBookingDetail(id) {
  return request({
    url: `/bookings/${id}`,
    method: 'get'
  })
}

export function getStatistics(params) {
  return request({
    url: '/statistics',
    method: 'get',
    params
  })
}
