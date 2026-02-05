<template>
  <el-config-provider :locale="zhCn">
    <div class="app-container">
      <Sidebar />
      <div class="main-content">
        <Header />
        <div class="page-content">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
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
  padding: 20px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
