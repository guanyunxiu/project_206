import request from '@/utils/request'

export function getRepairs(params) {
  return request({
    url: '/asset-advanced/repairs',
    method: 'get',
    params
  })
}

export function createRepair(data) {
  return request({
    url: '/asset-advanced/repairs',
    method: 'post',
    data
  })
}

export function updateRepair(id, data) {
  return request({
    url: `/asset-advanced/repairs/${id}`,
    method: 'put',
    data
  })
}

export function getUsageLogs(assetId, params) {
  return request({
    url: `/asset-advanced/usage-logs/${assetId}`,
    method: 'get',
    params
  })
}

export function getOverdueRecords(params) {
  return request({
    url: '/asset-advanced/overdue',
    method: 'get',
    params
  })
}

export function sendReminder(borrowId) {
  return request({
    url: `/asset-advanced/send-reminder/${borrowId}`,
    method: 'post'
  })
}

export function processOverdue() {
  return request({
    url: '/asset-advanced/process-overdue',
    method: 'post'
  })
}
