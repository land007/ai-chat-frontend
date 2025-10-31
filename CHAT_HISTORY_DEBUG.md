# 聊天历史保存调试指南

## 保存机制说明

**客户端主动保存**（使用React useEffect确保状态同步）：
1. AI回复完成后，前端调用 `saveCurrentSession()` 函数设置保存标记
2. `useEffect` 监听到 `messages` 状态更新后，自动执行保存
3. 通过 `chatAPI.saveSession()` 向后端发起 `POST /api/history/save` 请求
4. 后端接收到请求后，将会话保存到文件系统

**为什么使用useEffect**：
- 避免闭包问题（获取到旧的状态）
- 确保React状态完全更新后再保存
- 保证保存的消息包含最新的AI回复

## 保存时机

自动保存会在以下情况触发：
- ✅ 发送消息后AI回复完成
- ✅ 编辑问题后AI重新回复完成
- ✅ 重新生成回复完成
- ✅ 点击示例问题后AI回复完成

## 如何验证保存功能

### 1. 打开浏览器控制台

在Chrome/Edge中按 `F12` 或 `Ctrl+Shift+I`（Mac: `Cmd+Option+I`）

### 2. 查看Console日志

发送一条消息并等待AI回复完成后，你应该看到以下日志：

```
[历史记录] 自动保存会话 {
  currentSessionId: null, 
  messageCount: 2, 
  messages: [
    {role: 'user', contentLength: 15},
    {role: 'assistant', contentLength: 564}
  ]
}
[前端API-历史] 保存会话 {sessionId: null, messageCount: 2}
[前端API-历史] 保存成功 1735660800000_abc123
[历史记录] 新会话已创建 1735660800000_abc123
```

**关键信息**：
- `messageCount: 2` - 表示有2条有效消息（用户消息 + AI回复）
- `messages` 数组 - 显示每条消息的角色和内容长度
- 如果AI回复的 `contentLength` 为0或很小，说明内容可能没有正确保存

如果看到 `[历史记录] 没有有效消息，跳过保存`，说明消息列表中只有欢迎消息或为空。

### 3. 查看Network面板

切换到 `Network` 标签：
1. 发送消息并等待AI回复
2. 在网络请求列表中查找 `save` 请求
3. 点击该请求查看详情：
   - **Request URL**: `http://localhost:3000/api/history/save`
   - **Request Method**: `POST`
   - **Status Code**: `200 OK`
   - **Request Payload**: 包含 `sessionId` 和 `messages` 数组

### 4. 检查后端日志

如果前端没有发起保存请求，查看服务器日志：

```bash
# 查看PM2日志
pm2 logs ai-chat-app

# 或查看Docker日志
docker logs ai-chat-app
```

成功保存时应该看到：
```
[历史记录] 会话保存成功 { user: 'admin', sessionId: '1735660800000_abc123', messageCount: 2, isNew: true }
```

### 5. 检查文件系统

验证文件是否实际保存：

```bash
# 进入历史记录目录
cd /home/ubuntu/project/gjxt-oa/ai-chat-frontend/chat-history

# 查看用户目录
ls -la

# 查看具体用户的会话文件
ls -la admin/  # 替换为你的userId

# 查看会话元数据
cat admin/1735660800000_abc123_metadata.json

# 查看会话消息
cat admin/1735660800000_abc123_messages.json
```

## 常见问题排查

### 问题1：没有看到保存请求

**可能原因**：
1. 只有欢迎消息，没有实际对话
2. 用户未登录（JWT token无效）
3. JavaScript错误导致函数未执行

**解决方法**：
1. 确保至少发送一条消息并得到AI回复
2. 检查控制台是否有错误
3. 刷新页面重新登录

### 问题2：保存请求失败（4xx/5xx）

**可能原因**：
1. JWT token过期或无效
2. 后端服务未启动
3. 历史记录目录权限问题

**解决方法**：
```bash
# 检查服务状态
pm2 status

# 检查目录权限
ls -la chat-history/

# 如果权限不足，修复权限
chmod -R 755 chat-history/
```

### 问题3：保存成功但列表中看不到

**可能原因**：
1. 侧边栏未刷新
2. 文件保存失败但未报错
3. 用户ID不匹配

**解决方法**：
1. 关闭并重新打开历史侧边栏
2. 刷新页面
3. 检查文件系统中是否有对应文件

### 问题4：控制台提示"没有有效消息，跳过保存"

**原因**：消息列表中只有欢迎消息（标记为 `isWelcome: true`）

**解决方法**：发送至少一条实际消息

## 手动测试步骤

### 测试1：基本保存功能

1. 打开应用并登录
2. 打开浏览器控制台（Console + Network标签）
3. 发送消息："你好"
4. 等待AI回复完成
5. 检查控制台日志：应该看到 `[历史记录] 自动保存会话`
6. 检查Network：应该看到 `POST /api/history/save` 请求
7. 点击历史记录按钮（☰）
8. 验证列表中出现新会话

### 测试2：会话恢复

1. 在历史列表中点击刚才创建的会话
2. 验证消息是否正确加载
3. 继续发送消息
4. 验证会话是否更新（检查Network是否发起save请求）

### 测试3：搜索功能

1. 在历史侧边栏搜索框输入"你好"
2. 验证搜索结果是否包含刚才的会话
3. 清空搜索框，验证完整列表恢复

### 测试4：删除功能

1. 在历史列表中悬停在会话上
2. 点击删除图标（🗑️）
3. 确认删除
4. 验证会话从列表中消失
5. 检查文件系统确认文件已删除

## 调试技巧

### 启用详细日志

在前端代码中，所有历史记录相关的操作都有 `console.log` 输出，包括：
- `[历史记录]` - 前端历史记录操作
- `[前端API-历史]` - API调用
- 后端日志中查找 `[历史记录]` 标签

### 强制触发保存

如果想立即保存，可以在控制台手动调用（用于测试）：

```javascript
// 在浏览器控制台执行
// 注意：这只是测试方法，实际使用时会自动保存
```

### 检查认证状态

```bash
# 在浏览器控制台查看token
localStorage.getItem('token')

# 应该返回JWT token字符串
# 如果返回null，说明未登录
```

## 重要提示

1. **认证必需**：所有历史记录API都需要有效的JWT token
2. **自动保存**：保存会在AI回复完成后自动触发，无需手动操作
3. **用户隔离**：每个用户只能看到自己的历史记录
4. **欢迎消息**：标记为 `isWelcome: true` 的消息不会被保存

## 需要帮助？

如果问题仍未解决：
1. 提供浏览器控制台完整日志
2. 提供Network面板的请求/响应详情
3. 提供服务器日志相关片段
4. 描述具体的操作步骤和预期结果

