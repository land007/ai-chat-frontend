# 多阶段构建
# 第一阶段：构建阶段
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装所有依赖（包括开发依赖）
RUN npm ci --legacy-peer-deps

# 复制源代码
COPY . .

# 构建React应用
RUN CI=false npm run build

# 复制服务器文件
COPY server.js ./

# 第二阶段：生产阶段
FROM node:20-alpine AS production

# 设置工作目录
WORKDIR /app

# 安装PM2全局
RUN npm install -g pm2

# 复制package.json和package-lock.json
COPY package*.json ./

# 只安装生产依赖
RUN npm ci --only=production --legacy-peer-deps

# 从构建阶段复制构建产物
COPY --from=builder /app/build ./build
COPY --from=builder /app/server.js ./
COPY ecosystem.config.js ./

# 创建日志目录
RUN mkdir -p logs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 使用PM2启动应用
CMD ["pm2-runtime", "start", "ecosystem.config.js"]

# docker build -t land007/ai-chat-app:latest .