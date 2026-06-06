import request from '@/utils/request'

export function getAssetList(params) {
  return request({
    url: '/assets',
    method: 'get',
    params
  })
}

export function getMyBorrowings(params) {
  return request({
    url: '/assets/my',
    method: 'get',
    params
  })
}

export function returnAsset(id) {
  return request({
    url: `/assets/return/${id}`,
    method: 'put'
  })
}

export function createAsset(data) {
  return request({
    url: '/admin/assets',
    method: 'post',
    data
  })
}

export function updateAsset(id, data) {
  return request({
    url: `/admin/assets/${id}`,
    method: 'put',
    data
  })
}

export function deleteAsset(id) {
  return request({
    url: `/admin/assets/${id}`,
    method: 'delete'
  })
}

export function getBorrowingList(params) {
  return request({
    url: '/admin/assets/borrowings',
    method: 'get',
    params
  })
}

export function createRepair(data) {
  return request({
    url: '/assets/repair',
    method: 'post',
    data
  })
}

export function getRepairList(params) {
  return request({
    url: '/assets/repairs',
    method: 'get',
    params
  })
}

export function processRepair(id, data) {
  return request({
    url: `/assets/repair/${id}/process`,
    method: 'put',
    data
  })
}

export function getUsageLogs(assetId, params) {
  return request({
    url: `/assets/usage-logs/${assetId}`,
    method: 'get',
    params
  })
}

export function getOverdueAssets(params) {
  return request({
    url: '/assets/overdue',
    method: 'get',
    params
  })
}

export function remindOverdue() {
  return request({
    url: '/assets/remind-overdue',
    method: 'post'
  })
}

export function getMyReminders(params) {
  return request({
    url: '/assets/reminders/my',
    method: 'get',
    params
  })
}

export function markReminderRead(id) {
  return request({
    url: `/assets/reminders/${id}/read`,
    method: 'put'
  })
}

