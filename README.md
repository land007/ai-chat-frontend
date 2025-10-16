# AI聊天应用 Docker部署指南

## 项目简介

这是一个基于React + Express的AI聊天应用，集成了阿里云DashScope API，提供智能对话功能。

## 功能特性

- 🤖 AI智能对话
- 💬 现代化聊天界面
- 🚀 Express API代理
- 🐳 Docker容器化部署
- 📱 响应式设计

## 快速部署

### 1. 构建Docker镜像

```bash
docker build -t land007/ai-chat-app .
```

### 2. 使用Docker Compose部署

#### 开发环境
```bash
docker-compose up -d
```

#### 生产环境
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 3. 使用部署脚本

```bash
# 给脚本添加执行权限
chmod +x deploy.sh

# 部署开发环境
./deploy.sh dev

# 部署生产环境
./deploy.sh prod

# 停止服务
./deploy.sh stop

# 查看状态
./deploy.sh status

# 查看日志
./deploy.sh logs
```

## 环境变量配置

应用支持以下环境变量：

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 服务端口 | `3000` |
| `APP_NAME` | 应用名称 | `AI智能助手` |
| `APP_DESCRIPTION` | 应用描述 | `基于阿里云DashScope的智能对话` |
| `DASHSCOPE_API_KEY` | 阿里云API密钥 | `your_api_key_here` |
| `DASHSCOPE_API_URL` | 阿里云API地址 | `https://dashscope.aliyuncs.com/api/v1/apps/your_app_id/completion` |

### 配置方法

#### 方法1：使用.env文件
```bash
# 创建.env文件
echo "APP_NAME=我的AI助手" > .env
echo "APP_DESCRIPTION=专业的AI对话助手" >> .env
echo "DASHSCOPE_API_KEY=sk-your_actual_api_key_here" >> .env
echo "DASHSCOPE_API_URL=https://dashscope.aliyuncs.com/api/v1/apps/your_actual_app_id/completion" >> .env
```

#### 方法2：直接设置环境变量
```bash
export APP_NAME="我的AI助手"
export APP_DESCRIPTION="专业的AI对话助手"
export DASHSCOPE_API_KEY="sk-your_actual_api_key_here"
export DASHSCOPE_API_URL="https://dashscope.aliyuncs.com/api/v1/apps/your_actual_app_id/completion"
```

#### 方法3：修改docker-compose.yml
直接编辑docker-compose.yml文件中的环境变量部分。

**⚠️ 安全提醒**: 请勿将真实的API密钥提交到代码仓库中！

## 访问地址

- **开发环境**: http://localhost:3000
- **生产环境**: http://localhost
- **API健康检查**: http://localhost:3000/api/health

## API接口

### POST /api/chat

发送聊天消息

**请求体:**
```json
{
  "message": "你好"
}
```

**响应:**
```json
{
  "success": true,
  "message": "你好！我是AI助手，有什么可以帮助您的吗？",
  "timestamp": "2025-10-16T03:10:08.399Z"
}
```

## 项目结构

```
ai-chat-frontend/
├── src/                    # React源代码
│   ├── components/         # React组件
│   └── services/          # API服务
├── build/                 # 构建输出
├── server.js             # Express服务器
├── Dockerfile            # Docker配置
├── docker-compose.yml    # 开发环境配置
├── docker-compose.prod.yml # 生产环境配置
├── deploy.sh             # 部署脚本
└── package.json          # 项目配置
```

## 技术栈

- **前端**: React 19 + TypeScript
- **后端**: Express.js + Node.js
- **AI服务**: 阿里云DashScope
- **容器化**: Docker + Docker Compose
- **UI组件**: Lucide React图标

## 故障排除

### 1. 端口冲突
如果3000端口被占用，可以修改docker-compose.yml中的端口映射：
```yaml
ports:
  - "8080:3000"  # 映射到8080端口
```

### 2. API调用超时
检查网络连接和API密钥配置是否正确。

### 3. 容器启动失败
查看容器日志：
```bash
docker-compose logs ai-chat-app
```

## 更新部署

1. 重新构建镜像：
```bash
docker build -t land007/ai-chat-app .
```

2. 重启服务：
```bash
docker-compose down
docker-compose up -d
```

## 许可证

MIT License