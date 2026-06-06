import request from '@/utils/request'

export function getQRCode(id) {
  return request({
    url: `/checkins/qrcode/${id}`,
    method: 'get'
  })
}

export function checkin(data) {
  return request({
    url: '/checkins/checkin',
    method: 'post',
    data
  })
}

export function markNoShow(data) {
  return request({
    url: '/checkins/mark-no-show',
    method: 'post',
    data
  })
}

export function getMyViolations(params) {
  return request({
    url: '/checkins/violations/my',
    method: 'get',
    params
  })
}

export function getViolationList(params) {
  return request({
    url: '/checkins/violations',
    method: 'get',
    params
  })
}

export function autoProcess() {
  return request({
    url: '/checkins/auto-process',
    method: 'post'
  })
}

export function getCheckinRecords(bookingId) {
  return request({
    url: `/checkins/records/${bookingId}`,
    method: 'get'
  })
}
