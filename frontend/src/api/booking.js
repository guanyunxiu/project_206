import request from '@/utils/request'

export function checkConflict(data) {
  return request({
    url: '/bookings/check',
    method: 'post',
    data
  })
}

export function checkViolation() {
  return request({
    url: '/bookings/check-violation',
    method: 'post'
  })
}

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

export function getDashboardData() {
  return request({
    url: '/statistics/dashboard',
    method: 'get'
  })
}

export function getAnomalies() {
  return request({
    url: '/statistics/anomalies',
    method: 'get'
  })
}

export function getSystemSettings() {
  return request({
    url: '/statistics/settings',
    method: 'get'
  })
}

export function updateSystemSettings(data) {
  return request({
    url: '/statistics/settings',
    method: 'put',
    data
  })
}
