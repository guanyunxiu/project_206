import request from '@/utils/request'

export function getRules(params) {
  return request({
    url: '/exception-rules',
    method: 'get',
    params
  })
}

export function getRule(id) {
  return request({
    url: `/exception-rules/${id}`,
    method: 'get'
  })
}

export function createRule(data) {
  return request({
    url: '/exception-rules',
    method: 'post',
    data
  })
}

export function updateRule(id, data) {
  return request({
    url: `/exception-rules/${id}`,
    method: 'put',
    data
  })
}

export function deleteRule(id) {
  return request({
    url: `/exception-rules/${id}`,
    method: 'delete'
  })
}
