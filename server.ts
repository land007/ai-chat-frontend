import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import axios, { AxiosResponse } from 'axios';
import path from 'path';

const app = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// 环境变量配置接口
interface EnvironmentConfig {
  DASHSCOPE_API_KEY: string;
  DASHSCOPE_API_URL: string;
  APP_NAME: string;
  APP_DESCRIPTION: string;
  WELCOME_MESSAGE: string;
  CONTEXT_MESSAGE_COUNT: number;
}

// 从环境变量读取配置
const config: EnvironmentConfig = {
  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || 'your_api_key_here',
  DASHSCOPE_API_URL: process.env.DASHSCOPE_API_URL || 'https://dashscope.aliyuncs.com/api/v1/apps/your_app_id/completion',
  APP_NAME: process.env.APP_NAME || 'AI智能助手',
  APP_DESCRIPTION: process.env.APP_DESCRIPTION || '基于阿里云DashScope的智能对话',
  WELCOME_MESSAGE: process.env.WELCOME_MESSAGE || '',
  CONTEXT_MESSAGE_COUNT: parseInt(process.env.CONTEXT_MESSAGE_COUNT || '5', 10)
};

// API 请求/响应接口
interface ChatRequest {
  message: string;
  contextMessages?: ChatMessage[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface DashScopeRequest {
  input: {
    prompt: string;
  };
  parameters: Record<string, unknown>;
  debug: Record<string, unknown>;
}

interface DashScopeResponse {
  output: {
    text: string;
  };
}

interface ChatResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

interface ConfigResponse {
  name: string;
  description: string;
  welcomeMessage: string;
  tts: {
    enabled: boolean;
    apiUrl: string;
  };
}

interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
}

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志中间件
app.use((req: Request, res: Response, next: NextFunction): void => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API路由 - 必须在静态文件服务之前定义
// 健康检查端点
app.get('/api/health', (req: Request, res: Response<HealthResponse>): void => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AI Chat API'
  });
});

// 应用配置端点
app.get('/api/config', (req: Request, res: Response<ConfigResponse>): void => {
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

// AI聊天API端点
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
app.get('*', (req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// 错误处理中间件
app.use((err: Error, req: Request, res: Response<ErrorResponse>, next: NextFunction): void => {
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
