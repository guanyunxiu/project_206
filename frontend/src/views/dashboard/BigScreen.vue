<template>
  <div class="big-screen">
    <div class="header">
      <div class="header-left">
        <el-icon :size="32" color="#00d4ff"><Monitor /></el-icon>
        <h1 class="title">会议室与资产综合管理数据驾驶舱</h1>
      </div>
      <div class="header-center">
        <div class="current-time">{{ currentTime }}</div>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Refresh" @click="handleRefresh" :loading="loading">
          刷新数据
        </el-button>
      </div>
    </div>

    <div class="content">
      <div class="metrics-row">
        <div
          v-for="(metric, index) in metricCards"
          :key="metric.key"
          class="metric-card"
          :class="`border-${index + 1}`"
        >
          <div class="metric-content">
            <div class="metric-info">
              <div class="metric-value">{{ data.coreMetrics?.[metric.key] || 0 }}</div>
              <div class="metric-label">{{ metric.label }}</div>
            </div>
            <div class="metric-icon" :style="{ backgroundColor: metric.bgColor }">
              <el-icon :size="32" color="#fff">
                <component :is="metric.icon" />
              </el-icon>
            </div>
          </div>
          <div class="metric-trend" v-if="metric.trend">
            <el-icon :size="14" :color="metric.trend > 0 ? '#ff6b6b' : '#00ff88'">
              <CaretTop v-if="metric.trend > 0" />
              <CaretBottom v-else />
            </el-icon>
            <span :style="{ color: metric.trend > 0 ? '#ff6b6b' : '#00ff88' }">
              {{ Math.abs(metric.trend) }}%
            </span>
            <span class="trend-text">较昨日</span>
          </div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card chart-lg">
          <div class="card-header">
            <el-icon :size="18" color="#00d4ff"><DataLine /></el-icon>
            <span>会议室使用率趋势</span>
          </div>
          <div ref="roomUsageTrendRef" class="chart-container"></div>
        </div>
        <div class="chart-card chart-lg">
          <div class="card-header">
            <el-icon :size="18" color="#00ff88"><DataBoard /></el-icon>
            <span>各部门预约统计</span>
          </div>
          <div ref="departmentBookingsRef" class="chart-container"></div>
        </div>
        <div class="chart-card chart-md">
          <div class="card-header">
            <el-icon :size="18" color="#ffb800"><PieChart /></el-icon>
            <span>签到率统计</span>
          </div>
          <div ref="checkinStatsRef" class="chart-container"></div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card chart-xl">
          <div class="card-header">
            <el-icon :size="18" color="#ff6b6b"><Warning /></el-icon>
            <span>异常数据监控</span>
          </div>
          <div class="anomaly-container">
            <div class="anomaly-section">
              <div class="section-title">
                <el-tag type="danger" size="small">高爽约率部门</el-tag>
              </div>
              <el-table
                :data="data.anomalies?.highViolationDepartments || []"
                size="small"
                :header-cell-style="tableHeaderStyle"
                :cell-style="tableCellStyle"
                height="160"
              >
                <el-table-column prop="department" label="部门名" min-width="120" />
                <el-table-column prop="violation_rate" label="爽约率" width="100">
                  <template #default="{ row }">
                    <span style="color: #ff6b6b">{{ (row.violation_rate * 100).toFixed(1) }}%</span>
                  </template>
                </el-table-column>
                <el-table-column prop="count" label="次数" width="80" />
              </el-table>
            </div>

            <div class="anomaly-section">
              <div class="section-title">
                <el-tag type="warning" size="small">逾期资产</el-tag>
              </div>
              <el-table
                :data="data.anomalies?.overdueAssets || []"
                size="small"
                :header-cell-style="tableHeaderStyle"
                :cell-style="tableCellStyle"
                height="160"
              >
                <el-table-column prop="asset_name" label="资产名" min-width="120" />
                <el-table-column prop="borrower_name" label="借用人" width="100" />
                <el-table-column prop="overdue_days" label="逾期天数" width="100">
                  <template #default="{ row }">
                    <span style="color: #ffb800">{{ row.overdue_days }}天</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <div class="anomaly-section">
              <div class="section-title">
                <el-tag type="danger" size="small">待处理报修</el-tag>
              </div>
              <el-table
                :data="data.anomalies?.pendingRepairs || []"
                size="small"
                :header-cell-style="tableHeaderStyle"
                :cell-style="tableCellStyle"
                height="160"
              >
                <el-table-column prop="asset_name" label="资产名" min-width="120" />
                <el-table-column prop="reporter_name" label="报修人" width="100" />
                <el-table-column prop="priority" label="紧急程度" width="100">
                  <template #default="{ row }">
                    <el-tag
                      :type="row.priority === 'high' ? 'danger' : row.priority === 'medium' ? 'warning' : 'info'"
                      size="small"
                    >
                      {{ row.priority === 'high' ? '高' : row.priority === 'medium' ? '中' : '低' }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <div class="anomaly-section">
              <div class="section-title">
                <el-tag type="warning" size="small">超时待审批</el-tag>
              </div>
              <el-table
                :data="data.anomalies?.timeoutApprovals || []"
                size="small"
                :header-cell-style="tableHeaderStyle"
                :cell-style="tableCellStyle"
                height="160"
              >
                <el-table-column prop="meeting_title" label="会议主题" min-width="140" show-overflow-tooltip />
                <el-table-column prop="applicant_name" label="申请人" width="100" />
                <el-table-column prop="wait_hours" label="等待时长" width="100">
                  <template #default="{ row }">
                    <span style="color: #ffb800">{{ row.wait_hours }}小时</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <div class="anomaly-section">
              <div class="section-title">
                <el-tag type="danger" size="small">高频爽约用户</el-tag>
              </div>
              <el-table
                :data="data.anomalies?.highViolationUsers || []"
                size="small"
                :header-cell-style="tableHeaderStyle"
                :cell-style="tableCellStyle"
                height="160"
              >
                <el-table-column prop="user_name" label="用户名" min-width="120" />
                <el-table-column prop="violation_count" label="爽约次数" width="100">
                  <template #default="{ row }">
                    <span style="color: #ff6b6b">{{ row.violation_count }}次</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
        <div class="chart-card chart-md">
          <div class="card-header">
            <el-icon :size="18" color="#a855f7"><PieChart /></el-icon>
            <span>资产状态分布</span>
          </div>
          <div ref="assetStatsRef" class="chart-container"></div>
        </div>
      </div>
    </div>

    <div class="footer">
      <span>© 2024 会议室与资产管理系统 | Data updated every 60 seconds</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, reactive } from 'vue'
import * as echarts from 'echarts'
import {
  Monitor, Refresh, Calendar, OfficeBuilding, User,
  CircleCheck, Tools, Box, DataLine, DataBoard,
  PieChart, Warning, CaretTop, CaretBottom
} from '@element-plus/icons-vue'
import { getStatistics } from '@/api/booking'

const loading = ref(false)
const currentTime = ref('')
const data = ref({})

const roomUsageTrendRef = ref(null)
const departmentBookingsRef = ref(null)
const checkinStatsRef = ref(null)
const assetStatsRef = ref(null)

let roomUsageTrendChart = null
let departmentBookingsChart = null
let checkinStatsChart = null
let assetStatsChart = null
let timeInterval = null
let refreshInterval = null

const tableHeaderStyle = {
  backgroundColor: 'rgba(42, 63, 127, 0.5)',
  color: '#e6f1ff',
  borderColor: '#2a3f7f',
  fontWeight: '500'
}

const tableCellStyle = {
  backgroundColor: 'transparent',
  color: '#8aa4d4',
  borderColor: 'rgba(42, 63, 127, 0.3)'
}

const metricCards = [
  { key: 'todayBookings', label: '今日预约数', icon: Calendar, bgColor: 'rgba(0, 212, 255, 0.2)', trend: 12.5 },
  { key: 'todayMeetings', label: '今日会议数', icon: OfficeBuilding, bgColor: 'rgba(0, 255, 136, 0.2)', trend: -5.2 },
  { key: 'inProgressMeetings', label: '正在开会', icon: User, bgColor: 'rgba(255, 184, 0, 0.2)', trend: 8.3 },
  { key: 'pendingApprovals', label: '待我审批', icon: CircleCheck, bgColor: 'rgba(168, 85, 247, 0.2)', trend: -3.1 },
  { key: 'pendingRepairs', label: '待处理报修', icon: Tools, bgColor: 'rgba(255, 107, 107, 0.2)', trend: 15.7 },
  { key: 'overdueAssets', label: '逾期资产', icon: Box, bgColor: 'rgba(255, 184, 0, 0.2)', trend: 2.4 }
]

function updateTime() {
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

async function fetchData() {
  loading.value = true
  try {
    const res = await getStatistics()
    data.value = res.data
    await nextTick()
    initCharts()
  } catch (error) {
    console.error('Fetch statistics failed:', error)
  } finally {
    loading.value = false
  }
}

function handleRefresh() {
  fetchData()
}

function initCharts() {
  initRoomUsageTrendChart()
  initDepartmentBookingsChart()
  initCheckinStatsChart()
  initAssetStatsChart()
}

function initRoomUsageTrendChart() {
  if (!roomUsageTrendRef.value) return

  if (roomUsageTrendChart) {
    roomUsageTrendChart.dispose()
  }

  roomUsageTrendChart = echarts.init(roomUsageTrendRef.value)
  const trendData = data.value.roomUsageTrend || []

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(16, 26, 59, 0.9)',
      borderColor: '#2a3f7f',
      textStyle: { color: '#e6f1ff' },
      formatter: '{b}<br/>使用率: {c}%'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: trendData.map(item => item.date),
      axisLine: { lineStyle: { color: '#2a3f7f' } },
      axisLabel: { color: '#8aa4d4', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLine: { lineStyle: { color: '#2a3f7f' } },
      axisLabel: { color: '#8aa4d4', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: 'rgba(42, 63, 127, 0.3)' } }
    },
    series: [
      {
        name: '使用率',
        type: 'line',
        smooth: true,
        data: trendData.map(item => item.rate),
        lineStyle: {
          color: '#00d4ff',
          width: 3,
          shadowColor: 'rgba(0, 212, 255, 0.5)',
          shadowBlur: 10
        },
        itemStyle: {
          color: '#00d4ff',
          borderColor: '#fff',
          borderWidth: 2
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 212, 255, 0.4)' },
            { offset: 1, color: 'rgba(0, 212, 255, 0.05)' }
          ])
        },
        symbol: 'circle',
        symbolSize: 8
      }
    ]
  }

  roomUsageTrendChart.setOption(option)
}

function initDepartmentBookingsChart() {
  if (!departmentBookingsRef.value) return

  if (departmentBookingsChart) {
    departmentBookingsChart.dispose()
  }

  departmentBookingsChart = echarts.init(departmentBookingsRef.value)
  const deptData = data.value.departmentBookings || []

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(16, 26, 59, 0.9)',
      borderColor: '#2a3f7f',
      textStyle: { color: '#e6f1ff' },
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: deptData.map(item => item.department),
      axisLine: { lineStyle: { color: '#2a3f7f' } },
      axisLabel: { color: '#8aa4d4', fontSize: 10, rotate: 30, interval: 0 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#2a3f7f' } },
      axisLabel: { color: '#8aa4d4', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(42, 63, 127, 0.3)' } }
    },
    series: [
      {
        name: '预约次数',
        type: 'bar',
        data: deptData.map(item => item.count),
        barWidth: '50%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#00ff88' },
            { offset: 1, color: 'rgba(0, 255, 136, 0.2)' }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: {
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#00ff88' },
              { offset: 1, color: '#00ff88' }
            ])
          }
        }
      }
    ]
  }

  departmentBookingsChart.setOption(option)
}

function initCheckinStatsChart() {
  if (!checkinStatsRef.value) return

  if (checkinStatsChart) {
    checkinStatsChart.dispose()
  }

  checkinStatsChart = echarts.init(checkinStatsRef.value)
  const stats = data.value.checkinStats || {}

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(16, 26, 59, 0.9)',
      borderColor: '#2a3f7f',
      textStyle: { color: '#e6f1ff' },
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#8aa4d4', fontSize: 12 },
      itemWidth: 12,
      itemHeight: 12
    },
    series: [
      {
        name: '签到状态',
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: 'rgba(16, 26, 59, 0.8)',
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
            color: '#e6f1ff'
          }
        },
        data: [
          { value: stats.checked_in || 0, name: '已签到', itemStyle: { color: '#00ff88' } },
          { value: stats.no_show || 0, name: '未签到', itemStyle: { color: '#ff6b6b' } },
          { value: stats.pending || 0, name: '待签到', itemStyle: { color: '#ffb800' } }
        ]
      }
    ]
  }

  checkinStatsChart.setOption(option)
}

function initAssetStatsChart() {
  if (!assetStatsRef.value) return

  if (assetStatsChart) {
    assetStatsChart.dispose()
  }

  assetStatsChart = echarts.init(assetStatsRef.value)
  const stats = data.value.assetStats || {}

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(16, 26, 59, 0.9)',
      borderColor: '#2a3f7f',
      textStyle: { color: '#e6f1ff' },
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#8aa4d4', fontSize: 12 },
      itemWidth: 12,
      itemHeight: 12
    },
    series: [
      {
        name: '资产状态',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        roseType: 'radius',
        itemStyle: {
          borderRadius: 8,
          borderColor: 'rgba(16, 26, 59, 0.8)',
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
            color: '#e6f1ff'
          }
        },
        data: [
          { value: stats.available || 0, name: '可用', itemStyle: { color: '#00d4ff' } },
          { value: stats.borrowed || 0, name: '借用中', itemStyle: { color: '#ffb800' } },
          { value: stats.repairing || 0, name: '维修中', itemStyle: { color: '#ff6b6b' } },
          { value: stats.scrapped || 0, name: '报废', itemStyle: { color: '#8aa4d4' } }
        ]
      }
    ]
  }

  assetStatsChart.setOption(option)
}

function handleResize() {
  roomUsageTrendChart?.resize()
  departmentBookingsChart?.resize()
  checkinStatsChart?.resize()
  assetStatsChart?.resize()
}

onMounted(() => {
  updateTime()
  timeInterval = setInterval(updateTime, 1000)
  fetchData()
  refreshInterval = setInterval(fetchData, 60000)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval)
  if (refreshInterval) clearInterval(refreshInterval)
  window.removeEventListener('resize', handleResize)
  roomUsageTrendChart?.dispose()
  departmentBookingsChart?.dispose()
  checkinStatsChart?.dispose()
  assetStatsChart?.dispose()
})
</script>

<style lang="scss" scoped>
.big-screen {
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0a0e27 100%);
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  color: #e6f1ff;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image:
      linear-gradient(rgba(42, 63, 127, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(42, 63, 127, 0.1) 1px, transparent 1px);
    background-size: 50px 50px;
    pointer-events: none;
  }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: linear-gradient(90deg, rgba(16, 26, 59, 0.9) 0%, rgba(16, 26, 59, 0.5) 50%, rgba(16, 26, 59, 0.9) 100%);
  border: 1px solid #2a3f7f;
  border-radius: 8px;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .title {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      background: linear-gradient(90deg, #00d4ff 0%, #00ff88 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
    }
  }

  .header-center {
    .current-time {
      font-size: 18px;
      font-weight: 500;
      color: #00d4ff;
      font-family: 'Courier New', monospace;
      text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
    }
  }

  .header-right {
    :deep(.el-button) {
      background: linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 255, 136, 0.2) 100%);
      border: 1px solid #00d4ff;
      color: #00d4ff;

      &:hover {
        background: linear-gradient(135deg, rgba(0, 212, 255, 0.3) 0%, rgba(0, 255, 136, 0.3) 100%);
        box-shadow: 0 0 15px rgba(0, 212, 255, 0.3);
      }
    }
  }
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.metrics-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
}

.metric-card {
  background: rgba(16, 26, 59, 0.8);
  border-radius: 12px;
  padding: 20px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 3px 3px 0 0;
  }

  &.border-1::before {
    background: linear-gradient(90deg, #00d4ff 0%, #0099cc 100%);
    box-shadow: 0 0 15px rgba(0, 212, 255, 0.5);
  }

  &.border-2::before {
    background: linear-gradient(90deg, #00ff88 0%, #00cc6a 100%);
    box-shadow: 0 0 15px rgba(0, 255, 136, 0.5);
  }

  &.border-3::before {
    background: linear-gradient(90deg, #ffb800 0%, #cc9300 100%);
    box-shadow: 0 0 15px rgba(255, 184, 0, 0.5);
  }

  &.border-4::before {
    background: linear-gradient(90deg, #a855f7 0%, #7c3aed 100%);
    box-shadow: 0 0 15px rgba(168, 85, 247, 0.5);
  }

  &.border-5::before {
    background: linear-gradient(90deg, #ff6b6b 0%, #ee5a5a 100%);
    box-shadow: 0 0 15px rgba(255, 107, 107, 0.5);
  }

  &.border-6::before {
    background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
    box-shadow: 0 0 15px rgba(245, 158, 11, 0.5);
  }

  .metric-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;

    .metric-info {
      .metric-value {
        font-size: 32px;
        font-weight: 700;
        color: #e6f1ff;
        line-height: 1.2;
        text-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
      }

      .metric-label {
        font-size: 13px;
        color: #8aa4d4;
        margin-top: 4px;
      }
    }

    .metric-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
    }
  }

  .metric-trend {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;

    .trend-text {
      color: #8aa4d4;
      margin-left: 4px;
    }
  }
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  flex: 1;
}

.chart-card {
  background: rgba(16, 26, 59, 0.8);
  border: 1px solid #2a3f7f;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 2px;
    height: 30px;
    background: linear-gradient(180deg, #00d4ff 0%, transparent 100%);
  }

  &.chart-lg {
    grid-column: span 1;
  }

  &.chart-md {
    grid-column: span 1;
  }

  &.chart-xl {
    grid-column: span 3;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    color: #e6f1ff;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(42, 63, 127, 0.5);
  }

  .chart-container {
    flex: 1;
    min-height: 280px;
  }
}

.anomaly-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  max-height: 520px;
  overflow-y: auto;
  padding-right: 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(42, 63, 127, 0.2);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 212, 255, 0.5);
    border-radius: 3px;
  }
}

.anomaly-section {
  .section-title {
    margin-bottom: 8px;
  }

  :deep(.el-table) {
    background: transparent;

    &::before {
      display: none;
    }

    .el-table__row:hover > td {
      background-color: rgba(42, 63, 127, 0.3) !important;
    }

    .el-table__body tr.current-row > td {
      background-color: rgba(42, 63, 127, 0.4) !important;
    }
  }

  :deep(.el-table--border) {
    border: 1px solid rgba(42, 63, 127, 0.5);

    .el-table__cell {
      border-right: 1px solid rgba(42, 63, 127, 0.3);
      border-bottom: 1px solid rgba(42, 63, 127, 0.3);
    }
  }

  :deep(.el-table__empty-block) {
    background: transparent;
  }

  :deep(.el-table__empty-text) {
    color: #8aa4d4;
  }
}

.footer {
  text-align: center;
  padding: 12px;
  color: #8aa4d4;
  font-size: 12px;
  border-top: 1px solid rgba(42, 63, 127, 0.3);
  margin-top: 16px;
  position: relative;
  z-index: 1;
}

@media (max-width: 1600px) {
  .metrics-row {
    grid-template-columns: repeat(3, 1fr);
  }

  .charts-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-card.chart-xl {
    grid-column: span 2;
  }

  .anomaly-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 1200px) {
  .metrics-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .charts-row {
    grid-template-columns: 1fr;
  }

  .chart-card.chart-xl {
    grid-column: span 1;
  }

  .anomaly-container {
    grid-template-columns: 1fr;
  }
}
</style>
