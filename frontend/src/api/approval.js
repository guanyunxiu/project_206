import request from '@/utils/request'

export function getPendingApprovals(params) {
  return request({
    url: '/approvals/pending',
    method: 'get',
    params
  })
}

export function getMyApprovals(params) {
  return request({
    url: '/approvals/my',
    method: 'get',
    params
  })
}

export function approveBooking(id, data) {
  return request({
    url: `/approvals/${id}/approve`,
    method: 'post',
    data
  })
}

export function rejectBooking(id, data) {
  return request({
    url: `/approvals/${id}/reject`,
    method: 'post',
    data
  })
}

export function resubmitBooking(id, data) {
  return request({
    url: `/approvals/${id}/resubmit`,
    method: 'put',
    data
  })
}

export function getApprovalRecords(id) {
  return request({
    url: `/approvals/${id}/records`,
    method: 'get'
  })
}
