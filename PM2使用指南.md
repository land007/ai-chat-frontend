# PM2进程管理使用指南

## 统一方案：PM2

本项目**统一使用PM2**进行进程管理，支持开发和生产两种模式。

## 核心特性

✅ **自动重启** - 代码改变自动重启（开发模式）、崩溃自动重启（生产模式）  
✅ **内存监控** - 内存超过500MB自动重启  
✅ **进程守护** - 后台运行，死机自动恢复  
✅ **日志管理** - 自动记录错误和输出日志  
✅ **零停机重启** - 支持热重启  

---

## 快速开始

### 开发模式（监控文件变化）
```bash
npm run server:dev
```
- 自动监控 `server.js` 文件变化
- 代码修改后自动重启
- 适合本地开发

### 生产模式（稳定运行）
```bash
npm run server:prod
```
- 不监控文件变化
- 崩溃、内存超限自动重启
- 适合生产部署

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run server:dev` | 开发模式启动（监控文件） |
| `npm run server:prod` | 生产模式启动 |
| `npm run server:stop` | 停止服务 |
| `npm run server:restart` | 重启服务 |
| `npm run server:delete` | 删除进程 |
| `npm run server:logs` | 查看日志 |
| `npm run server:status` | 查看状态 |
| `npm run dev` | 前后端同时启动（开发） |

---

## 使用场景

### 场景1：本地开发（推荐）
```bash
# 前端和后端同时启动，后端自动监控文件变化
npm run dev
```

### 场景2：只开发后端
```bash
# 只启动后端服务器，自动监控文件变化
npm run server:dev
```

### 场景3：生产环境测试
```bash
# 先构建前端
npm run build

# 启动生产模式
npm run server:prod
```

### 场景4：查看运行状态
```bash
# 查看PM2状态
npm run server:status

# 查看实时日志
npm run server:logs
```

---

## PM2高级命令

如果需要更精细的控制，可以直接使用PM2命令：

```bash
# 查看所有进程
pm2 list

# 查看详细信息
pm2 show ai-chat-server

# 实时监控（CPU、内存）
pm2 monit

# 查看日志（最近100行）
pm2 logs ai-chat-server --lines 100

# 清空日志
pm2 flush

# 重载配置（零停机）
pm2 reload ai-chat-server

# 停止所有进程
pm2 stop all

# 删除所有进程
pm2 delete all
```

---

## Docker部署

### Dockerfile已配置PM2

容器启动时自动使用PM2守护进程：
- ✅ 自动重启
- ✅ 日志管理
- ✅ 优雅关闭

### Docker命令

```bash
# 构建镜像
docker build -t land007/ai-chat-app .

# 启动容器（开发）
docker-compose up -d

# 启动容器（生产）
docker-compose -f docker-compose.prod.yml up -d

# 查看容器日志
docker logs -f ai-chat-app

# 查看容器内PM2状态
docker exec ai-chat-app pm2 status

# 查看容器内PM2日志
docker exec ai-chat-app pm2 logs

# 重启容器
docker-compose restart
```

---

## 故障排除

### 问题1：端口被占用
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方法：**
```bash
# 停止PM2进程
npm run server:stop

# 或强制杀死占用端口的进程
lsof -ti:3000 | xargs kill -9

# 重新启动
npm run server:dev  # 或 server:prod
```

### 问题2：PM2进程异常

**解决方法：**
```bash
# 查看状态
npm run server:status

# 查看详细日志
npm run server:logs

# 删除异常进程
npm run server:delete

# 重新启动
npm run server:dev
```

### 问题3：文件改变不自动重启

**检查项：**
1. 确认使用的是开发模式：`npm run server:dev`
2. 查看PM2状态确认watch=enabled：`pm2 status`
3. 修改 `ecosystem.config.js` 中的 `watch` 选项

### 问题4：内存持续增长

**解决方法：**
```bash
# PM2会在内存超过500MB时自动重启

# 手动重启释放内存
npm run server:restart

# 查看内存使用情况
pm2 monit
```

---

## 日志管理

### 日志文件位置
```
logs/pm2-error.log   # 错误日志
logs/pm2-out.log     # 输出日志
```

### 查看日志
```bash
# 实时日志
npm run server:logs

# 或直接查看文件
tail -f logs/pm2-error.log
tail -f logs/pm2-out.log

# 清空日志
pm2 flush
```

---

## 配置说明

### ecosystem.config.js

```javascript
{
  name: 'ai-chat-server',        // 进程名称
  script: './server.js',         // 启动脚本
  instances: 1,                  // 进程数量
  autorestart: true,             // 自动重启
  watch: false,                  // 默认不监控（生产）
  max_memory_restart: '500M',    // 内存阈值
  
  env_development: {             // 开发环境变量
    NODE_ENV: 'development',
    PORT: 3000
  },
  
  env_production: {              // 生产环境变量
    NODE_ENV: 'production',
    PORT: 3000
  }
}
```

### 修改配置后重启
```bash
# 方法1：删除后重新启动
npm run server:delete
npm run server:prod

# 方法2：使用reload（推荐）
pm2 reload ecosystem.config.js
```

---

## 监控指标

使用 `pm2 monit` 可以实时查看：

- **CPU使用率** - 进程CPU占用百分比
- **内存使用量** - 当前内存使用
- **重启次数** - 自动重启的次数
- **运行时间** - 进程持续运行时间

---

## 最佳实践

### ✅ 开发时
```bash
# 使用开发模式，自动监控文件变化
npm run dev
```

### ✅ 测试时
```bash
# 使用生产模式测试稳定性
npm run build
npm run server:prod
```

### ✅ 部署时
```bash
# 使用Docker部署，PM2自动管理
docker-compose -f docker-compose.prod.yml up -d
```

### ✅ 维护时
```bash
# 定期查看日志和状态
npm run server:status
npm run server:logs
```

---

## 总结

| 需求 | 命令 |
|------|------|
| 本地开发（自动重启） | `npm run server:dev` |
| 生产运行（稳定） | `npm run server:prod` |
| 查看状态 | `npm run server:status` |
| 查看日志 | `npm run server:logs` |
| 停止服务 | `npm run server:stop` |
| 重启服务 | `npm run server:restart` |

**记住：PM2已经帮你处理了进程管理的所有复杂性，只需要用对命令即可！** 🚀

