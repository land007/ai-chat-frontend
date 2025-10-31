# 聊天历史功能说明

## 功能概述

聊天历史功能允许用户保存、查看、搜索和恢复历史对话。所有对话会话都会自动保存，用户可以随时访问和管理。

## 主要特性

### 1. 自动保存
- ✅ AI回复完成后自动保存当前会话
- ✅ 防抖处理（2秒延迟），避免频繁保存
- ✅ 静默保存，不影响用户体验
- ✅ 自动生成会话标题（基于首条用户消息）

### 2. 历史列表
- ✅ 左侧边栏展示所有历史会话
- ✅ 按更新时间倒序排列
- ✅ 显示会话标题、预览和时间
- ✅ 分页加载（每页20条）
- ✅ 滚动到底部自动加载更多

### 3. 全文搜索
- ✅ 支持搜索会话标题和消息内容
- ✅ 实时搜索（500ms防抖）
- ✅ 标题匹配优先级高于内容匹配
- ✅ 搜索结果按相关度排序

### 4. 会话管理
- ✅ 点击会话加载历史对话
- ✅ 重命名会话标题
- ✅ 删除会话（需确认）
- ✅ 新建对话
- ✅ 当前会话高亮显示

### 5. 移动端适配
- ✅ 侧边栏全屏显示（移动端）
- ✅ 遮罩层点击关闭
- ✅ 响应式布局
- ✅ 触摸友好的交互

## 使用方法

### 打开历史侧边栏
点击顶部导航栏的菜单图标（☰）打开历史侧边栏。

### 查看历史对话
1. 在侧边栏中浏览历史会话列表
2. 点击任意会话加载其内容
3. 会话消息将显示在主聊天区域

### 搜索对话
1. 在侧边栏顶部的搜索框输入关键词
2. 系统会自动搜索标题和消息内容
3. 搜索结果实时更新

### 重命名会话
1. 将鼠标悬停在会话上
2. 点击编辑图标（✏️）
3. 输入新标题
4. 按Enter保存或点击"保存"按钮

### 删除会话
1. 将鼠标悬停在会话上
2. 点击删除图标（🗑️）
3. 确认删除操作

### 新建对话
点击侧边栏顶部的"新建对话"按钮开始新的对话。

## 数据存储

### 存储位置
```
./chat-history/
  ├── {userId}/
  │   ├── {sessionId}_metadata.json  # 会话元数据
  │   └── {sessionId}_messages.json  # 会话消息内容
```

### 用户隔离
- 每个用户的历史记录独立存储
- 用户只能访问自己的会话
- 基于JWT认证的userId区分用户

### 元数据结构
```json
{
  "id": "1735660800000_abc123",
  "userId": "user123",
  "title": "如何使用React Hooks？",
  "createdAt": 1735660800000,
  "updatedAt": 1735661000000,
  "messageCount": 6,
  "preview": "我想了解React Hooks的基本用法..."
}
```

## API端点

### 保存会话
```
POST /api/history/save
Body: { sessionId: string | null, messages: ChatMessage[] }
Response: { success: boolean, message: string, session: ChatSession }
```

### 获取会话列表
```
GET /api/history/list?page=1&pageSize=20
Response: { success: boolean, data: ChatSession[], pagination: {...} }
```

### 获取会话详情
```
GET /api/history/:sessionId
Response: { success: boolean, data: ChatSessionDetail }
```

### 删除会话
```
DELETE /api/history/:sessionId
Response: { success: boolean, message: string }
```

### 搜索会话
```
GET /api/history/search?keyword=关键词&page=1&pageSize=20
Response: { success: boolean, data: ChatSession[], pagination: {...} }
```

### 更新会话标题
```
PUT /api/history/:sessionId/title
Body: { title: string }
Response: { success: boolean, message: string, session: ChatSession }
```

## 配置选项

### 环境变量
```bash
# 历史记录存储目录
CHAT_HISTORY_DIR=./chat-history

# 历史记录分页大小
CHAT_HISTORY_PAGE_SIZE=20

# 是否自动保存历史记录
CHAT_HISTORY_AUTO_SAVE=true
```

### Docker Compose
```yaml
volumes:
  - ./chat-history:/app/chat-history

environment:
  - CHAT_HISTORY_DIR=${CHAT_HISTORY_DIR:-./chat-history}
  - CHAT_HISTORY_PAGE_SIZE=${CHAT_HISTORY_PAGE_SIZE:-20}
  - CHAT_HISTORY_AUTO_SAVE=${CHAT_HISTORY_AUTO_SAVE:-true}
```

## 技术实现

### 前端
- **React Hooks**: useState, useEffect, useCallback, useRef
- **状态管理**: 本地状态管理
- **API调用**: Fetch API
- **类型安全**: TypeScript接口定义

### 后端
- **存储**: 文件系统（JSON）
- **认证**: JWT中间件
- **用户隔离**: 基于userId的目录隔离
- **搜索**: 内存中全文搜索

### 性能优化
- **防抖**: 搜索和保存操作防抖
- **分页**: 列表分页加载
- **懒加载**: 滚动到底部加载更多
- **缓存**: 前端缓存已加载的会话

## 注意事项

1. **欢迎消息处理**: 欢迎消息（isWelcome标记）不会被保存到历史记录
2. **空会话检查**: 没有有效消息的会话不会被保存
3. **会话ID生成**: 首次保存时自动生成，格式为`{timestamp}_{randomId}`
4. **标题生成**: 自动从首条用户消息提取，最多30个字符
5. **用户认证**: 所有历史记录API都需要JWT认证

## 故障排查

### 历史记录不保存
1. 检查`CHAT_HISTORY_AUTO_SAVE`环境变量是否为true
2. 查看浏览器控制台是否有错误
3. 检查用户是否已登录（JWT token有效）
4. 确认至少有一条有效的对话消息

### 无法加载历史记录
1. 检查`CHAT_HISTORY_DIR`目录是否存在
2. 确认文件权限是否正确
3. 查看服务器日志错误信息
4. 验证JWT token是否有效

### 搜索不工作
1. 确认输入的关键词不为空
2. 检查是否有匹配的历史记录
3. 查看浏览器控制台网络请求

## 未来改进

- [ ] 支持会话标签和分类
- [ ] 导出会话为文本/PDF
- [ ] 会话分享功能
- [ ] 更高级的搜索过滤
- [ ] 会话统计和分析
- [ ] 数据库存储支持

## 版本历史

### v1.0.0 (2025-01-01)
- ✅ 初始发布
- ✅ 自动保存功能
- ✅ 历史列表和搜索
- ✅ 会话管理（重命名、删除）
- ✅ 移动端适配

