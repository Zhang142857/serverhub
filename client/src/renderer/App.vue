<template>
  <el-config-provider :locale="zhCn">
    <div class="app-container">
      <Sidebar />
      <div class="main-content">
        <Header />
        <div class="page-content">
          <router-view v-slot="{ Component, route }">
            <transition name="page-slide" mode="out-in">
              <component :is="Component" :key="route.path" />
            </transition>
          </router-view>
        </div>
      </div>
      <AIAssistant />
      <TaskPanel />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
// @ts-ignore
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import Sidebar from './components/layout/Sidebar.vue'
import Header from './components/layout/Header.vue'
import AIAssistant from './components/ai/AIAssistant.vue'
import TaskPanel from './components/layout/TaskPanel.vue'
import { useServerStore } from './stores/server'

const serverStore = useServerStore()

// 启动时自动连接所有服务器
onMounted(() => {
  setTimeout(() => {
    serverStore.autoConnectAll()
  }, 500)
})
</script>

<style lang="scss">
.app-container {
  display: flex;
  height: 100vh;
  background-color: var(--bg-color);
  color: var(--text-color);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-content {
  flex: 1;
  overflow: auto;
  padding: var(--space-5);
}

// 页面切换动画 - 淡入淡出 + 轻微上移
.page-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-slide-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.page-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

// 备用的简单淡入淡出动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
