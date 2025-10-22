# 企业微信身份认证集成说明

## 概述

本项目已成功集成企业微信OAuth2.0网页授权认证，用户必须通过企业微信登录才能访问AI聊天应用。

## 功能特性

✅ **企业微信OAuth2.0认证** - 安全的用户身份验证  
✅ **JWT Token管理** - 24小时有效期的会话管理  
✅ **自动登录状态保持** - localStorage持久化token  
✅ **用户信息显示** - 界面显示当前登录用户姓名  
✅ **退出登录** - 一键退出并清除会话  
✅ **API保护** - 所有业务API都需要认证才能访问

## 认证流程

```
1. 用户访问应用
   ↓
2. 检查localStorage中是否有token
   ↓
3. 无token → 显示登录页面
   ↓
4. 点击"使用企业微信登录"
   ↓
5. 重定向到企业微信授权页面
   ↓
6. 用户在企业微信中确认授权
   ↓
7. 企业微信回调应用（带上code）
   ↓
8. 后端用code换取access_token
   ↓
9. 获取用户UserId和姓名
   ↓
10. 生成JWT token返回给前端
    ↓
11. 前端保存token到localStorage
    ↓
12. 显示主应用界面
```

## 环境变量配置

所有配置已添加到 `docker-compose.yml` 和 `docker-compose.prod.yml`:

```yaml
# 企业微信认证配置
- WEWORK_CORP_ID=${WEWORK_CORP_ID}           # 企业ID，如: ww1234567890abcdef
- WEWORK_AGENT_ID=${WEWORK_AGENT_ID}         # 应用AgentID，如: 1000002
- WEWORK_CORP_SECRET=${WEWORK_CORP_SECRET}   # 应用Secret（保密）
- WEWORK_REDIRECT_URI=${WEWORK_REDIRECT_URI} # 如: https://your-domain.com/
- JWT_SECRET=${JWT_SECRET}                   # JWT签名密钥（保密）
```

## 企业微信后台配置

### 必需配置

在企业微信管理后台（https://work.weixin.qq.com/）完成以下配置：

1. **应用信息**
   - 企业ID: `ww1234567890abcdef`（示例）
   - 应用AgentID: `1000002`（示例）
   - 应用Secret: `YOUR_SECRET_KEY_HERE`（从企业微信后台获取）

2. **网页授权域名**
   - 进入应用详情 → "网页授权及JS-SDK"
   - 添加可信域名: `your-domain.com`（您的实际域名）
   - ⚠️ 注意：只填写域名，不要带 `https://` 或端口号

3. **可见范围**
   - 设置允许访问该应用的员工范围

## API端点说明

### 认证相关API（无需认证）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/auth/wework/redirect` | GET | 获取企业微信授权URL |
| `/api/auth/wework/callback?code=xxx` | GET | 处理授权回调，返回JWT token |

### 业务API（需要认证）

| 端点 | 方法 | 说明 | 认证方式 |
|------|------|------|----------|
| `/api/config` | GET | 获取应用配置 | Bearer Token |
| `/api/chat` | POST | 发送聊天消息 | Bearer Token |
| `/api/auth/userinfo` | GET | 获取当前用户信息 | Bearer Token |
| `/api/auth/logout` | POST | 退出登录 | Bearer Token |

### 认证请求示例

```bash
# 获取授权URL
curl http://localhost:3000/api/auth/wework/redirect

# 获取用户信息（需要token）
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/auth/userinfo

# 发送聊天消息（需要token）
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"message":"你好","stream":false}' \
     http://localhost:3000/api/chat
```

## 前端实现

### 新增文件

1. **`src/services/auth.ts`**
   - 企业微信认证服务
   - Token管理（localStorage）
   - 用户信息获取

2. **`src/contexts/AuthContext.tsx`**
   - React认证上下文
   - 全局认证状态管理
   - `useAuth` hook

3. **`src/components/Login.tsx`**
   - 登录界面组件
   - 授权回调处理
   - 加载状态显示

### 修改文件

1. **`src/App.tsx`**
   - 集成 `AuthProvider`
   - 登录状态检查
   - 条件渲染（登录页 vs 主应用）

2. **`src/components/ChatInterface.tsx`**
   - 显示当前登录用户姓名
   - 添加退出登录按钮

3. **`src/services/api.ts`**
   - 所有API请求自动添加 `Authorization` header

## 后端实现

### server.js 新增功能

1. **企业微信API服务**
   ```javascript
   - getWeworkAccessToken()      // 获取企业微信access_token
   - getUserIdByCode(code)       // 通过code获取UserId
   - getUserInfo(userId)         // 获取用户详细信息
   ```

2. **JWT认证中间件**
   ```javascript
   - authenticateToken()         // 验证JWT token
   ```

3. **认证路由**
   ```javascript
   - GET  /api/auth/wework/redirect    // 发起授权
   - GET  /api/auth/wework/callback    // 授权回调
   - GET  /api/auth/userinfo          // 获取用户信息
   - POST /api/auth/logout            // 退出登录
   ```

## 安全机制

1. **JWT签名验证** - 使用密钥签名防止token伪造
2. **Token过期** - 24小时自动过期，需重新登录
3. **HTTPS传输** - 生产环境使用HTTPS保护数据传输
4. **环境变量保护** - 敏感配置不提交代码仓库
5. **API认证** - 所有业务API都需要有效token

## 部署说明

### 使用Docker Compose部署

```bash
# 构建镜像
docker build -t land007/ai-chat-app .

# 启动服务（开发环境）
docker-compose up -d

# 启动服务（生产环境）
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose logs -f ai-chat-app

# 停止服务
docker-compose down
```

### 验证部署

1. **检查服务状态**
   ```bash
   curl https://xzs.myships.com/api/health
   ```

2. **测试认证流程**
   - 访问 `https://xzs.myships.com`
   - 应该自动跳转到登录页面
   - 点击"使用企业微信登录"
   - 完成授权后应显示主应用

## 故障排除

### 1. 无法跳转到企业微信授权页面

**可能原因：**
- 企业微信配置不完整
- `WEWORK_REDIRECT_URI` 配置错误

**解决方法：**
```bash
# 检查环境变量
docker exec ai-chat-app printenv | grep WEWORK

# 查看服务器日志
docker logs ai-chat-app
```

### 2. 授权后返回错误

**可能原因：**
- code已过期（企业微信的code只能使用一次）
- 企业微信Secret错误
- 网络无法访问企业微信API

**解决方法：**
```bash
# 查看详细日志
docker logs -f ai-chat-app

# 检查是否能访问企业微信API
docker exec ai-chat-app curl https://qyapi.weixin.qq.com
```

### 3. Token验证失败

**可能原因：**
- JWT_SECRET不匹配
- Token已过期
- localStorage被清除

**解决方法：**
- 清除浏览器localStorage重新登录
- 检查服务器JWT_SECRET配置

### 4. 可信域名配置问题

**症状：**
- 授权时提示"redirect_uri参数错误"

**解决方法：**
1. 确认企业微信后台已配置 `xzs.myships.com`
2. 确认配置时没有添加协议（http/https）
3. 确认配置时没有添加端口号
4. 配置修改后需要等待几分钟生效

## 技术栈

### 后端
- Node.js + Express.js
- jsonwebtoken (JWT生成和验证)
- axios (HTTP请求)

### 前端
- React 19 + TypeScript
- React Context API (状态管理)
- localStorage (Token持久化)

## 开发调试

### 本地开发

由于企业微信要求回调地址必须是公网可访问的域名，本地开发需要使用内网穿透工具：

```bash
# 使用 ngrok
ngrok http 3000

# 或使用 natapp
natapp -authtoken=your_token

# 然后在企业微信后台配置临时域名
```

### 日志级别

所有认证相关日志都带有 `[认证]` 或 `[企业微信]` 前缀，便于筛选：

```bash
# 查看认证相关日志
docker logs ai-chat-app 2>&1 | grep "认证"
docker logs ai-chat-app 2>&1 | grep "企业微信"
```

## 注意事项

⚠️ **重要安全提醒**

1. 不要将真实的企业微信Secret和JWT_SECRET提交到代码仓库
2. 定期轮换JWT_SECRET和企业微信Secret
3. 生产环境务必使用HTTPS
4. 企业微信的code只能使用一次，5分钟内有效
5. JWT token默认24小时过期，可根据需要调整

## 更新日志

### 2025-10-22
- ✅ 集成企业微信OAuth2.0网页授权
- ✅ 实现JWT token认证
- ✅ 添加登录/退出功能
- ✅ 保护所有业务API
- ✅ 添加用户信息显示
- ✅ 完善错误处理和日志

## 进程管理

本项目使用 **PM2** 进行进程管理，具有以下特性：
- ✅ 自动重启（崩溃、内存超限）
- ✅ 文件监控（开发模式）
- ✅ 日志管理
- ✅ 零停机重启

详细使用说明请查看：`PM2使用指南.md`

### 快速命令
```bash
# 开发模式（监控文件变化）
npm run server:dev

# 生产模式（稳定运行）
npm run server:prod

# 查看状态和日志
npm run server:status
npm run server:logs
```

## 联系支持

如有问题，请查看：
- 企业微信开发文档：https://developer.work.weixin.qq.com/
- 进程管理指南：`PM2使用指南.md`
- 服务器日志：`docker logs ai-chat-app` 或 `npm run server:logs`

