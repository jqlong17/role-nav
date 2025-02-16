<script setup lang="ts">
import { PropType, ref } from 'vue'

interface NavItem {
  id: string
  name: string
  children?: NavItem[]
}

const selectedNodeId = ref<string | null>(null)

const props = defineProps({
  item: {
    type: Object as PropType<NavItem>,
    required: true
  },
  isActive: {
    type: Function as PropType<(item: NavItem) => boolean>,
    required: true
  },
  handleClick: {
    type: Function as PropType<(item: NavItem) => void>,
    required: true
  },
  globalExpandedItems: {
    type: Object as PropType<Set<string>>,
    required: true
  }
})

const toggleNodeActions = (nodeId: string, event: Event) => {
  event.stopPropagation()
  selectedNodeId.value = selectedNodeId.value === nodeId ? null : nodeId
}

const handleNodeAction = (action: string, nodeId: string, event: Event) => {
  event.stopPropagation()
  console.log(`执行${action}操作，节点ID：${nodeId}`)
  // 这里可以添加实际的操作逻辑
  selectedNodeId.value = null
}
</script>

<template>
  <div class="nav-item">
    <div 
      class="nav-item-header"
      :class="{ 
        'has-children': item.children?.length, 
        'active': isActive(item),
        'selected': selectedNodeId === item.id
      }"
      @click="handleClick(item)"
    >
      <div class="nav-item-content">
        <span v-if="item.children?.length" class="expand-icon">
          {{ globalExpandedItems.has(item.id) ? '▼' : '▶' }}
        </span>
        {{ item.name }}
      </div>
      <div class="nav-item-controls">
        <slot name="extra" :item="item"></slot>
        <button 
          class="action-toggle"
          @click="toggleNodeActions(item.id, $event)"
          :title="selectedNodeId === item.id ? '收起操作' : '展开操作'"
        >
          {{ selectedNodeId === item.id ? '▲' : '▼' }}
        </button>
      </div>
    </div>

    <!-- 节点操作行 -->
    <div 
      v-if="selectedNodeId === item.id"
      class="node-actions"
      @click.stop
    >
      <button 
        class="action-btn delete"
        @click="handleNodeAction('删除', item.id, $event)"
        title="删除此节点"
      >
        删除
      </button>
      <button 
        class="action-btn regenerate"
        @click="handleNodeAction('重试', item.id, $event)"
        title="重新生成此节点"
      >
        重试
      </button>
      <button 
        class="action-btn expand"
        @click="handleNodeAction('扩展', item.id, $event)"
        title="扩展此节点"
      >
        扩展
      </button>
      <button 
        class="action-btn explore"
        @click="handleNodeAction('深挖', item.id, $event)"
        title="继续创建子节点"
      >
        深挖
      </button>
    </div>

    <div 
      v-if="item.children"
      class="nav-item-children"
      :class="{ expanded: globalExpandedItems.has(item.id) }"
    >
      <nav-item-component
        v-for="child in item.children" 
        :key="child.id" 
        :item="child"
        :is-active="isActive"
        :handle-click="handleClick"
        :global-expanded-items="globalExpandedItems"
      >
        <template #extra="slotProps">
          <slot name="extra" :item="slotProps.item"></slot>
        </template>
      </nav-item-component>
    </div>
  </div>
</template>

<style scoped>
.nav-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 2px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.nav-item-content {
  display: flex;
  align-items: center;
  flex: 1;
}

.nav-item-header:hover {
  background: #f5f5f5;
}

.nav-item-header.has-children {
  font-weight: 500;
}

.nav-item-header.active {
  background: #e0f2fe;
  color: #0284c7;
}

.expand-icon {
  font-size: 10px;
  margin-right: 8px;
  color: #666;
}

.nav-item-children {
  margin-left: 16px;
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.3s ease-out;
}

.nav-item-children.expanded {
  max-height: 1000px;
}

/* 状态指示器和操作按钮样式 */
.nav-item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
  flex-shrink: 0;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transition: all 0.3s ease;
  flex-shrink: 0;
  position: relative;
  border: 2px solid transparent;
}

.status-indicator.failed {
  background-color: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
  border-color: rgba(239, 68, 68, 0.3);
}

.status-indicator.running {
  background-color: #fbbf24;
  animation: pulse 1.5s infinite;
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.6);
  border-color: rgba(251, 191, 36, 0.3);
}

.status-indicator.success {
  background-color: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
  border-color: rgba(34, 197, 94, 0.3);
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; box-shadow: 0 0 8px rgba(251, 191, 36, 0.6); }
  50% { transform: scale(1.3); opacity: 0.8; box-shadow: 0 0 12px rgba(251, 191, 36, 0.8); }
  100% { transform: scale(1); opacity: 1; box-shadow: 0 0 8px rgba(251, 191, 36, 0.6); }
}

/* 添加状态指示器的悬停效果 */
.status-indicator::after {
  content: '';
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border-radius: 50%;
  background: inherit;
  opacity: 0.2;
  z-index: -1;
  transform: scale(0);
  transition: transform 0.2s ease;
}

.status-indicator:hover::after {
  transform: scale(1);
}

.lock-button {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  font-size: 16px;
  transition: all 0.2s ease;
  border-radius: 4px;
  flex-shrink: 0;
}

.lock-button.locked {
  color: #0284c7;
}

.lock-button.unlocked {
  color: white;
  background-color: #0284c7;
}

.lock-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.lock-button.unlocked:hover {
  background-color: #0369a1;
}

/* 节点操作行样式 */
.nav-item-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-toggle {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  color: #666;
  font-size: 12px;
  opacity: 0;
  transition: all 0.2s;
}

.nav-item-header:hover .action-toggle,
.nav-item-header.selected .action-toggle {
  opacity: 1;
}

.node-actions {
  display: flex;
  gap: 4px;
  padding: 6px 12px 6px 32px;
  background: #f8fafc;
  border-radius: 0 0 4px 4px;
  animation: slideDown 0.2s ease-out;
  border-top: 1px solid #e5e7eb;
}

.action-btn {
  padding: 2px 6px;
  border: none;
  border-radius: 3px;
  background: white;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e5e7eb;
  white-space: nowrap;
  min-width: 36px;
  text-align: center;
}

.action-btn:hover {
  background: #f1f5f9;
  transform: translateY(-1px);
}

.action-btn.delete:hover {
  background: #fee2e2;
  color: #dc2626;
  border-color: #fecaca;
}

.action-btn.regenerate:hover {
  background: #e0f2fe;
  color: #0284c7;
  border-color: #bae6fd;
}

.action-btn.expand:hover {
  background: #f0fdf4;
  color: #16a34a;
  border-color: #bbf7d0;
}

.action-btn.explore:hover {
  background: #faf5ff;
  color: #7c3aed;
  border-color: #e9d5ff;
}

.action-icon {
  font-size: 14px;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.nav-item-header.selected {
  background: #f1f5f9;
  border-radius: 4px 4px 0 0;
}
</style> 