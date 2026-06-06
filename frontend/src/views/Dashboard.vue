<template>
  <div class="page-container dashboard">
    <el-row :gutter="20" class="stat-cards">
      <el-col :xs="12" :sm="6" v-for="item in statItems" :key="item.key">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <div class="stat-value">{{ statistics.overview?.[item.key] || 0 }}</div>
              <div class="stat-label">{{ item.label }}</div>
            </div>
            <div class="stat-icon" :style="{ backgroundColor: item.color }">
              <el-icon :size="28" color="#fff">
                <component :is="item.icon" />
              </el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :lg="12" :xs="24">
        <el-card class="chart-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>会议室使用排行</span>
            </div>
          </template>
          <div ref="roomUsageChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :lg="12" :xs="24">
        <el-card class="chart-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>近期预约趋势</span>
            </div>
          </template>
          <div ref="dailyChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :lg="8" :xs="24">
        <el-card class="chart-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>预约状态分布</span>
            </div>
          </template>
          <div ref="statusChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :lg="16" :xs="24">
        <el-card class="chart-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>各部门预约统计</span>
            </div>
          </template>
          <div ref="deptChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { 
  OfficeBuilding, Goods, User, Calendar,
  Clock, CircleCheck, CircleClose, Box
} from '@element-plus/icons-vue'
import { getStatistics } from '@/api/booking'

const statistics = ref({})
const roomUsageChartRef = ref(null)
const dailyChartRef = ref(null)
const statusChartRef = ref(null)
const deptChartRef = ref(null)

let roomUsageChart = null
let dailyChart = null
let statusChart = null
let deptChart = null

const statItems = [
  { key: 'total_rooms', label: '会议室总数', icon: OfficeBuilding, color: '#409EFF' },
  { key: 'total_assets', label: '资产总数', icon: Goods, color: '#67C23A' },
  { key: 'total_users', label: '用户总数', icon: User, color: '#E6A23C' },
  { key: 'total_bookings', label: '预约总数', icon: Calendar, color: '#F56C6C' },
  { key: 'pending_bookings', label: '待使用', icon: Clock, color: '#909399' },
  { key: 'completed_bookings', label: '已完成', icon: CircleCheck, color: '#67C23A' },
  { key: 'cancelled_bookings', label: '已取消', icon: CircleClose, color: '#F56C6C' },
  { key: 'borrowed_assets', label: '借用中资产', icon: Box, color: '#E6A23C' }
]

async function fetchData() {
  try {
    const res = await getStatistics()
    statistics.value = res.data
    await nextTick()
    initCharts()
  } catch (error) {
    console.error('Fetch statistics failed:', error)
  }
}

function initCharts() {
  if (roomUsageChartRef.value) {
    roomUsageChart = echarts.init(roomUsageChartRef.value)
    const roomData = statistics.value.room_usage || []
    roomUsageChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value' },
      yAxis: {
        type: 'category',
        data: roomData.map(item => item.name).reverse()
      },
      series: [{
        name: '预约次数',
        type: 'bar',
        data: roomData.map(item => item.booking_count).reverse(),
        itemStyle: { color: '#409EFF', borderRadius: [0, 4, 4, 0] }
      }]
    })
  }

  if (dailyChartRef.value) {
    dailyChart = echarts.init(dailyChartRef.value)
    const dailyData = statistics.value.daily_bookings || []
    dailyChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dailyData.map(item => item.date).reverse(),
        axisLabel: { rotate: 45 }
      },
      yAxis: { type: 'value' },
      series: [{
        name: '预约数量',
        type: 'line',
        smooth: true,
        data: dailyData.map(item => item.count).reverse(),
        areaStyle: { color: 'rgba(64, 158, 255, 0.3)' },
        lineStyle: { color: '#409EFF', width: 2 },
        itemStyle: { color: '#409EFF' }
      }]
    })
  }

  if (statusChartRef.value) {
    statusChart = echarts.init(statusChartRef.value)
    const overview = statistics.value.overview || {}
    statusChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical', left: 'left' },
      series: [{
        name: '预约状态',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
        data: [
          { value: overview.pending_bookings || 0, name: '待使用', itemStyle: { color: '#E6A23C' } },
          { value: overview.completed_bookings || 0, name: '已完成', itemStyle: { color: '#67C23A' } },
          { value: overview.cancelled_bookings || 0, name: '已取消', itemStyle: { color: '#F56C6C' } }
        ]
      }]
    })
  }

  if (deptChartRef.value) {
    deptChart = echarts.init(deptChartRef.value)
    const deptData = statistics.value.department_bookings || []
    deptChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: deptData.map(item => item.name),
        axisLabel: { interval: 0, rotate: 30 }
      },
      yAxis: { type: 'value' },
      series: [{
        name: '预约次数',
        type: 'bar',
        data: deptData.map(item => item.booking_count),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#83bff6' },
            { offset: 0.5, color: '#188df0' },
            { offset: 1, color: '#188df0' }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        barWidth: '50%'
      }]
    })
  }
}

function handleResize() {
  roomUsageChart?.resize()
  dailyChart?.resize()
  statusChart?.resize()
  deptChart?.resize()
}

onMounted(() => {
  fetchData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  roomUsageChart?.dispose()
  dailyChart?.dispose()
  statusChart?.dispose()
  deptChart?.dispose()
})
</script>

<style lang="scss" scoped>
.dashboard {
  .stat-cards {
    margin-bottom: 20px;
  }

  .stat-card {
    margin-bottom: 20px;

    .stat-content {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .stat-info {
        .stat-value {
          font-size: 28px;
          font-weight: 600;
          color: #303133;
          line-height: 1.2;
        }

        .stat-label {
          font-size: 14px;
          color: #909399;
          margin-top: 4px;
        }
      }

      .stat-icon {
        width: 60px;
        height: 60px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }

  .charts-row {
    margin-bottom: 20px;
  }

  .chart-card {
    .card-header {
      font-weight: 600;
      font-size: 16px;
    }

    .chart-container {
      height: 300px;
    }
  }
}
</style>
