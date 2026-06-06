import request from '@/utils/request'

export function checkConflict(data) {
  return request({
    url: '/bookings/check',
    method: 'post',
    data
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
