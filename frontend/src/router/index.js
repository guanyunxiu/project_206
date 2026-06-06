import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/store/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '首页概览', requiresAuth: true }
      },
      {
        path: 'rooms',
        name: 'Rooms',
        component: () => import('@/views/RoomList.vue'),
        meta: { title: '会议室列表', requiresAuth: true }
      },
      {
        path: 'rooms/:id',
        name: 'RoomDetail',
        component: () => import('@/views/RoomDetail.vue'),
        meta: { title: '会议室详情', requiresAuth: true }
      },
      {
        path: 'booking',
        name: 'Booking',
        component: () => import('@/views/Booking.vue'),
        meta: { title: '预约会议室', requiresAuth: true }
      },
      {
        path: 'my-bookings',
        name: 'MyBookings',
        component: () => import('@/views/MyBookings.vue'),
        meta: { title: '我的预约', requiresAuth: true }
      },
      {
        path: 'assets',
        name: 'Assets',
        component: () => import('@/views/AssetList.vue'),
        meta: { title: '资产列表', requiresAuth: true }
      },
      {
        path: 'my-assets',
        name: 'MyAssets',
        component: () => import('@/views/MyAssets.vue'),
        meta: { title: '我的借用', requiresAuth: true }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: { title: '个人中心', requiresAuth: true }
      },
      {
        path: 'admin/rooms',
        name: 'AdminRooms',
        component: () => import('@/views/admin/RoomManage.vue'),
        meta: { title: '会议室管理', requiresAuth: true, roles: ['dept_admin', 'admin', 'super_admin'] }
      },
      {
        path: 'admin/assets',
        name: 'AdminAssets',
        component: () => import('@/views/admin/AssetManage.vue'),
        meta: { title: '资产管理', requiresAuth: true, roles: ['dept_admin', 'admin', 'super_admin'] }
      },
      {
        path: 'admin/bookings',
        name: 'AdminBookings',
        component: () => import('@/views/admin/BookingManage.vue'),
        meta: { title: '预约管理', requiresAuth: true, roles: ['dept_admin', 'admin', 'super_admin'] }
      },
      {
        path: 'admin/users',
        name: 'AdminUsers',
        component: () => import('@/views/admin/UserManage.vue'),
        meta: { title: '用户管理', requiresAuth: true, roles: ['admin', 'super_admin'] }
      },
      {
        path: 'admin/departments',
        name: 'AdminDepartments',
        component: () => import('@/views/admin/DepartmentManage.vue'),
        meta: { title: '部门管理', requiresAuth: true, roles: ['admin', 'super_admin'] }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  const token = localStorage.getItem('token')

  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/')
  } else if (to.meta.roles && userStore.userInfo) {
    if (to.meta.roles.includes(userStore.userInfo.role)) {
      next()
    } else {
      next('/403')
    }
  } else {
    next()
  }
})

export default router
