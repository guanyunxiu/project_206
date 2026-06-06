<template>
  <div class="big-screen">
    <div class="screen-header">
      <div class="header-decoration left"></div>
      <h1 class="screen-title">
        <span class="title-icon">
          <el-icon :size="32"><Monitor /></el-icon>
        </span>
        企业会议室与资产使用情况可视化大屏
        <span class="title-icon">
          <el-icon :size="32"><Monitor /></el-icon>
        </span>
      </h1>
      <div class="header-decoration right"></div>
      <div class="header-info">
        <div class="current-time">
          <el-icon :size="16"><Clock /></el-icon>
          {{ currentTime }}
        </div>
        <div class="refresh-status">
          <span class="status-dot" :class="{ active: isRefreshing }"></span>
          自动刷新中 ({{ refreshCountdown }}s)
        </div>
      </div>
    </div>

    <div class="screen-content">
      <div class="stat-cards">
        <div class="stat-card" v-for="card in statCards" :key="card.key">
          <div class="card-bg"></div>
          <div class="card-content">
            <div class="card-icon" :style="{ background: card.gradient }">
              <el-icon :size="28" color="#fff">
                <component :is="card.icon" />
              </el-icon>
            </div>
            <div class="card-info">
              <div class="card-value">
                <span class="number">{{ overview[card.key] || 0 }}</span>
                <span class="unit">{{ card.unit }}</span>
              </div>
              <div class="card-label">{{ card.label }}</div>
            </div>
          </div>
          <div class="card-glow" :style="{ background: card.glowColor }"></div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-panel left-panel">
          <div class="panel-item">
            <div class="panel-header">
              <span class="panel-title">
                <el-icon :size="18"><TrendCharts /></el-icon>
                会议室使用率排行
              </span>
            </div>
            <div class="panel-body">
              <div ref="roomUsageChartRef" class="chart-container"></div>
            </div>
            <div class="panel-border"></div>
          </div>
          <div class="panel-item">
            <div class="panel-header">
              <span class="panel-title">
                <el-icon :size="18"><DataLine /></el-icon>
                每日预约趋势
              </span>
            </div>
            <div class="panel-body">
              <div ref="dailyChartRef" class="chart-container"></div>
            </div>
            <div class="panel-border"></div>
          </div>
        </div>

        <div class="chart-panel center-panel">
          <div class="panel-item real-time-panel">
            <div class="panel-header">
              <span class="panel-title">
                <el-icon :size="18"><VideoCamera /></el-icon>
                实时会议信息
              </span>
              <span class="live-badge">
                <span class="live-dot"></span>
                LIVE
              </span>
            </div>
            <div class="panel-body">
              <div class="real-time-section">
                <div class="section-title">
                  <el-icon :size="16"><CircleCheck /></el-icon>
                  正在进行 ({{ realTimeData.current_meetings?.length || 0 }})
                </div>
                <div class="meeting-list">
                  <div class="meeting-item" v-for="meeting in realTimeData.current_meetings?.slice(0, 4)" :key="meeting.id">
                    <div class="meeting-time">
                      <span class="time">{{ meeting.start_time }}</span>
                      <span class="divider">-</span>
                      <span class="time">{{ meeting.end_time }}</span>
                    </div>
                    <div class="meeting-info">
                      <div class="meeting-title">{{ meeting.meeting_title }}</div>
                      <div class="meeting-meta">
                        <span class="meta-item">
                          <el-icon :size="12"><Location /></el-icon>
                          {{ meeting.room_name }}
                        </span>
                        <span class="meta-item">
                          <el-icon :size="12"><User /></el-icon>
                          {{ meeting.user_name }}
                        </span>
                        <span class="meta-item">
                          <el-icon :size="12"><UserFilled /></el-icon>
                          {{ meeting.checkin_count || 0 }}/{{ meeting.attendee_count || 0 }}人
                        </span>
                      </div>
                    </div>
                    <div class="meeting-status in-use">进行中</div>
                  </div>
                  <div class="empty-tip" v-if="!realTimeData.current_meetings?.length">
                    <el-icon :size="32"><CircleInfo /></el-icon>
                    <span>暂无进行中的会议</span>
                  </div>
                </div>
              </div>
              <div class="real-time-section">
                <div class="section-title">
                  <el-icon :size="16"><Clock /></el-icon>
                  即将开始 ({{ realTimeData.upcoming_meetings?.length || 0 }})
                </div>
                <div class="meeting-list">
                  <div class="meeting-item upcoming" v-for="meeting in realTimeData.upcoming_meetings?.slice(0, 4)" :key="meeting.id">
                    <div class="meeting-time">
                      <span class="time">{{ meeting.start_time }}</span>
                      <span class="divider">-</span>
                      <span class="time">{{ meeting.end_time }}</span>
                    </div>
                    <div class="meeting-info">
                      <div class="meeting-title">{{ meeting.meeting_title }}</div>
                      <div class="meeting-meta">
                        <span class="meta-item">
                          <el-icon :size="12"><Location /></el-icon>
                          {{ meeting.room_name }}
                        </span>
                        <span class="meta-item">
                          <el-icon :size="12"><User /></el-icon>
                          {{ meeting.user_name }}
                        </span>
                      </div>
                    </div>
                    <div class="meeting-status upcoming">即将开始</div>
                  </div>
                  <div class="empty-tip" v-if="!realTimeData.upcoming_meetings?.length">
                    <el-icon :size="32"><CircleInfo /></el-icon>
                    <span>暂无即将开始的会议</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="panel-border"></div>
          </div>
        </div>

        <div class="chart-panel right-panel">
          <div class="panel-item">
            <div class="panel-header">
              <span class="panel-title">
                <el-icon :size="18"><PieChart /></el-icon>
                部门预约统计
              </span>
            </div>
            <div class="panel-body">
              <div ref="deptChartRef" class="chart-container"></div>
            </div>
            <div class="panel-border"></div>
          </div>
          <div class="panel-item">
            <div class="panel-header">
              <span class="panel-title">
                <el-icon :size="18"><Box /></el-icon>
                资产使用统计
              </span>
            </div>
            <div class="panel-body">
              <div ref="assetChartRef" class="chart-container"></div>
            </div>
            <div class="panel-border"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="screen-footer">
      <div class="footer-decoration"></div>
      <div class="footer-content">
        <span>© 2024 智能会议室管理系统</span>
        <span class="footer-divider">|</span>
        <span>数据每30秒自动刷新</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import {
  Monitor, Clock, OfficeBuilding, Goods, User,
  Calendar, DocumentChecked, Tools, TrendCharts,
  DataLine, VideoCamera, CircleCheck, Location,
  UserFilled, CircleInfo, PieChart, Box
} from '@element-plus/icons-vue'
import {
  getOverview,
  getRoomUsage,
  getDailyBookings,
  getDepartmentBookings,
  getAssetUsage,
  getRealTimeData
} from '@/api/dashboard'

const overview = reactive({})
const roomUsageData = ref([])
const dailyBookingsData = ref([])
const departmentData = ref([])
const assetUsageData = ref({ top_assets: [], category_stats: [] })
const realTimeData = reactive({ current_meetings: [], upcoming_meetings: [] })

const roomUsageChartRef = ref(null)
const dailyChartRef = ref(null)
const deptChartRef = ref(null)
const assetChartRef = ref(null)

let roomUsageChart = null
let dailyChart = null
let deptChart = null
let assetChart = null

const currentTime = ref('')
const isRefreshing = ref(false)
const refreshCountdown = ref(30)
let refreshTimer = null
let countdownTimer = null
let timeTimer = null

const statCards = [
  {
    key: 'total_rooms',
    label: '总会议室数',
    unit: '间',
    icon: OfficeBuilding,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    glowColor: 'rgba(102, 126, 234, 0.3)'
  },
  {
    key: 'total_assets',
    label: '总资产数',
    unit: '件',
    icon: Goods,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    glowColor: 'rgba(240, 147, 251, 0.3)'
  },
  {
    key: 'total_users',
    label: '总用户数',
    unit: '人',
    icon: User,
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    glowColor: 'rgba(79, 172, 254, 0.3)'
  },
  {
    key: 'today_bookings',
    label: '今日预约数',
    unit: '次',
    icon: Calendar,
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    glowColor: 'rgba(67, 233, 123, 0.3)'
  },
  {
    key: 'pending_approvals',
    label: '待审批数',
    unit: '条',
    icon: DocumentChecked,
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    glowColor: 'rgba(250, 112, 154, 0.3)'
  },
  {
    key: 'pending_repairs',
    label: '待维修数',
    unit: '项',
    icon: Tools,
    gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    glowColor: 'rgba(255, 154, 158, 0.3)'
  }
]

const chartColors = [
  '#00d4ff', '#0099ff', '#0066ff', '#667eea',
  '#764ba2', '#f093fb', '#f5576c', '#4facfe',
  '#43e97b', '#38f9d7', '#fa709a', '#fee140'
]

function updateCurrentTime() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const weekDay = weekDays[now.getDay()]
  currentTime.value = `${year}年${month}月${day}日 ${weekDay} ${hours}:${minutes}:${seconds}`
}

async function fetchAllData() {
  isRefreshing.value = true
  try {
    const [
      overviewRes,
      roomUsageRes,
      dailyBookingsRes,
      departmentRes,
      assetUsageRes,
      realTimeRes
    ] = await Promise.all([
      getOverview(),
      getRoomUsage(),
      getDailyBookings({ days: 14 }),
      getDepartmentBookings(),
      getAssetUsage(),
      getRealTimeData()
    ])

    if (overviewRes.data) {
      Object.assign(overview, overviewRes.data)
    }
    if (roomUsageRes.data?.list) {
      roomUsageData.value = roomUsageRes.data.list.slice(0, 8)
    }
    if (dailyBookingsRes.data?.list) {
      dailyBookingsData.value = dailyBookingsRes.data.list
    }
    if (departmentRes.data?.list) {
      departmentData.value = departmentRes.data.list.filter(item => item.booking_count > 0)
    }
    if (assetUsageRes.data) {
      assetUsageData.value = assetUsageRes.data
    }
    if (realTimeRes.data) {
      Object.assign(realTimeData, realTimeRes.data)
    }

    await nextTick()
    initCharts()
  } catch (error) {
    console.error('Fetch data failed:', error)
  } finally {
    isRefreshing.value = false
  }
}

function initCharts() {
  initRoomUsageChart()
  initDailyChart()
  initDeptChart()
  initAssetChart()
}

function initRoomUsageChart() {
  if (!roomUsageChartRef.value) return
  if (!roomUsageChart) {
    roomUsageChart = echarts.init(roomUsageChartRef.value)
  }

  const data = roomUsageData.value
  const roomNames = data.map(item => item.name).reverse()
  const bookingCounts = data.map(item => item.booking_count).reverse()

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(0, 20, 40, 0.9)',
      borderColor: '#00d4ff',
      textStyle: { color: '#fff' }
    },
    grid: {
      left: '3%',
      right: '8%',
      bottom: '3%',
      top: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#00d4ff', opacity: 0.3 } },
      axisLabel: { color: '#8ec5fc' },
      splitLine: { lineStyle: { color: '#00d4ff', opacity: 0.1 } }
    },
    yAxis: {
      type: 'category',
      data: roomNames,
      axisLine: { lineStyle: { color: '#00d4ff', opacity: 0.3 } },
      axisLabel: { color: '#8ec5fc', fontSize: 12 }
    },
    series: [{
      name: '预约次数',
      type: 'bar',
      data: bookingCounts,
      barWidth: '50%',
      itemStyle: {
        borderRadius: [0, 8, 8, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: 'rgba(0, 212, 255, 0.1)' },
          { offset: 1, color: '#00d4ff' }
        ])
      },
      emphasis: {
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: 'rgba(0, 212, 255, 0.3)' },
            { offset: 1, color: '#00f2fe' }
          ])
        }
      },
      label: {
        show: true,
        position: 'right',
        color: '#00d4ff',
        fontSize: 12,
        fontWeight: 'bold'
      }
    }]
  }

  roomUsageChart.setOption(option)
}

function initDailyChart() {
  if (!dailyChartRef.value) return
  if (!dailyChart) {
    dailyChart = echarts.init(dailyChartRef.value)
  }

  const data = dailyBookingsData.value
  const dates = data.map(item => item.date)
  const totalCounts = data.map(item => item.total_count)
  const completedCounts = data.map(item => item.completed_count)

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 20, 40, 0.9)',
      borderColor: '#43e97b',
      textStyle: { color: '#fff' }
    },
    legend: {
      data: ['总预约', '已完成'],
      textStyle: { color: '#8ec5fc' },
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#43e97b', opacity: 0.3 } },
      axisLabel: {
        color: '#8ec5fc',
        rotate: 30,
        fontSize: 10
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#43e97b', opacity: 0.3 } },
      axisLabel: { color: '#8ec5fc' },
      splitLine: { lineStyle: { color: '#43e97b', opacity: 0.1 } }
    },
    series: [
      {
        name: '总预约',
        type: 'line',
        smooth: true,
        data: totalCounts,
        lineStyle: { color: '#43e97b', width: 3 },
        itemStyle: { color: '#43e97b' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(67, 233, 123, 0.4)' },
            { offset: 1, color: 'rgba(67, 233, 123, 0.05)' }
          ])
        }
      },
      {
        name: '已完成',
        type: 'line',
        smooth: true,
        data: completedCounts,
        lineStyle: { color: '#00d4ff', width: 3 },
        itemStyle: { color: '#00d4ff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 212, 255, 0.4)' },
            { offset: 1, color: 'rgba(0, 212, 255, 0.05)' }
          ])
        }
      }
    ]
  }

  dailyChart.setOption(option)
}

function initDeptChart() {
  if (!deptChartRef.value) return
  if (!deptChart) {
    deptChart = echarts.init(deptChartRef.value)
  }

  const data = departmentData.value.map((item, index) => ({
    value: item.booking_count,
    name: item.name,
    itemStyle: {
      color: chartColors[index % chartColors.length]
    }
  }))

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0, 20, 40, 0.9)',
      borderColor: '#667eea',
      textStyle: { color: '#fff' },
      formatter: '{b}: {c}次 ({d}%)'
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#8ec5fc', fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10
    },
    series: [{
      name: '部门预约',
      type: 'pie',
      radius: ['35%', '65%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#0a1628',
        borderWidth: 2
      },
      label: {
        show: false
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold',
          color: '#fff'
        },
        itemStyle: {
          shadowBlur: 20,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      labelLine: {
        show: false
      },
      data: data
    }]
  }

  deptChart.setOption(option)
}

function initAssetChart() {
  if (!assetChartRef.value) return
  if (!assetChart) {
    assetChart = echarts.init(assetChartRef.value)
  }

  const data = assetUsageData.value.category_stats || []
  const categories = data.map(item => item.category)
  const totalQty = data.map(item => item.total_quantity)
  const availableQty = data.map(item => item.available_quantity)

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(0, 20, 40, 0.9)',
      borderColor: '#f093fb',
      textStyle: { color: '#fff' }
    },
    legend: {
      data: ['总量', '可用量'],
      textStyle: { color: '#8ec5fc' },
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: '#f093fb', opacity: 0.3 } },
      axisLabel: { color: '#8ec5fc', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#f093fb', opacity: 0.3 } },
      axisLabel: { color: '#8ec5fc' },
      splitLine: { lineStyle: { color: '#f093fb', opacity: 0.1 } }
    },
    series: [
      {
        name: '总量',
        type: 'bar',
        data: totalQty,
        barWidth: '30%',
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#f093fb' },
            { offset: 1, color: 'rgba(240, 147, 251, 0.3)' }
          ])
        }
      },
      {
        name: '可用量',
        type: 'bar',
        data: availableQty,
        barWidth: '30%',
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#4facfe' },
            { offset: 1, color: 'rgba(79, 172, 254, 0.3)' }
          ])
        }
      }
    ]
  }

  assetChart.setOption(option)
}

function handleResize() {
  roomUsageChart?.resize()
  dailyChart?.resize()
  deptChart?.resize()
  assetChart?.resize()
}

function startCountdown() {
  refreshCountdown.value = 30
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    refreshCountdown.value--
    if (refreshCountdown.value <= 0) {
      refreshCountdown.value = 30
      fetchAllData()
    }
  }, 1000)
}

onMounted(() => {
  updateCurrentTime()
  timeTimer = setInterval(updateCurrentTime, 1000)
  fetchAllData()
  startCountdown()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (countdownTimer) clearInterval(countdownTimer)
  if (timeTimer) clearInterval(timeTimer)
  window.removeEventListener('resize', handleResize)
  roomUsageChart?.dispose()
  dailyChart?.dispose()
  deptChart?.dispose()
  assetChart?.dispose()
})
</script>

<style lang="scss" scoped>
.big-screen {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #0a1628 0%, #1a2a4a 50%, #0d1b2a 100%);
  position: relative;
  color: #fff;
  font-family: 'Microsoft YaHei', sans-serif;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image:
      linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px);
    background-size: 50px 50px;
    pointer-events: none;
    z-index: 0;
  }
}

.screen-header {
  position: relative;
  z-index: 10;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 40px;
  background: linear-gradient(180deg, rgba(0, 212, 255, 0.1) 0%, transparent 100%);
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);

  .header-decoration {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 200px;
    height: 2px;
    background: linear-gradient(90deg, transparent, #00d4ff, transparent);

    &.left {
      left: 10%;
    }

    &.right {
      right: 10%;
      transform: translateY(-50%) scaleX(-1);
    }
  }

  .screen-title {
    font-size: 32px;
    font-weight: bold;
    background: linear-gradient(90deg, #00d4ff, #43e97b, #00d4ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    display: flex;
    align-items: center;
    gap: 16px;
    text-shadow: 0 0 30px rgba(0, 212, 255, 0.5);
    margin: 0;

    .title-icon {
      color: #00d4ff;
      filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.8));
    }
  }

  .header-info {
    position: absolute;
    right: 40px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;

    .current-time {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #8ec5fc;
      font-size: 14px;
    }

    .refresh-status {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #43e97b;
      font-size: 12px;

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #43e97b;
        animation: blink 1s infinite;

        &.active {
          background: #f5576c;
        }
      }
    }
  }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.screen-content {
  position: relative;
  z-index: 1;
  padding: 20px 30px;
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 20px;
  flex-shrink: 0;
}

.stat-card {
  position: relative;
  height: 100px;
  background: linear-gradient(135deg, rgba(15, 35, 65, 0.8) 0%, rgba(10, 22, 40, 0.9) 100%);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-5px);
    border-color: rgba(0, 212, 255, 0.5);
    box-shadow: 0 10px 30px rgba(0, 212, 255, 0.2);
  }

  .card-bg {
    position: absolute;
    top: -50%;
    right: -20%;
    width: 150px;
    height: 150px;
    background: radial-gradient(circle, rgba(0, 212, 255, 0.1) 0%, transparent 70%);
    border-radius: 50%;
  }

  .card-content {
    position: relative;
    z-index: 2;
    height: 100%;
    padding: 0 20px;
    display: flex;
    align-items: center;
    gap: 16px;

    .card-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }

    .card-info {
      flex: 1;
      overflow: hidden;

      .card-value {
        display: flex;
        align-items: baseline;
        gap: 4px;

        .number {
          font-size: 32px;
          font-weight: bold;
          color: #fff;
          line-height: 1;
          font-family: 'DIN', 'Microsoft YaHei', sans-serif;
        }

        .unit {
          font-size: 14px;
          color: #8ec5fc;
        }
      }

      .card-label {
        font-size: 14px;
        color: #8ec5fc;
        margin-top: 6px;
      }
    }
  }

  .card-glow {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    opacity: 0.8;
  }
}

.charts-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  gap: 20px;
  min-height: 0;
}

.chart-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}

.panel-item {
  position: relative;
  flex: 1;
  background: linear-gradient(135deg, rgba(15, 35, 65, 0.6) 0%, rgba(10, 22, 40, 0.8) 100%);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 12px;
  overflow: hidden;
  min-height: 0;

  &.real-time-panel {
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    height: 48px;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(0, 212, 255, 0.15);
    background: linear-gradient(90deg, rgba(0, 212, 255, 0.05) 0%, transparent 100%);

    .panel-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #00d4ff;

      .el-icon {
        filter: drop-shadow(0 0 5px rgba(0, 212, 255, 0.8));
      }
    }

    .live-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: rgba(245, 87, 108, 0.2);
      border: 1px solid rgba(245, 87, 108, 0.5);
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      color: #f5576c;

      .live-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #f5576c;
        animation: pulse 1.5s infinite;
      }
    }
  }

  .panel-body {
    padding: 16px;
    height: calc(100% - 48px);
    min-height: 0;
  }

  .chart-container {
    width: 100%;
    height: 100%;
    min-height: 200px;
  }

  .panel-border {
    position: absolute;
    width: 20px;
    height: 20px;
    border: 2px solid #00d4ff;
    opacity: 0.6;

    &::before {
      content: '';
      position: absolute;
      width: 8px;
      height: 8px;
      background: #00d4ff;
      border-radius: 50%;
    }

    &:nth-child(1) {
      top: -1px;
      left: -1px;
      border-right: none;
      border-bottom: none;
      border-radius: 12px 0 0 0;

      &::before {
        top: -4px;
        left: -4px;
      }
    }

    &:nth-child(2) {
      top: -1px;
      right: -1px;
      border-left: none;
      border-bottom: none;
      border-radius: 0 12px 0 0;

      &::before {
        top: -4px;
        right: -4px;
      }
    }

    &:nth-child(3) {
      bottom: -1px;
      left: -1px;
      border-right: none;
      border-top: none;
      border-radius: 0 0 0 12px;

      &::before {
        bottom: -4px;
        left: -4px;
      }
    }

    &:nth-child(4) {
      bottom: -1px;
      right: -1px;
      border-left: none;
      border-top: none;
      border-radius: 0 0 12px 0;

      &::before {
        bottom: -4px;
        right: -4px;
      }
    }
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
  }
}

.real-time-section {
  height: 50%;
  display: flex;
  flex-direction: column;
  min-height: 0;

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #43e97b;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(67, 233, 123, 0.2);

    .el-icon {
      filter: drop-shadow(0 0 5px rgba(67, 233, 123, 0.8));
    }
  }

  .meeting-list {
    flex: 1;
    overflow-y: auto;
    padding-right: 8px;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(0, 212, 255, 0.1);
      border-radius: 2px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0, 212, 255, 0.3);
      border-radius: 2px;
    }
  }

  .meeting-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    margin-bottom: 10px;
    background: linear-gradient(90deg, rgba(0, 212, 255, 0.08) 0%, transparent 100%);
    border-left: 3px solid #00d4ff;
    border-radius: 0 8px 8px 0;
    transition: all 0.3s ease;

    &:hover {
      background: linear-gradient(90deg, rgba(0, 212, 255, 0.15) 0%, transparent 100%);
      transform: translateX(5px);
    }

    &.upcoming {
      border-left-color: #fee140;
      background: linear-gradient(90deg, rgba(254, 225, 64, 0.08) 0%, transparent 100%);

      &:hover {
        background: linear-gradient(90deg, rgba(254, 225, 64, 0.15) 0%, transparent 100%);
      }
    }

    .meeting-time {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 60px;

      .time {
        font-size: 12px;
        color: #00d4ff;
        font-weight: 600;
      }

      .divider {
        font-size: 10px;
        color: #8ec5fc;
        margin: 2px 0;
      }
    }

    .meeting-info {
      flex: 1;
      min-width: 0;

      .meeting-title {
        font-size: 14px;
        font-weight: 600;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 4px;
      }

      .meeting-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #8ec5fc;

          .el-icon {
            flex-shrink: 0;
          }
        }
      }
    }

    .meeting-status {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;

      &.in-use {
        background: rgba(67, 233, 123, 0.2);
        color: #43e97b;
        border: 1px solid rgba(67, 233, 123, 0.5);
        animation: statusPulse 2s infinite;
      }

      &.upcoming {
        background: rgba(254, 225, 64, 0.2);
        color: #fee140;
        border: 1px solid rgba(254, 225, 64, 0.5);
      }
    }
  }

  .empty-tip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 80px;
    color: #8ec5fc;
    font-size: 12px;
    gap: 8px;
    opacity: 0.6;
  }
}

@keyframes statusPulse {
  0%, 100% {
    box-shadow: 0 0 5px rgba(67, 233, 123, 0.5);
  }
  50% {
    box-shadow: 0 0 15px rgba(67, 233, 123, 0.8);
  }
}

.screen-footer {
  position: relative;
  z-index: 10;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid rgba(0, 212, 255, 0.2);
  background: linear-gradient(0deg, rgba(0, 212, 255, 0.05) 0%, transparent 100%);

  .footer-decoration {
    position: absolute;
    top: 0;
    left: 10%;
    right: 10%;
    height: 1px;
    background: linear-gradient(90deg, transparent, #00d4ff, transparent);
  }

  .footer-content {
    display: flex;
    align-items: center;
    gap: 16px;
    color: #8ec5fc;
    font-size: 12px;

    .footer-divider {
      opacity: 0.5;
    }
  }
}

@media (max-width: 1600px) {
  .stat-cards {
    grid-template-columns: repeat(6, 1fr);
    gap: 15px;
  }

  .stat-card {
    height: 85px;

    .card-content {
      padding: 0 15px;
      gap: 12px;
    }

    .card-icon {
      width: 48px;
      height: 48px;
    }

    .card-info {
      .card-value {
        .number {
          font-size: 26px;
        }
      }

      .card-label {
        font-size: 12px;
      }
    }
  }

  .screen-title {
    font-size: 26px !important;
  }
}
</style>
