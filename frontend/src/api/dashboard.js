import request from '@/utils/request'

export function getOverview(params) {
  return request({
    url: '/dashboard/overview',
    method: 'get',
    params
  })
}

export function getRoomUsage(params) {
  return request({
    url: '/dashboard/room-usage',
    method: 'get',
    params
  })
}

export function getDailyBookings(params) {
  return request({
    url: '/dashboard/daily-bookings',
    method: 'get',
    params
  })
}

export function getHourlyUsage(params) {
  return request({
    url: '/dashboard/hourly-usage',
    method: 'get',
    params
  })
}

export function getDepartmentBookings(params) {
  return request({
    url: '/dashboard/department-bookings',
    method: 'get',
    params
  })
}

export function getAssetUsage() {
  return request({
    url: '/dashboard/asset-usage',
    method: 'get'
  })
}

export function getViolationStats(params) {
  return request({
    url: '/dashboard/violation-stats',
    method: 'get',
    params
  })
}

export function getApprovalStats(params) {
  return request({
    url: '/dashboard/approval-stats',
    method: 'get',
    params
  })
}

export function getRealTimeData() {
  return request({
    url: '/dashboard/real-time',
    method: 'get'
  })
}
