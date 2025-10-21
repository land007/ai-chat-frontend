import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import axios, { AxiosResponse } from 'axios';
import path from 'path';
import type {
  EnvironmentConfig,
  ChatRequest,
  ChatMessage,
  DashScopeRequest,
  DashScopeResponse,
  ChatResponse,
  ErrorResponse,
  ConfigResponse,
  HealthResponse,
} from './src/types';

const app: express.Application = express();
const PORT: number = parseInt(process.env.PORT || '3002', 10);

// 从环境变量读取配置
const config: EnvironmentConfig = {
  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || 'sk-b1a80ab373754d59a37b46a9c37a2d01',
  DASHSCOPE_API_URL: process.env.DASHSCOPE_API_URL || 'https://dashscope.aliyuncs.com/api/v1/apps/94e854e4500f472db5fbe7ca856a6c0c/completion',
  APP_NAME: process.env.APP_NAME || 'AI智能助手',
  APP_DESCRIPTION: process.env.APP_DESCRIPTION || '基于阿里云DashScope的智能对话',
  WELCOME_MESSAGE: process.env.WELCOME_MESSAGE || '',
  CONTEXT_MESSAGE_COUNT: parseInt(process.env.CONTEXT_MESSAGE_COUNT || '5', 10)
};

// 类型定义已移至 src/types/index.ts

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志中间件
app.use((req: Request, _res: Response, next: NextFunction): void => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API路由 - 必须在静态文件服务之前定义
// 健康检查端点
app.get('/api/health', (_req: Request, res: Response<HealthResponse>): void => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AI Chat API'
  });
});

// 应用配置端点
app.get('/api/config', (_req: Request, res: Response<ConfigResponse>): void => {
  res.json({
    name: config.APP_NAME,
    description: config.APP_DESCRIPTION,
    welcomeMessage: config.WELCOME_MESSAGE,
    tts: {
      enabled: process.env.REACT_APP_TTS_ENABLED === 'true',
      apiUrl: process.env.REACT_APP_TTS_API_URL || ''
    }
  });
});

// SSE测试端点
app.post('/api/test-sse', async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log('[SSE-TEST] 开始SSE测试');
    
    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 发送开始事件
    res.write(`data: ${JSON.stringify({ type: 'start', timestamp: new Date().toISOString() })}\n\n`);
    console.log('[SSE-TEST] 发送开始事件');

    // 模拟流式数据
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
      
      const contentEvent = JSON.stringify({ 
        type: 'content', 
        content: `这是第${i}条测试消息`,
        timestamp: new Date().toISOString()
      });
      
      res.write(`data: ${contentEvent}\n\n`);
      console.log(`[SSE-TEST] 发送第${i}条消息`);
    }

    // 发送完成事件
    const doneEvent = JSON.stringify({ 
      type: 'done', 
      timestamp: new Date().toISOString()
    });
    
    res.write(`data: ${doneEvent}\n\n`);
    console.log('[SSE-TEST] 发送完成事件');
    
    console.log('[SSE-TEST] 调用 res.end() - SSE测试正常结束');
    res.end();
    console.log('[SSE-TEST] SSE测试完成');

  } catch (error) {
    console.error('[SSE-TEST] 测试失败:', error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: 'SSE测试失败',
      code: 'TEST_ERROR'
    })}\n\n`);
    console.log('[SSE-TEST] 调用 res.end() - SSE测试异常结束');
    res.end();
  }
});

// AI聊天API端点 - 流式返回
app.post('/api/chat/stream', async (req: Request<unknown, unknown, ChatRequest>, res: Response): Promise<void> => {
  try {
    const { message, contextMessages = [] } = req.body;
    
    if (!message || typeof message !== 'string') {
      res.status(400).json({ 
        error: '消息内容不能为空',
        code: 'INVALID_MESSAGE'
      });
      return;
    }

    console.log(`[AI-STREAM-REQUEST] 用户消息: ${message}`);
    console.log(`[AI-STREAM-REQUEST] 上下文消息数量: ${contextMessages.length}`);

    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 构建包含上下文的提示词
    let fullPrompt: string = message;
    
    if (contextMessages && contextMessages.length > 0) {
      // 限制上下文消息数量
      const limitedContext: ChatMessage[] = contextMessages.slice(-config.CONTEXT_MESSAGE_COUNT);
      
      // 构建上下文
      const contextText: string = limitedContext.map((msg: ChatMessage): string => {
        const role: string = msg.role === 'user' ? '用户' : '助手';
        return `${role}: ${msg.content}`;
      }).join('\n');
      
      fullPrompt = `以下是之前的对话内容，请根据上下文回答用户的问题：\n\n${contextText}\n\n用户: ${message}`;
    }

    console.log(`[AI-STREAM-REQUEST] 完整提示词长度: ${fullPrompt.length}`);

    // 发送开始事件
    const startEvent = JSON.stringify({ type: 'start', timestamp: new Date().toISOString() });
    console.log('[AI-STREAM-REQUEST] 发送开始事件:', startEvent);
    res.write(`data: ${startEvent}\n\n`);

    // 转发请求到阿里云DashScope - 尝试使用流式响应
    let heartbeatInterval: NodeJS.Timeout | undefined;
    
    try {
      const dashScopeRequest: DashScopeRequest = {
        input: {
          prompt: fullPrompt
        },
        parameters: {
          incremental_output: true // 启用增量输出
        },
        debug: {}
      };

      console.log('[AI-STREAM-REQUEST] 发送DashScope请求:', JSON.stringify(dashScopeRequest, null, 2));

      // 添加心跳机制，确保连接保持活跃
      heartbeatInterval = setInterval(() => {
        try {
          res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
        } catch (error) {
          console.log('[AI-STREAM-REQUEST] 心跳发送失败，连接可能已断开');
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
          }
        }
      }, 30000); // 每30秒发送一次心跳

      // 尝试使用流式请求
      console.log('[AI-STREAM-REQUEST] 开始发送DashScope请求...');
      console.log('[AI-STREAM-REQUEST] DashScope API URL:', config.DASHSCOPE_API_URL);
      console.log('[AI-STREAM-REQUEST] DashScope API Key:', config.DASHSCOPE_API_KEY ? '已设置' : '未设置');
      
      const response = await axios.post(
        config.DASHSCOPE_API_URL,
        dashScopeRequest,
        {
          headers: {
            'Authorization': `Bearer ${config.DASHSCOPE_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream', // 请求流式响应
            'X-DashScope-SSE': 'enable' // 启用DashScope SSE
          },
          timeout: 30000, // 30秒超时
          responseType: 'stream' // 设置响应类型为流
        }
      );

      console.log('[AI-STREAM-REQUEST] DashScope请求发送成功，状态码:', response.status);
      console.log('[AI-STREAM-REQUEST] DashScope响应头:', response.headers);

      // 处理流式响应
      let buffer = '';
      let lastSentText = '';
      let isStreamComplete = false;
      
      response.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        console.log('[AI-STREAM-RESPONSE] 收到原始数据块:', chunk.length, '字节');
        
        // 处理SSE格式的数据
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个不完整的行
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const eventData = JSON.parse(line.slice(5).trim());
              console.log('[AI-STREAM-RESPONSE] 收到DashScope事件:', {
                type: eventData.output?.finish_reason || 'content',
                textLength: eventData.output?.text?.length || 0
              });
              
              // 处理文本内容
              if (eventData.output && eventData.output.text !== undefined) {
                const currentText = eventData.output.text;
                
                // 计算新增的文本（从上次发送的位置开始）
                if (currentText.length > lastSentText.length) {
                  const newContent = currentText.slice(lastSentText.length);
                  lastSentText = currentText;
                  
                  console.log('[AI-STREAM-RESPONSE] 新增文本长度:', newContent.length);
                  
                  // 转发新增的文本给前端
                  const contentEvent = JSON.stringify({ 
                    type: 'content', 
                    content: newContent,
                    timestamp: new Date().toISOString()
                  });
                  console.log('[AI-STREAM-RESPONSE] 发送内容事件:', contentEvent);
                  res.write(`data: ${contentEvent}\n\n`);
                }
              }
              
              // 检查是否完成
              if (eventData.output && eventData.output.finish_reason === 'stop') {
                console.log('[AI-STREAM-RESPONSE] 流式响应完成');
                isStreamComplete = true;
                const doneEvent = JSON.stringify({ 
                  type: 'done', 
                  timestamp: new Date().toISOString()
                });
                console.log('[AI-STREAM-RESPONSE] 发送完成事件:', doneEvent);
                res.write(`data: ${doneEvent}\n\n`);
              }
            } catch (parseError) {
              console.warn('[AI-STREAM-RESPONSE] 解析DashScope事件失败:', parseError);
              console.warn('[AI-STREAM-RESPONSE] 原始行:', line);
            }
          }
        }
      });

      // 添加超时处理
      const timeoutId = setTimeout(() => {
        console.warn('[AI-STREAM-RESPONSE] 流式响应超时');
        if (!isStreamComplete) {
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            error: '流式响应超时',
            code: 'TIMEOUT'
          })}\n\n`);
        }
      }, 60000); // 60秒超时

      response.data.on('end', () => {
        console.log('[AI-STREAM-RESPONSE] DashScope流式响应结束');
        clearTimeout(timeoutId);
        clearInterval(heartbeatInterval);
        if (!isStreamComplete) {
          console.log('[AI-STREAM-RESPONSE] 流式响应意外结束，发送完成事件');
          res.write(`data: ${JSON.stringify({ 
            type: 'done', 
            timestamp: new Date().toISOString()
          })}\n\n`);
        }
        console.log('[AI-STREAM-RESPONSE] 调用 res.end() - DashScope流式响应结束');
        res.end();
      });

      response.data.on('error', (error: Error) => {
        console.error('[AI-STREAM-RESPONSE] DashScope流式响应错误:', error);
        clearTimeout(timeoutId);
        clearInterval(heartbeatInterval);
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: 'DashScope流式响应错误',
          code: 'STREAM_ERROR',
          details: error.message
        })}\n\n`);
        console.log('[AI-STREAM-RESPONSE] 调用 res.end() - DashScope流式响应错误');
        res.end();
      });

    } catch (streamError) {
      console.error('[AI-STREAM-FALLBACK] 流式请求失败，详细错误:', streamError);
      console.error('[AI-STREAM-FALLBACK] 错误类型:', typeof streamError);
      console.error('[AI-STREAM-FALLBACK] 错误消息:', streamError instanceof Error ? streamError.message : '未知错误');
      console.error('[AI-STREAM-FALLBACK] 错误堆栈:', streamError instanceof Error ? streamError.stack : '无堆栈信息');
      
      // 清理心跳定时器
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      
      // 如果流式请求失败，回退到传统方式
      try {
        const dashScopeRequest: DashScopeRequest = {
          input: {
            prompt: fullPrompt
          },
          parameters: {},
          debug: {}
        };

        const response: AxiosResponse<DashScopeResponse> = await axios.post(
          config.DASHSCOPE_API_URL,
          dashScopeRequest,
          {
            headers: {
              'Authorization': `Bearer ${config.DASHSCOPE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000
          }
        );

        if (response.data && response.data.output && response.data.output.text) {
          const fullText = response.data.output.text;
          
          // 模拟流式返回，按字符发送
          for (let i = 0; i < fullText.length; i++) {
            const char = fullText[i];
            res.write(`data: ${JSON.stringify({ 
              type: 'content', 
              content: char,
              timestamp: new Date().toISOString()
            })}\n\n`);
            
            // 添加小延迟模拟真实流式效果
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          
          // 发送完成事件
          res.write(`data: ${JSON.stringify({ 
            type: 'done', 
            timestamp: new Date().toISOString()
          })}\n\n`);
          
        } else {
          console.error('[AI-STREAM-FALLBACK-ERROR] 响应格式异常:', response.data);
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            error: 'AI服务响应格式异常',
            code: 'INVALID_RESPONSE'
          })}\n\n`);
        }
      } catch (fallbackError) {
        console.error('[AI-STREAM-FALLBACK-ERROR] 回退请求也失败:', fallbackError);
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: 'AI服务完全不可用',
          code: 'SERVICE_UNAVAILABLE'
        })}\n\n`);
      }

    }

    // 注意：不要在这里调用 res.end()，因为DashScope的流式处理是异步的
    // res.end() 应该在DashScope流式处理完成后调用

  } catch (error: unknown) {
    console.error('[AI-STREAM-ERROR] 处理失败:', error instanceof Error ? error.message : '未知错误');
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: '服务器内部错误',
      code: 'INTERNAL_ERROR'
    })}\n\n`);
    console.log('[AI-STREAM-ERROR] 调用 res.end() - AI聊天流式响应异常结束');
    res.end();
  }
});

// AI聊天API端点 - 传统非流式（保留兼容性）
app.post('/api/chat', async (req: Request<unknown, ChatResponse | ErrorResponse, ChatRequest>, res: Response<ChatResponse | ErrorResponse>): Promise<void> => {
  try {
    const { message, contextMessages = [] } = req.body;
    
    if (!message || typeof message !== 'string') {
      res.status(400).json({ 
        error: '消息内容不能为空',
        code: 'INVALID_MESSAGE'
      });
      return;
    }

    console.log(`[AI-REQUEST] 用户消息: ${message}`);
    console.log(`[AI-REQUEST] 上下文消息数量: ${contextMessages.length}`);

    // 构建包含上下文的提示词
    let fullPrompt: string = message;
    
    if (contextMessages && contextMessages.length > 0) {
      // 限制上下文消息数量
      const limitedContext: ChatMessage[] = contextMessages.slice(-config.CONTEXT_MESSAGE_COUNT);
      
      // 构建上下文
      const contextText: string = limitedContext.map((msg: ChatMessage): string => {
        const role: string = msg.role === 'user' ? '用户' : '助手';
        return `${role}: ${msg.content}`;
      }).join('\n');
      
      fullPrompt = `以下是之前的对话内容，请根据上下文回答用户的问题：\n\n${contextText}\n\n用户: ${message}`;
    }

    console.log(`[AI-REQUEST] 完整提示词长度: ${fullPrompt.length}`);

    // 转发请求到阿里云DashScope
    const dashScopeRequest: DashScopeRequest = {
      input: {
        prompt: fullPrompt
      },
      parameters: {},
      debug: {}
    };

    const response: AxiosResponse<DashScopeResponse> = await axios.post(
      config.DASHSCOPE_API_URL,
      dashScopeRequest,
      {
        headers: {
          'Authorization': `Bearer ${config.DASHSCOPE_API_KEY}`,
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

  } catch (error: unknown) {
    console.error('[AI-ERROR] API调用失败:', error instanceof Error ? error.message : '未知错误');
    
    if (axios.isAxiosError(error)) {
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
    } else {
      // 其他未知错误
      res.status(500).json({
        error: '服务器内部错误',
        code: 'INTERNAL_ERROR'
      });
    }
  }
});

// 静态文件服务 - 提供React构建文件
app.use(express.static(path.join(__dirname, 'build')));

// 前端路由处理 - 所有非API请求都返回index.html
app.get('*', (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// 错误处理中间件
app.use((err: Error, _req: Request, res: Response<ErrorResponse>, _next: NextFunction): void => {
  console.error('[SERVER-ERROR]', err);
  res.status(500).json({
    error: '服务器内部错误',
    code: 'INTERNAL_ERROR'
  });
});

// 启动服务器
app.listen(PORT, (): void => {
  console.log(`🚀 AI聊天应用已启动`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`🔗 API端点: http://localhost:${PORT}/api/chat`);
  console.log(`❤️  健康检查: http://localhost:${PORT}/api/health`);
});

export default app;
