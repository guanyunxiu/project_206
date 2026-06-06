import { defineStore } from 'pinia'
import { login as loginApi, getUserInfo, logout as logoutApi } from '@/api/user'

export const useUserStore = defineStore('user', {
  state: () => ({
    userInfo: null,
    token: localStorage.getItem('token') || ''
  }),
  actions: {
    async login(username, password) {
      try {
        const res = await loginApi({ username, password })
        this.token = res.data.token
        localStorage.setItem('token', res.data.token)
        await this.fetchUserInfo()
        return res
      } catch (error) {
        throw error
      }
    },
    async fetchUserInfo() {
      try {
        const res = await getUserInfo()
        this.userInfo = res.data
        return res
      } catch (error) {
        throw error
      }
    },
    async logout() {
      try {
        await logoutApi()
      } catch (error) {
        console.error('Logout error:', error)
      } finally {
        this.token = ''
        this.userInfo = null
        localStorage.removeItem('token')
      }
    },
    updateUserInfo(info) {
      this.userInfo = { ...this.userInfo, ...info }
    }
  }
})
