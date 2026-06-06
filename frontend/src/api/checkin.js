import request from '@/utils/request'

export function getMyViolations(params) {
  return request({
    url: '/checkin/my-violations',
    method: 'get',
    params
  })
}

export function getCheckinQRCode(bookingId) {
  return request({
    url: `/checkin/qrcode/${bookingId}`,
    method: 'get'
  })
}

export function scanCheckin(data) {
  return request({
    url: '/checkin/scan',
    method: 'post',
    data
  })
}

export function manualCheckin(bookingId, data) {
  return request({
    url: `/checkin/manual/${bookingId}`,
    method: 'post',
    data
  })
}

export function getCheckinRecords(bookingId) {
  return request({
    url: `/checkin/records/${bookingId}`,
    method: 'get'
  })
}

export function processMissed(data) {
  return request({
    url: '/checkin/process-missed',
    method: 'post',
    data
  })
}

export function getCheckinRecordList(params) {
  return request({
    url: '/admin/checkin-records',
    method: 'get',
    params
  })
}
