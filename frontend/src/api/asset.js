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
