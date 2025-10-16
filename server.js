const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 从环境变量读取配置
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || 'your_api_key_here';
const DASHSCOPE_API_URL = process.env.DASHSCOPE_API_URL || 'https://dashscope.aliyuncs.com/api/v1/apps/your_app_id/completion';
const APP_NAME = process.env.APP_NAME || 'AI智能助手';
const APP_DESCRIPTION = process.env.APP_DESCRIPTION || '基于阿里云DashScope的智能对话';

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API路由 - 必须在静态文件服务之前定义
// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AI Chat API'
  });
});

// 应用配置端点
app.get('/api/config', (req, res) => {
  res.json({
    name: APP_NAME,
    description: APP_DESCRIPTION
  });
});

// AI聊天API端点
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        error: '消息内容不能为空',
        code: 'INVALID_MESSAGE'
      });
    }

    console.log(`[AI-REQUEST] 用户消息: ${message}`);

    // 转发请求到阿里云DashScope
    const response = await axios.post(
      DASHSCOPE_API_URL,
      {
        input: {
          prompt: message
        },
        parameters: {},
        debug: {}
      },
      {
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30秒超时
      }
    );

    console.log(`[AI-RESPONSE] 状态: ${response.status}`);

    if (response.data && response.data.output && response.data.output.text) {
      res.json({
        success: true,
        message: response.data.output.text,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('[AI-ERROR] 响应格式异常:', response.data);
      res.status(500).json({
        error: 'AI服务响应格式异常',
        code: 'INVALID_RESPONSE'
      });
    }

  } catch (error) {
    console.error('[AI-ERROR] API调用失败:', error.message);
    
    if (error.response) {
      // API返回了错误响应
      console.error('[AI-ERROR] API错误响应:', error.response.status, error.response.data);
      res.status(error.response.status).json({
        error: 'AI服务暂时不可用',
        code: 'API_ERROR',
        details: error.response.data
      });
    } else if (error.code === 'ECONNABORTED') {
      // 请求超时
      res.status(408).json({
        error: '请求超时，请稍后重试',
        code: 'TIMEOUT'
      });
    } else {
      // 其他网络错误
      res.status(500).json({
        error: '网络连接失败，请检查网络设置',
        code: 'NETWORK_ERROR'
      });
    }
  }
});

// 静态文件服务 - 提供React构建文件
app.use(express.static(path.join(__dirname, 'build')));

// 前端路由处理 - 所有非API请求都返回index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('[SERVER-ERROR]', err);
  res.status(500).json({
    error: '服务器内部错误',
    code: 'INTERNAL_ERROR'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 AI聊天应用已启动`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`🔗 API端点: http://localhost:${PORT}/api/chat`);
  console.log(`❤️  健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;