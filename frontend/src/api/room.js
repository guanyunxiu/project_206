import request from '@/utils/request'

export function getRoomList(params) {
  return request({
    url: '/rooms',
    method: 'get',
    params
  })
}

export function getRoomDetail(id) {
  return request({
    url: `/rooms/${id}`,
    method: 'get'
  })
}

export function getRoomSchedule(id, date) {
  return request({
    url: `/rooms/${id}/schedule`,
    method: 'get',
    params: { date }
  })
}

export function createRoom(data) {
  return request({
    url: '/admin/rooms',
    method: 'post',
    data
  })
}

export function updateRoom(id, data) {
  return request({
    url: `/admin/rooms/${id}`,
    method: 'put',
    data
  })
}

export function deleteRoom(id) {
  return request({
    url: `/admin/rooms/${id}`,
    method: 'delete'
  })
}
