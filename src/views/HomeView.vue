<template>
  <div class="app-container">
    <!-- 左侧面板 - 角色和主题菜单 -->
    <div class="left-panel">
      <nav class="menu">
        <!-- 角色列表 -->
        <div class="roles">
          <div v-for="role in roles" :key="role.id" class="role-item">
            <div class="role-title" @click="role.expanded = !role.expanded">
              {{ role.name }}
            </div>
            <!-- 主题列表 -->
            <div v-if="role.expanded" class="themes">
              <div 
                v-for="theme in role.themes" 
                :key="theme.id" 
                class="theme-item"
                :class="{ 'theme-active': currentTheme && theme.id === currentTheme.id }"
                @click="handleThemeClick(theme)"
              >
                <span class="theme-name">{{ theme.name }}</span>
                <span 
                  class="theme-status" 
                  :class="{
                    'status-pending': theme.status === 'pending',
                    'status-loading': theme.status === 'loading',
                    'status-completed': theme.status === 'completed',
                    'status-running': theme.status === 'running'
                  }"
                >
                  <i v-if="theme.status === 'loading' || theme.status === 'running'" class="i-mdi-loading animate-spin"></i>
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </div>

    <!-- 中间面板 - 内容区域 -->
    <div class="content-panel">
      <!-- 标签页 -->
      <div class="tabs">
        <div 
          v-for="tab in tabs" 
          :key="tab.id" 
          class="tab" 
          :class="{ active: tab.active }"
          @click="switchTab(tab.id)"
        >
          {{ tab.title }}
          <span 
            class="tab-status" 
            :class="{
              'status-pending': tab.status === 'pending',
              'status-loading': tab.status === 'loading',
              'status-completed': tab.status === 'completed',
              'status-running': tab.status === 'running'
            }"
          >
            <i v-if="tab.status === 'loading' || tab.status === 'running'" class="i-mdi-loading animate-spin"></i>
          </span>
        </div>
        <div class="tab add-tab">
          <i class="i-mdi-plus"></i>
        </div>
      </div>
      <!-- 内容区域 -->
      <div class="content">
        <div v-if="isLoading" class="loading-container">
          <div class="loading-spinner"></div>
          <p class="loading-text">正在生成内容...</p>
        </div>
        <template v-else>
          <div v-if="currentDimension" class="dimension-info">
            当前维度：{{ currentDimension }}
          </div>
          <div 
            v-for="tab in tabs" 
            :key="tab.id" 
            v-show="tab.active" 
            class="markdown-content"
          >
            <div v-if="tab.status === 'running' || tab.status === 'loading'" class="loading-container">
              <div class="loading-spinner"></div>
              <p class="loading-text">正在生成内容...</p>
            </div>
            <div v-else v-html="renderMarkdown(tab.content)"></div>
          </div>
        </template>
      </div>
    </div>

    <!-- 右侧面板 - 功能卡片 -->
    <div class="right-panel">
      <!-- 搜索框 -->
      <div class="search-container">
        <input 
          v-model="searchKeyword"
          type="text"
          placeholder="搜索主题..."
          class="search-input"
          @keyup.enter="searchTopics"
        />
        <button 
          class="search-btn"
          @click="searchTopics"
          :disabled="isSearching"
        >
          <span class="search-btn-text">搜索</span>
        </button>
      </div>

      <div class="cards">
        <!-- 搜索结果卡片 -->
        <div v-if="searchResult" class="card search-result-card">
          <h3>探索发现</h3>
          <div class="search-result-content">
            <p class="role-label">推荐角色：{{ searchResult.role }}</p>
            <p class="themes-label">相关主题：</p>
            <ul class="themes-list">
              <li v-for="theme in searchResult.themes" :key="theme">{{ theme }}</li>
            </ul>
          </div>
        </div>

        <div class="card">
          <h3>更细颗粒度</h3>
          <button class="btn" @click="handleFinerGranularity" :disabled="!currentTheme">
            <i class="i-mdi-clock-time-four-outline mr-1"></i>
            使用更细致的时间维度
          </button>
        </div>

        <div class="card">
          <h3>深入理解</h3>
          <button class="btn">探索更深层次内容</button>
        </div>
        <div class="card">
          <h3>简化理解</h3>
          <button class="btn">获取更易懂的解释</button>
        </div>
        <div class="card">
          <h3>探索节点</h3>
          <button class="btn">生成相关探索节点</button>
        </div>
      </div>
    </div>

    <!-- 错误提示组件 -->
    <div 
      v-if="errorState.visible" 
      class="error-message"
      :class="{
        'error-api': errorState.info?.type === 'API_ERROR',
        'error-network': errorState.info?.type === 'NETWORK_ERROR',
        'error-validation': errorState.info?.type === 'VALIDATION_ERROR'
      }"
    >
      <i class="i-mdi-alert-circle mr-2"></i>
      {{ errorState.info?.message }}
      <button 
        v-if="errorState.info?.retryable" 
        class="retry-button"
        @click="retryLastOperation"
      >
        重试
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AIService } from '@/services/ai'
import { marked } from 'marked'
import { errorService, ErrorType, type ErrorInfo } from '@/services/error'

// 配置 marked
marked.setOptions({
  gfm: true, // 启用 GitHub 风格的 markdown
  breaks: true, // 启用换行符转换为 <br>
  headerIds: true, // 为标题添加 id
  mangle: false, // 不转义标题中的字符
})

interface Theme {
  id: number
  name: string
  status: 'pending' | 'loading' | 'running' | 'completed'
}

interface Role {
  id: number
  name: string
  themes: Theme[]
  expanded: boolean
}

interface Tab {
  id: number
  title: string
  content: string
  active: boolean
  status: 'pending' | 'loading' | 'running' | 'completed'
}

interface SearchResult {
  role: string
  themes: string[]
}

interface CachedContent {
  dimension: string
  tabs: Tab[]
  isFinerGranularity: boolean
}

interface ErrorState {
  visible: boolean
  info: ErrorInfo | null
}

const roles = ref<Role[]>([
  {
    id: 1,
    name: '开发者',
    expanded: true,
    themes: [
      { id: 1, name: 'Vue 基础', status: 'pending' },
      { id: 2, name: 'TypeScript', status: 'pending' },
    ]
  },
  {
    id: 2,
    name: '设计师',
    expanded: false,
    themes: [
      { id: 3, name: 'UI 设计', status: 'pending' },
      { id: 4, name: 'UX 原则', status: 'pending' },
    ]
  }
])

const tabs = ref<Tab[]>([])
const isLoading = ref(false)
const currentDimension = ref('')

const searchKeyword = ref('')
const isSearching = ref(false)
const searchResult = ref<SearchResult | null>(null)

const aiService = AIService.getInstance()

const currentTheme = ref<Theme | null>(null)

// 缓存对象，key 是主题ID
const contentCache = ref<Record<string, CachedContent>>({})

const errorState = ref<ErrorState>({
  visible: false,
  info: null
})

const showError = (error: ErrorInfo) => {
  errorState.value = {
    visible: true,
    info: error
  }
  setTimeout(() => {
    errorState.value.visible = false
  }, 5000)
}

const handleThemeClick = async (theme: Theme) => {
  // 如果点击的是当前主题，不做任何操作
  if (currentTheme.value?.id === theme.id) return
  
  // 如果已经在加载中，则不重复加载
  if (theme.status === 'loading' || theme.status === 'running') return
  
  currentTheme.value = theme  // 保存当前主题
  
  // 使用主题ID作为缓存键
  const cacheKey = `theme_${theme.id}`
  const cachedContent = contentCache.value[cacheKey]
  if (cachedContent) {
    console.log('使用缓存内容:', cacheKey)
    currentDimension.value = cachedContent.dimension
    tabs.value = [...cachedContent.tabs]
    return
  }

  // 更新主题状态为运行中
  const roleIndex = roles.value.findIndex(role => 
    role.themes.some(t => t.id === theme.id)
  )
  if (roleIndex !== -1) {
    const themeIndex = roles.value[roleIndex].themes.findIndex(t => t.id === theme.id)
    if (themeIndex !== -1) {
      roles.value[roleIndex].themes[themeIndex].status = 'running'
    }
  }

  isLoading.value = true
  try {
    // 获取主题结构（维度和标签页标题）
    console.log('正在生成主题内容:', theme.name)
    const result = await aiService.generateThemeContent(theme.name)
    console.log('生成主题内容结果:', result)
    
    if (!result || !result.dimension || !Array.isArray(result.tabs) || result.tabs.length === 0) {
      throw errorService.createError(
        ErrorType.API,
        '生成的主题内容格式不正确'
      )
    }
    
    currentDimension.value = result.dimension
    
    // 创建所有标签页，初始状态为 pending
    const newTabs = result.tabs.map((tab, index) => ({
      id: index + 1,
      title: tab.title || `标签页 ${index + 1}`,
      content: '',
      active: index === 0,
      status: 'pending'
    }))
    
    // 设置标签页
    tabs.value = newTabs

    // 立即加载第一个标签页的内容
    if (newTabs.length > 0) {
      const firstTab = tabs.value[0]
      if (firstTab) {
        firstTab.status = 'running'
        console.log('正在生成第一个标签页内容:', firstTab.title)
        const firstTabContent = await aiService.chat(
          `为主题"${theme.name}"生成"${firstTab.title}"阶段的内容指南。

背景信息：
- 维度：${result.dimension}
- 当前阶段：${firstTab.title}

请针对${firstTab.title}阶段，生成以下内容：
1. 这个阶段的特点和目标
2. 核心内容要点
3. 学习或实践建议
4. 常见问题和解决方案

注意：请只关注${firstTab.title}这个阶段的特定内容，不要涉及其他阶段。`
        )
        
        if (!firstTabContent) {
          throw errorService.createError(
            ErrorType.API,
            '生成的内容为空'
          )
        }
        
        firstTab.content = firstTabContent
        firstTab.status = 'completed'
        console.log('第一个标签页内容生成完成')

        // 保存到缓存
        contentCache.value[cacheKey] = {
          dimension: result.dimension,
          tabs: [...tabs.value],
          isFinerGranularity: false
        }
      }
    }

    // 更新主题状态为已完成
    if (roleIndex !== -1) {
      const themeIndex = roles.value[roleIndex].themes.findIndex(t => t.id === theme.id)
      if (themeIndex !== -1) {
        roles.value[roleIndex].themes[themeIndex].status = 'completed'
      }
    }

    // 异步加载其他标签页
    if (result.tabs.length > 1) {
      console.log('开始加载剩余标签页')
      loadRemainingTabs(theme.name, result.dimension, result.tabs.slice(1), cacheKey)
    }
  } catch (error) {
    console.error('生成主题内容时出错:', error)
    const errorInfo = error instanceof Error ? errorService.handleError(error) : errorService.createError(
      ErrorType.UNKNOWN,
      '生成主题内容时发生未知错误'
    )
    showError(errorInfo)
    
    // 重置状态
    tabs.value = [{
      id: 1,
      title: '错误信息',
      content: errorInfo.message,
      active: true,
      status: 'error'
    }]
    currentDimension.value = '发生错误'
    
    if (roleIndex !== -1) {
      const themeIndex = roles.value[roleIndex].themes.findIndex(t => t.id === theme.id)
      if (themeIndex !== -1) {
        roles.value[roleIndex].themes[themeIndex].status = 'error'
      }
    }
  } finally {
    isLoading.value = false
  }
}

// 修改加载剩余标签页的函数，添加错误处理
const loadRemainingTabs = async (theme: string, dimension: string, remainingTabs: Array<{title: string}>, cacheKey: string) => {
  for (const tab of remainingTabs) {
    const tabIndex = tabs.value.findIndex(t => t.title === tab.title)
    if (tabIndex === -1) {
      console.error(`标签页 ${tab.title} 不存在，跳过加载`)
      continue
    }
    
    const currentTab = tabs.value[tabIndex]
    currentTab.status = 'running'
    
    try {
      console.log(`正在生成标签页 ${currentTab.title} 的内容`)
      const content = await aiService.chat(
        `为主题"${theme}"生成"${currentTab.title}"阶段的内容指南。

背景信息：
- 维度：${dimension}
- 当前阶段：${currentTab.title}

请针对${currentTab.title}阶段，生成以下内容：
1. 这个阶段的特点和目标
2. 核心内容要点
3. 学习或实践建议
4. 常见问题和解决方案

注意：请只关注${currentTab.title}这个阶段的特定内容，不要涉及其他阶段。`
      )
      
      if (!content) {
        throw errorService.createError(
          ErrorType.API,
          '生成的内容为空'
        )
      }
      
      currentTab.content = content
      currentTab.status = 'completed'
      console.log(`标签页 ${currentTab.title} 内容生成完成`)
      
      if (contentCache.value[cacheKey]) {
        contentCache.value[cacheKey] = {
          ...contentCache.value[cacheKey],
          tabs: [...tabs.value]
        }
      }
    } catch (error) {
      console.error(`加载标签页 ${currentTab.title} 内容失败:`, error)
      const errorInfo = error instanceof Error ? errorService.handleError(error) : errorService.createError(
        ErrorType.UNKNOWN,
        '生成标签页内容时发生未知错误'
      )
      showError(errorInfo)
      
      currentTab.content = errorInfo.message
      currentTab.status = 'error'
      
      if (contentCache.value[cacheKey]) {
        contentCache.value[cacheKey] = {
          ...contentCache.value[cacheKey],
          tabs: [...tabs.value]
        }
      }
    }
  }
}

const searchTopics = async () => {
  if (!searchKeyword.value.trim()) {
    showError(errorService.createError(
      ErrorType.VALIDATION,
      '请输入搜索关键词'
    ))
    return
  }
  
  isSearching.value = true
  try {
    const result = await aiService.searchTopics(searchKeyword.value)
    searchResult.value = result
    
    // 添加新的角色和主题到左侧面板
    const maxThemeId = Math.max(...roles.value.flatMap(r => r.themes.map(t => t.id)), 0)
    const newRole: Role = {
      id: roles.value.length + 1,
      name: result.role,
      expanded: true,
      themes: result.themes.map((theme, index) => ({
        id: maxThemeId + index + 1,
        name: theme,
        status: 'pending'
      }))
    }

    // 检查是否已存在相同的角色
    const existingRoleIndex = roles.value.findIndex(r => r.name === result.role)
    if (existingRoleIndex === -1) {
      roles.value.push(newRole)
      // 不再自动运行第一个主题
    } else {
      // 更新现有角色的主题
      roles.value[existingRoleIndex].themes = newRole.themes
      roles.value[existingRoleIndex].expanded = true
      // 不再自动运行第一个主题
    }

  } catch (error) {
    console.error('搜索主题时出错:', error)
    const errorInfo = error as ErrorInfo
    showError(errorInfo)
  } finally {
    isSearching.value = false
  }
}

const renderMarkdown = (content: string): string => {
  try {
    if (!content) return ''
    return marked(content)
  } catch (error) {
    console.error('Markdown 渲染错误:', error)
    return content || ''
  }
}

const switchTab = (tabId: number) => {
  tabs.value = tabs.value.map(tab => ({
    ...tab,
    active: tab.id === tabId
  }))
}

const handleFinerGranularity = async () => {
  if (!currentTheme.value) {
    showError(errorService.createError(
      ErrorType.VALIDATION,
      '请先选择一个主题'
    ))
    return
  }

  const theme = currentTheme.value
  // 检查是否已经有更细颗粒度的缓存
  const cachedContent = contentCache.value[`theme_${theme.id}`]
  if (cachedContent?.isFinerGranularity) {
    currentDimension.value = cachedContent.dimension
    tabs.value = [...cachedContent.tabs]
    return
  }
  
  // 如果已经在加载中，则不重复加载
  if (theme.status === 'loading' || theme.status === 'running') return

  // 更新主题状态为加载中
  const roleIndex = roles.value.findIndex(role => 
    role.themes.some(t => t.id === theme.id)
  )
  if (roleIndex !== -1) {
    const themeIndex = roles.value[roleIndex].themes.findIndex(t => t.id === theme.id)
    if (themeIndex !== -1) {
      roles.value[roleIndex].themes[themeIndex].status = 'loading'
    }
  }

  isLoading.value = true
  try {
    // 传递当前标签页信息
    const currentTabsInfo = tabs.value.map(tab => ({
      title: tab.title
    }))
    const result = await aiService.generateThemeContent(theme.name, true, currentTabsInfo)
    currentDimension.value = result.dimension
    
    // 创建新的标签页，保持加载状态
    tabs.value = result.tabs.map((tab, index) => ({
      id: index + 1,
      title: tab.title,
      content: '',
      active: index === 0,
      status: 'pending'
    }))

    // 立即加载第一个标签页
    if (tabs.value.length > 0) {
      const firstTab = tabs.value[0]
      if (firstTab) {
        firstTab.status = 'running'
        const firstTabContent = await aiService.chat(
          `为主题"${theme.name}"生成"${firstTab.title}"阶段的内容指南。

背景信息：
- 维度：${result.dimension}
- 当前阶段：${firstTab.title}

请针对${firstTab.title}阶段，生成以下内容：
1. 这个阶段的特点和目标
2. 核心内容要点
3. 学习或实践建议
4. 常见问题和解决方案

注意：请只关注${firstTab.title}这个阶段的特定内容，不要涉及其他阶段。`
        )
        
        firstTab.content = firstTabContent || ''
        firstTab.status = 'completed'

        // 保存到缓存，使用主题ID作为键
        contentCache.value[`theme_${theme.id}`] = {
          dimension: result.dimension,
          tabs: [...tabs.value],
          isFinerGranularity: true
        }
      }
    }

    if (roleIndex !== -1) {
      const themeIndex = roles.value[roleIndex].themes.findIndex(t => t.id === theme.id)
      if (themeIndex !== -1) {
        roles.value[roleIndex].themes[themeIndex].status = 'completed'
      }
    }

    // 异步加载其他标签页
    if (result.tabs.length > 1) {
      loadRemainingTabs(theme.name, result.dimension, result.tabs.slice(1), `theme_${theme.id}`)
    }
  } catch (error) {
    console.error('生成更细颗粒度内容时出错:', error)
    const errorInfo = error as ErrorInfo
    showError(errorInfo)
    
    tabs.value = [{
      id: 1,
      title: '错误信息',
      content: errorInfo.message,
      active: true,
      status: 'error'
    }]
    currentDimension.value = '发生错误'
    
    if (roleIndex !== -1) {
      const themeIndex = roles.value[roleIndex].themes.findIndex(t => t.id === theme.id)
      if (themeIndex !== -1) {
        roles.value[roleIndex].themes[themeIndex].status = 'error'
      }
    }
  } finally {
    isLoading.value = false
  }
}

// 添加重试功能
const retryLastOperation = async () => {
  if (!errorState.value.info?.retryable) return
  
  if (currentTheme.value) {
    if (tabs.value[0]?.title === '错误信息') {
      // 重试主题加载
      await handleThemeClick(currentTheme.value)
    } else {
      // 重试更细颗粒度
      await handleFinerGranularity()
    }
  }
}
</script>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.left-panel {
  width: 250px;
  border-right: 1px solid #e5e7eb;
  background-color: #f9fafb;
  padding: 1rem;
}

.content-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.right-panel {
  width: 300px;
  border-left: 1px solid #e5e7eb;
  background-color: #f9fafb;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.role-item {
  margin-bottom: 0.5rem;
}

.role-title {
  font-weight: 600;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  background-color: #e5e7eb;
}

.themes {
  margin-left: 1rem;
  margin-top: 0.5rem;
}

.theme-item {
  padding: 0.375rem 0.5rem;
  cursor: pointer;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s ease-in-out;
  border: 1px solid transparent;
}

.theme-active {
  background-color: #e5e7eb;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
  position: relative;
}

.theme-active::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 70%;
  background-color: #3b82f6;
  border-radius: 0 2px 2px 0;
}

.theme-item:hover {
  background-color: #e5e7eb;
}

.theme-active:hover {
  background-color: #f3f4f6;
}

.theme-name {
  flex: 1;
  min-width: 0;
}

.theme-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 0.5rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-pending {
  background-color: #d1d5db;
}

.status-loading {
  background-color: #3b82f6;
}

.status-completed {
  background-color: #34d399;
}

.status-running {
  background-color: #fbbf24;
}

.theme-status i {
  width: 16px;
  height: 16px;
  color: currentColor;
}

.tabs {
  display: flex;
  padding: 0.5rem;
  gap: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.tab {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  background-color: #f3f4f6;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tab.active {
  background-color: #e5e7eb;
  font-weight: 500;
}

.tab-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tab .status-pending {
  background-color: #d1d5db;
}

.tab .status-loading {
  width: 16px;
  height: 16px;
  color: #3b82f6;
}

.tab .status-completed {
  width: 16px;
  height: 16px;
  color: #34d399;
}

.tab .status-running {
  width: 16px;
  height: 16px;
  color: #fbbf24;
}

.add-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  padding: 0.5rem;
}

.content {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}

.markdown-content {
  padding: 1.5rem;
  line-height: 1.6;
  max-width: 800px;
  margin: 0 auto;
  font-size: 16px;
}

.markdown-content :deep(h1) {
  font-size: 2.25rem;
  font-weight: 700;
  margin: 2rem 0 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
  color: #111827;
}

.markdown-content :deep(h2) {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 2rem 0 1rem;
  color: #1f2937;
}

.markdown-content :deep(h3) {
  font-size: 1.375rem;
  font-weight: 600;
  margin: 1.5rem 0 0.75rem;
  color: #374151;
}

.markdown-content :deep(p) {
  margin: 1rem 0;
  color: #4b5563;
  line-height: 1.75;
}

.markdown-content :deep(ul), .markdown-content :deep(ol) {
  margin: 1rem 0;
  padding-left: 1.5rem;
  color: #4b5563;
}

.markdown-content :deep(li) {
  margin: 0.5rem 0;
  line-height: 1.6;
  position: relative;
}

.markdown-content :deep(ul > li) {
  list-style-type: none;
  padding-left: 1.5rem;
}

.markdown-content :deep(ul > li::before) {
  content: "•";
  position: absolute;
  left: 0;
  color: #3b82f6;
  font-weight: bold;
}

.markdown-content :deep(ol > li) {
  list-style-type: decimal;
  padding-left: 0.5rem;
}

.markdown-content :deep(code) {
  background-color: #f3f4f6;
  padding: 0.2rem 0.4rem;
  border-radius: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875em;
  color: #dc2626;
}

.markdown-content :deep(pre) {
  background-color: #f3f4f6;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 1rem 0;
}

.markdown-content :deep(pre code) {
  color: #374151;
  padding: 0;
  background: none;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid #3b82f6;
  padding: 0.5rem 0 0.5rem 1rem;
  margin: 1rem 0;
  color: #4b5563;
  background-color: #f3f4f6;
  border-radius: 0 0.25rem 0.25rem 0;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 2px solid #e5e7eb;
  margin: 2rem 0;
}

.markdown-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.markdown-content :deep(th), .markdown-content :deep(td) {
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  text-align: left;
}

.markdown-content :deep(th) {
  background-color: #f3f4f6;
  font-weight: 600;
  color: #374151;
}

.markdown-content :deep(td) {
  color: #4b5563;
}

.markdown-content :deep(tr:nth-child(even)) {
  background-color: #f9fafb;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.card {
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  margin-bottom: 0.5rem;
}

.card h3 {
  margin-bottom: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.btn {
  width: 100%;
  padding: 0.5rem;
  background-color: #e5e7eb;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn:hover {
  background-color: #d1d5db;
}

.search-container {
  margin-bottom: 1rem;
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  min-width: 0;
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  outline: none;
}

.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.search-btn {
  flex-shrink: 0;
  min-width: 60px;
  height: 40px;
  padding: 0.5rem 1rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
}

.search-btn-text {
  white-space: nowrap;
}

.search-btn:hover {
  background-color: #2563eb;
}

.search-btn:disabled {
  background-color: #93c5fd;
  cursor: not-allowed;
}

.search-result-card {
  background-color: #f0f9ff;
  border: 1px solid #bae6fd;
}

.search-result-content {
  margin-top: 0.5rem;
}

.role-label {
  font-weight: 500;
  color: #0369a1;
  margin-bottom: 0.5rem;
}

.themes-label {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.themes-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.themes-list li {
  padding: 0.25rem 0;
  color: #0c4a6e;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f4f6;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  color: #6b7280;
  font-size: 0.875rem;
}

.dimension-info {
  padding: 0.5rem 1rem;
  background-color: #f3f4f6;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  color: #4b5563;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  position: fixed;
  top: 1rem;
  right: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background-color: #fee2e2;
  color: #991b1b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 1000;
  animation: slideIn 0.3s ease-out;
  max-width: 400px;
}

.error-api {
  background-color: #fee2e2;
  color: #991b1b;
}

.error-network {
  background-color: #fef3c7;
  color: #92400e;
}

.error-validation {
  background-color: #e0e7ff;
  color: #3730a3;
}

.retry-button {
  margin-left: auto;
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  background-color: rgba(0, 0, 0, 0.1);
  color: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background-color: rgba(0, 0, 0, 0.2);
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style> 