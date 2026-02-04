import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Server {
  id: string
  name: string
  host: string
  port: number
  token: string
  useTls: boolean
  group?: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  systemInfo?: SystemInfo
  lastConnected?: number
}

export interface SystemInfo {
  hostname: string
  os: string
  platform: string
  platformVersion: string
  kernelVersion: string
  arch: string
  uptime: number
  cpu: {
    model: string
    cores: number
    threads: number
    usage: number
  }
  memory: {
    total: number
    used: number
    usedPercent: number
  }
  disks: Array<{
    device: string
    mountpoint: string
    total: number
    used: number
    usedPercent: number
  }>
}

export const useServerStore = defineStore('server', () => {
  const servers = ref<Server[]>([])
  const currentServerId = ref<string | null>(null)
  const groups = ref<string[]>(['默认', '生产环境', '测试环境', '开发环境'])

  const currentServer = computed(() =>
    servers.value.find(s => s.id === currentServerId.value)
  )

  const connectedServers = computed(() =>
    servers.value.filter(s => s.status === 'connected')
  )

  const serversByGroup = computed(() => {
    const grouped: Record<string, Server[]> = {}
    for (const group of groups.value) {
      grouped[group] = servers.value.filter(s => (s.group || '默认') === group)
    }
    return grouped
  })

  function addServer(server: Omit<Server, 'id' | 'status'>) {
    const id = `server_${Date.now()}`
    servers.value.push({
      ...server,
      id,
      status: 'disconnected'
    })
    saveToStorage()
    return id
  }

  function updateServer(id: string, updates: Partial<Server>) {
    const index = servers.value.findIndex(s => s.id === id)
    if (index !== -1) {
      servers.value[index] = { ...servers.value[index], ...updates }
      saveToStorage()
    }
  }

  function removeServer(id: string) {
    const index = servers.value.findIndex(s => s.id === id)
    if (index !== -1) {
      servers.value.splice(index, 1)
      if (currentServerId.value === id) {
        currentServerId.value = null
      }
      saveToStorage()
    }
  }

  function setCurrentServer(id: string | null) {
    currentServerId.value = id
  }

  async function connectServer(id: string) {
    const server = servers.value.find(s => s.id === id)
    if (!server) return

    updateServer(id, { status: 'connecting' })

    try {
      const result = await window.electronAPI.server.connect({
        id: server.id,
        name: server.name,
        host: server.host,
        port: server.port,
        token: server.token,
        useTls: server.useTls
      })

      if (result.success) {
        const systemInfo = await window.electronAPI.server.getSystemInfo(id)
        updateServer(id, {
          status: 'connected',
          systemInfo,
          lastConnected: Date.now()
        })
      } else {
        updateServer(id, { status: 'error' })
        throw new Error(result.error)
      }
    } catch (error) {
      updateServer(id, { status: 'error' })
      throw error
    }
  }

  async function disconnectServer(id: string) {
    await window.electronAPI.server.disconnect(id)
    updateServer(id, { status: 'disconnected', systemInfo: undefined })
  }

  function addGroup(name: string) {
    if (!groups.value.includes(name)) {
      groups.value.push(name)
      saveToStorage()
    }
  }

  function removeGroup(name: string) {
    if (name !== '默认') {
      const index = groups.value.indexOf(name)
      if (index !== -1) {
        groups.value.splice(index, 1)
        // 将该组的服务器移到默认组
        servers.value.forEach(s => {
          if (s.group === name) {
            s.group = '默认'
          }
        })
        saveToStorage()
      }
    }
  }

  function saveToStorage() {
    localStorage.setItem('serverhub_servers', JSON.stringify(servers.value))
    localStorage.setItem('serverhub_groups', JSON.stringify(groups.value))
  }

  function loadFromStorage() {
    const savedServers = localStorage.getItem('serverhub_servers')
    const savedGroups = localStorage.getItem('serverhub_groups')

    if (savedServers) {
      servers.value = JSON.parse(savedServers).map((s: Server) => ({
        ...s,
        status: 'disconnected',
        systemInfo: undefined
      }))
    }

    if (savedGroups) {
      groups.value = JSON.parse(savedGroups)
    }
  }

  // 自动连接所有服务器
  async function autoConnectAll() {
    for (const server of servers.value) {
      if (server.status === 'disconnected') {
        try {
          await connectServer(server.id)
        } catch (e) {
          console.error(`Auto connect failed for ${server.name}:`, e)
        }
      }
    }
  }

  // 初始化时加载
  loadFromStorage()

  return {
    servers,
    currentServerId,
    currentServer,
    connectedServers,
    serversByGroup,
    groups,
    addServer,
    updateServer,
    removeServer,
    setCurrentServer,
    connectServer,
    disconnectServer,
    addGroup,
    removeGroup,
    loadFromStorage,
    autoConnectAll
  }
})
