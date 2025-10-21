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
const WELCOME_MESSAGE = process.env.WELCOME_MESSAGE || '';
const CONTEXT_MESSAGE_COUNT = parseInt(process.env.CONTEXT_MESSAGE_COUNT || '5', 10);

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
    description: APP_DESCRIPTION,
    welcomeMessage: WELCOME_MESSAGE
  });
});

// AI聊天API端点 - 流式传输版本
app.post('/api/chat', async (req, res) => {
  try {
    const { message, contextMessages = [], stream = false } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        error: '消息内容不能为空',
        code: 'INVALID_MESSAGE'
      });
    }

    console.log(`[AI-REQUEST] 用户消息: ${message}`);
    console.log(`[AI-REQUEST] 上下文消息数量: ${contextMessages.length}`);
    console.log(`[AI-REQUEST] 流式传输: ${stream}`);

    // 构建包含上下文的提示词
    let fullPrompt = message;
    
    if (contextMessages && contextMessages.length > 0) {
      // 限制上下文消息数量
      const limitedContext = contextMessages.slice(-CONTEXT_MESSAGE_COUNT);
      
      // 构建上下文
      const contextText = limitedContext.map(msg => {
        const role = msg.role === 'user' ? '用户' : '助手';
        return `${role}: ${msg.content}`;
      }).join('\n');
      
      fullPrompt = `以下是之前的对话内容，请根据上下文回答用户的问题：\n\n${contextText}\n\n用户: ${message}`;
    }

    console.log(`[AI-REQUEST] 完整提示词长度: ${fullPrompt.length}`);

    if (stream) {
      // 流式传输模式
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // 模拟流式传输（因为DashScope可能不支持流式）
      const response = await axios.post(
        DASHSCOPE_API_URL,
        {
          input: {
            prompt: fullPrompt
          },
          parameters: {},
          debug: {}
        },
        {
          headers: {
            'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000
        }
      );

      if (response.data && response.data.output && response.data.output.text) {
        const fullText = response.data.output.text;
        
        // 模拟打字机效果，逐字符发送
        for (let i = 0; i <= fullText.length; i++) {
          const chunk = fullText.slice(0, i);
          res.write(`data: ${JSON.stringify({ 
            content: chunk, 
            done: i === fullText.length,
            timestamp: new Date().toISOString()
          })}\n\n`);
          
          // 控制发送速度，模拟真实打字效果
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.write(`data: ${JSON.stringify({ 
          error: 'AI服务响应格式异常',
          code: 'INVALID_RESPONSE'
        })}\n\n`);
        res.end();
      }
    } else {
      // 非流式传输模式（保持原有逻辑）
      const response = await axios.post(
        DASHSCOPE_API_URL,
        {
          input: {
            prompt: fullPrompt
          },
          parameters: {},
          debug: {}
        },
        {
          headers: {
            'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000
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
    }

  } catch (error) {
    console.error('[AI-ERROR] API调用失败:', error.message);
    
    if (req.body.stream) {
      // 流式传输错误处理
      res.write(`data: ${JSON.stringify({ 
        error: 'AI服务调用失败',
        code: 'API_ERROR',
        details: error.message
      })}\n\n`);
      res.end();
    } else {
      // 非流式传输错误处理
      if (error.response) {
        console.error('[AI-ERROR] API错误响应:', error.response.status, error.response.data);
        res.status(error.response.status).json({
          error: 'AI服务暂时不可用',
          code: 'API_ERROR',
          details: error.response.data
        });
      } else if (error.code === 'ECONNABORTED') {
        res.status(408).json({
          error: '请求超时，请稍后重试',
          code: 'TIMEOUT'
        });
      } else {
        res.status(500).json({
          error: '网络连接失败，请检查网络设置',
          code: 'NETWORK_ERROR'
        });
      }
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