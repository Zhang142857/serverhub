<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <div class="logo-icon">
          <svg viewBox="0 0 512 512" width="28" height="28">
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#6366f1" />
                <stop offset="100%" style="stop-color:#8b5cf6" />
              </linearGradient>
            </defs>
            <circle cx="256" cy="256" r="240" fill="url(#logoGrad)"/>
            <g fill="#ffffff">
              <rect x="120" y="120" width="272" height="60" rx="6"/>
              <rect x="120" y="200" width="272" height="60" rx="6"/>
              <rect x="120" y="280" width="272" height="60" rx="6"/>
              <circle cx="160" cy="150" r="10" fill="#f87171"/>
              <circle cx="190" cy="150" r="10" fill="#10b981"/>
              <circle cx="160" cy="230" r="10" fill="#f87171"/>
              <circle cx="190" cy="230" r="10" fill="#10b981"/>
              <circle cx="160" cy="310" r="10" fill="#f87171"/>
              <circle cx="190" cy="310" r="10" fill="#10b981"/>
            </g>
          </svg>
        </div>
        <span class="logo-text">ServerHub</span>
      </div>
    </div>

    <div class="sidebar-content">
      <el-menu :default-active="currentRoute" router>
        <!-- 概览 -->
        <el-menu-item index="/">
          <el-icon><Odometer /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>

        <el-divider />
        <div class="menu-group-title">应用服务</div>

        <!-- 应用服务 -->
        <el-menu-item index="/websites">
          <el-icon><Link /></el-icon>
          <span>网站管理</span>
        </el-menu-item>
        <el-menu-item index="/ssl">
          <el-icon><Lock /></el-icon>
          <span>SSL 证书</span>
        </el-menu-item>
        <el-menu-item index="/database">
          <el-icon><Coin /></el-icon>
          <span>数据库</span>
        </el-menu-item>
        <el-menu-item index="/docker">
          <el-icon><Box /></el-icon>
          <span>Docker</span>
        </el-menu-item>

        <el-divider />
        <div class="menu-group-title">系统工具</div>

        <!-- 系统工具 -->
        <el-menu-item index="/files">
          <el-icon><Folder /></el-icon>
          <span>文件管理</span>
        </el-menu-item>
        <el-menu-item index="/terminal">
          <el-icon><Monitor /></el-icon>
          <span>终端</span>
        </el-menu-item>
        <el-menu-item index="/services">
          <el-icon><Setting /></el-icon>
          <span>服务管理</span>
        </el-menu-item>
        <el-menu-item index="/processes">
          <el-icon><Cpu /></el-icon>
          <span>进程管理</span>
        </el-menu-item>
        <el-menu-item index="/environment">
          <el-icon><Tools /></el-icon>
          <span>环境管理</span>
        </el-menu-item>

        <el-divider />
        <div class="menu-group-title">监控运维</div>

        <!-- 监控运维 -->
        <el-menu-item index="/monitor">
          <el-icon><DataLine /></el-icon>
          <span>监控中心</span>
        </el-menu-item>
        <el-menu-item index="/logs">
          <el-icon><Document /></el-icon>
          <span>日志分析</span>
        </el-menu-item>
        <el-menu-item index="/alerts">
          <el-icon><Bell /></el-icon>
          <span>告警系统</span>
        </el-menu-item>
        <el-menu-item index="/network">
          <el-icon><Connection /></el-icon>
          <span>网络工具</span>
        </el-menu-item>

        <!-- 多服务器模式才显示 -->
        <template v-if="hasMultipleServers">
          <el-divider />
          <el-menu-item index="/servers">
            <el-icon><DataBoard /></el-icon>
            <span>服务器管理</span>
          </el-menu-item>
        </template>

        <el-divider />
        <div class="menu-group-title">数据管理</div>

        <!-- 数据管理 -->
        <el-menu-item index="/backup">
          <el-icon><FolderOpened /></el-icon>
          <span>备份管理</span>
        </el-menu-item>
        <el-menu-item index="/cron-jobs">
          <el-icon><Clock /></el-icon>
          <span>计划任务</span>
        </el-menu-item>

        <el-divider />
        <div class="menu-group-title">扩展</div>

        <!-- 扩展功能 -->
        <el-menu-item index="/ai">
          <el-icon><ChatDotRound /></el-icon>
          <span>AI 助手</span>
        </el-menu-item>
        <el-menu-item index="/cloud">
          <el-icon><Cloudy /></el-icon>
          <span>云服务</span>
        </el-menu-item>
        <el-menu-item index="/app-store">
          <el-icon><Shop /></el-icon>
          <span>应用商店</span>
        </el-menu-item>
        <el-menu-item index="/plugins">
          <el-icon><Grid /></el-icon>
          <span>插件市场</span>
        </el-menu-item>

        <!-- 插件动态菜单 -->
        <template v-if="pluginMenus.length > 0">
          <el-divider />
          <el-menu-item
            v-for="menu in pluginMenus"
            :key="menu.id"
            :index="menu.route || `/plugin/${menu.pluginId}`"
          >
            <el-icon>
              <component :is="getMenuIcon(menu.icon)" />
            </el-icon>
            <span>{{ menu.label }}</span>
            <el-tag v-if="menu.pluginId" size="small" type="info" class="plugin-tag">插件</el-tag>
          </el-menu-item>
        </template>
      </el-menu>

      <!-- 已连接服务器列表 - 多服务器模式才显示 -->
      <div class="connected-servers" v-if="hasMultipleServers && connectedServers.length > 0">
        <div class="section-title">已连接服务器</div>
        <div
          v-for="server in connectedServers"
          :key="server.id"
          class="server-item"
          :class="{ active: currentServerId === server.id }"
          @click="selectServer(server.id)"
        >
          <div class="server-status connected"></div>
          <span class="server-name">{{ server.name }}</span>
        </div>
      </div>
    </div>

    <div class="sidebar-footer">
      <el-menu router>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
      </el-menu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServerStore } from '@/stores/server'
import { usePluginStore } from '@/stores/plugin'
import {
  Monitor,
  Odometer,
  Box,
  Folder,
  Setting,
  Cloudy,
  Grid,
  Cpu,
  ChatDotRound,
  Link,
  Coin,
  DataBoard,
  DataLine,
  Lock,
  Connection,
  Document,
  Files,
  Key,
  Picture,
  VideoCamera,
  Promotion,
  TrendCharts,
  Warning,
  Bell,
  Calendar,
  Clock,
  Collection,
  FolderOpened,
  Shop,
  Tools,
  Compass,
  CreditCard,
  Delete,
  Download,
  Edit,
  ElementPlus,
  Expand,
  Film,
  Filter,
  Flag,
  FolderOpened,
  FullScreen,
  Goods,
  Help,
  House,
  InfoFilled,
  List,
  Location,
  MagicStick,
  Management,
  Menu,
  Message,
  Microphone,
  Moon,
  More,
  Notification,
  Operation,
  Opportunity,
  Orange,
  Paperclip,
  Phone,
  Platform,
  Plus,
  Pointer,
  Position,
  Present,
  Printer,
  QuestionFilled,
  Rank,
  Reading,
  Refresh,
  RefreshLeft,
  RefreshRight,
  Remove,
  Right,
  ScaleToOriginal,
  School,
  Search,
  Select,
  Sell,
  Service,
  Share,
  Ship,
  Shop,
  ShoppingBag,
  ShoppingCart,
  Smoking,
  Soccer,
  SoldOut,
  Sort,
  Stamp,
  Star,
  Stopwatch,
  SuccessFilled,
  Sugar,
  Sunny,
  Switch,
  SwitchButton,
  TakeawayBox,
  Ticket,
  Timer,
  Tools,
  TopLeft,
  TopRight,
  Trophy,
  TurnOff,
  Umbrella,
  Unlock,
  Upload,
  User,
  UserFilled,
  Van,
  VideoPlay,
  VideoPause,
  View,
  Wallet,
  WarningFilled,
  Watch,
  Watermelon,
  WindPower,
  ZoomIn,
  ZoomOut
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const serverStore = useServerStore()
const pluginStore = usePluginStore()

const currentRoute = computed(() => route.path)
const connectedServers = computed(() => serverStore.connectedServers)
const currentServerId = computed(() => serverStore.currentServerId)
const hasMultipleServers = computed(() => serverStore.hasMultipleServers)
const pluginMenus = computed(() => pluginStore.sidebarMenus)

// 图标映射
const iconMap: Record<string, unknown> = {
  Monitor, Odometer, Box, Folder, Setting, Cloudy, Grid, Cpu, ChatDotRound, Link, Coin,
  DataBoard, DataLine, Lock, Connection, Document, Files, Key, Picture, VideoCamera,
  Promotion, TrendCharts, Warning, Bell, Calendar, Clock, Collection, Compass, CreditCard,
  Delete, Download, Edit, ElementPlus, Expand, Film, Filter, Flag, FolderOpened, FullScreen,
  Goods, Help, House, InfoFilled, List, Location, MagicStick, Management, Menu, Message,
  Microphone, Moon, More, Notification, Operation, Opportunity, Orange, Paperclip, Phone,
  Platform, Plus, Pointer, Position, Present, Printer, QuestionFilled, Rank, Reading,
  Refresh, RefreshLeft, RefreshRight, Remove, Right, ScaleToOriginal, School, Search,
  Select, Sell, Service, Share, Ship, Shop, ShoppingBag, ShoppingCart, Smoking, Soccer,
  SoldOut, Sort, Stamp, Star, Stopwatch, SuccessFilled, Sugar, Sunny, Switch, SwitchButton,
  TakeawayBox, Ticket, Timer, Tools, TopLeft, TopRight, Trophy, TurnOff, Umbrella, Unlock,
  Upload, User, UserFilled, Van, VideoPlay, VideoPause, View, Wallet, WarningFilled, Watch,
  Watermelon, WindPower, ZoomIn, ZoomOut
}

function getMenuIcon(iconName?: string) {
  if (!iconName) return Grid
  return iconMap[iconName] || Grid
}

function selectServer(id: string) {
  serverStore.setCurrentServer(id)
  router.push(`/server/${id}`)
}

onMounted(() => {
  // 初始化插件系统
  pluginStore.initialize()
})
</script>

<style lang="scss" scoped>
.sidebar {
  width: var(--sidebar-width);
  height: 100vh;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  height: var(--header-height);
  padding: 0 var(--space-4);
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);

  .logo-icon {
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      filter: drop-shadow(0 2px 4px rgba(99, 102, 241, 0.3));
    }
  }

  .logo-text {
    font-size: var(--text-lg);
    font-weight: 700;
    background: var(--primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.5px;
  }
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2) 0;
}

.el-divider {
  margin: var(--space-2) var(--space-4);
  border-color: var(--border-color);
}

.menu-group-title {
  font-size: var(--text-xs);
  color: var(--text-muted);
  padding: var(--space-1) var(--space-5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.connected-servers {
  padding: var(--space-3) var(--space-4);

  .section-title {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-bottom: var(--space-2);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  .server-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);

    &:hover {
      background-color: var(--bg-tertiary);
    }

    &.active {
      background-color: var(--primary-light);
      color: var(--primary-color);
    }

    .server-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;

      &.connected {
        background-color: var(--success-color);
        box-shadow: 0 0 6px var(--success-color);
      }
    }

    .server-name {
      font-size: var(--text-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.sidebar-footer {
  border-top: 1px solid var(--border-color);
  padding: var(--space-2) 0;
}

.plugin-tag {
  margin-left: auto;
  font-size: 10px;
  padding: 0 var(--space-1);
  height: 16px;
  line-height: 16px;
}
</style>
