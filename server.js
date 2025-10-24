const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// 从环境变量读取配置
const APP_NAME = process.env.APP_NAME || 'AI智能助手';
const APP_DESCRIPTION = process.env.APP_DESCRIPTION || '基于AI的智能对话';
const WELCOME_MESSAGE = process.env.WELCOME_MESSAGE || '';
const CONTEXT_MESSAGE_COUNT = parseInt(process.env.CONTEXT_MESSAGE_COUNT || '5', 10);
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || '60000', 10); // 默认60秒

// 统一AI配置（支持多AI服务）
const AI_PROVIDER = process.env.AI_PROVIDER || 'dashscope';
const AI_API_KEY = process.env.AI_API_KEY;
const AI_API_URL = process.env.AI_API_URL;

// OpenAI特有参数
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4';
const OPENAI_TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');

// 企业微信认证配置
const WEWORK_CORP_ID = process.env.WEWORK_CORP_ID || '';
const WEWORK_AGENT_ID = process.env.WEWORK_AGENT_ID || '';
const WEWORK_CORP_SECRET = process.env.WEWORK_CORP_SECRET || '';
const WEWORK_REDIRECT_URI = process.env.WEWORK_REDIRECT_URI || '';
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

// 认证开关和用户配置
const ENABLE_AUTH = process.env.ENABLE_AUTH === 'true';
const BASIC_AUTH_USERS = process.env.BASIC_AUTH_USERS || 'admin:admin123';

// 日志级别配置
const LOG_LEVEL = process.env.LOG_LEVEL || 'warn';
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LOG_LEVELS[LOG_LEVEL] || LOG_LEVELS.warn;

// 统一日志工具
const logger = {
  error: (...args) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(`[${new Date().toISOString()}]`, ...args);
    }
  },
  warn: (...args) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.log(`[${new Date().toISOString()}]`, ...args);
    }
  },
  info: (...args) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(`[${new Date().toISOString()}]`, ...args);
    }
  },
  debug: (...args) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log(`[${new Date().toISOString()}]`, ...args);
    }
  }
};

// 解析用户配置
const parseUsers = (usersString) => {
  const users = {};
  usersString.split(',').forEach(userStr => {
    const [username, password] = userStr.trim().split(':');
    if (username && password) {
      users[username] = password;
    }
  });
  return users;
};

const authUsers = parseUsers(BASIC_AUTH_USERS);

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  logger.debug('[HTTP]', req.method, req.path);
  next();
});

// 企业微信域名验证文件 - 优先处理
app.get('/WW_verify_XXXXXXXXXXXXXXX.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'WW_verify_XXXXXXXXXXXXXXX.txt'));
});

// 静态文件服务 - 用于企业微信域名验证
app.use(express.static(path.join(__dirname, 'public')));

// ==================== AI服务适配器 ====================

/**
 * AI服务适配器类
 * 支持多种AI服务提供商，统一接口
 */
class AIAdapter {
  constructor(provider, apiKey, apiUrl) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  /**
   * 构建请求体（根据不同provider适配格式）
   */
  buildRequestBody(messages, parameters = {}) {
    if (this.provider === 'openai') {
      // OpenAI格式（包括转发API）
      return {
        model: OPENAI_MODEL,
        messages: messages,
        temperature: OPENAI_TEMPERATURE,
        ...parameters
      };
    } else if (this.provider === 'dashscope') {
      // DashScope格式
      return {
        input: {
          messages: messages
        },
        parameters: parameters,
        debug: {}
      };
    }
    throw new Error(`Unsupported AI provider: ${this.provider}`);
  }

  /**
   * 获取请求配置（统一的请求头和超时）
   */
  getRequestConfig() {
    return {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: API_TIMEOUT
    };
  }

  /**
   * 获取流式请求配置（支持SSE）
   */
  getStreamRequestConfig() {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    if (this.provider === 'dashscope') {
      // 阿里云DashScope需要特殊SSE头部
      headers['X-DashScope-SSE'] = 'enable';
    }

    return {
      headers: headers,
      timeout: API_TIMEOUT,
      responseType: 'stream'
    };
  }

  /**
   * 构建流式请求体（根据不同provider适配格式）
   */
  buildStreamRequestBody(messages, parameters = {}) {
    if (this.provider === 'openai') {
      // OpenAI格式（包括转发API）
      return {
        model: OPENAI_MODEL,
        messages: messages,
        temperature: OPENAI_TEMPERATURE,
        stream: true,
        ...parameters
      };
    } else if (this.provider === 'dashscope') {
      // DashScope格式，启用增量输出
      return {
        input: {
          messages: messages
        },
        parameters: {
          incremental_output: true,
          ...parameters
        },
        debug: {}
      };
    }
    throw new Error(`Unsupported AI provider: ${this.provider}`);
  }

  /**
   * 解析响应（统一格式）
   */
  parseResponse(response) {
    if (this.provider === 'openai') {
      // OpenAI格式: response.choices[0].message.content
      if (response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
        return response.data.choices[0].message.content;
      }
    } else if (this.provider === 'dashscope') {
      // DashScope格式: response.output.text
      if (response.data.output && response.data.output.text) {
        return response.data.output.text;
      }
    }
    throw new Error('Invalid API response format');
  }

  /**
   * 获取API URL
   */
  getApiUrl() {
    return this.apiUrl;
  }

  /**
   * 获取provider名称
   */
  getProvider() {
    return this.provider;
  }
}

// 初始化AI适配器
let aiAdapter;
try {
  // 验证配置
  if (!AI_API_KEY || !AI_API_URL) {
    logger.error('[AI配置] 缺少必要的AI服务配置');
    logger.error('[AI配置] AI_API_KEY:', AI_API_KEY ? '已配置' : '未配置');
    logger.error('[AI配置] AI_API_URL:', AI_API_URL ? '已配置' : '未配置');
  } else {
    aiAdapter = new AIAdapter(AI_PROVIDER, AI_API_KEY, AI_API_URL);
    logger.info(`[AI配置] 使用AI服务: ${AI_PROVIDER}`);
    logger.info(`[AI配置] API地址: ${AI_API_URL}`);
    logger.info(`[AI配置] 模型: ${AI_PROVIDER === 'openai' ? OPENAI_MODEL : 'DashScope默认'}`);
  }
} catch (error) {
  logger.error('[AI配置] 初始化失败:', error.message);
}

// ==================== 企业微信API服务 ====================

/**
 * 获取企业微信access_token
 */
async function getWeworkAccessToken() {
  try {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${WEWORK_CORP_ID}&corpsecret=${WEWORK_CORP_SECRET}`;
    const response = await axios.get(url);
    
    if (response.data.errcode === 0) {
      logger.debug('[企业微信] access_token获取成功');
      return response.data.access_token;
    } else {
      logger.error('[企业微信] access_token获取失败, errcode:', response.data.errcode, 'errmsg:', response.data.errmsg);
      throw new Error(`获取access_token失败: ${response.data.errmsg}`);
    }
  } catch (error) {
    logger.error('[企业微信] access_token请求异常:', error.message);
    throw error;
  }
}

/**
 * 通过code获取用户UserId
 */
async function getUserIdByCode(code) {
  try {
    const accessToken = await getWeworkAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token=${accessToken}&code=${code}`;
    const response = await axios.get(url);
    
    if (response.data.errcode === 0) {
      const userId = response.data.userid || response.data.UserId;
      logger.info('[企业微信] 获取UserId成功:', userId);
      return userId;
    } else {
      logger.error('[企业微信] 获取UserId失败, code:', code, 'errcode:', response.data.errcode);
      throw new Error(`获取用户信息失败: ${response.data.errmsg}`);
    }
  } catch (error) {
    logger.error('[企业微信] 获取UserId异常:', error.message);
    throw error;
  }
}

/**
 * 通过UserId获取用户详细信息
 */
async function getUserInfo(userId) {
  try {
    const accessToken = await getWeworkAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=${accessToken}&userid=${userId}`;
    const response = await axios.get(url);
    
    if (response.data.errcode === 0) {
      logger.info('[企业微信] 获取用户信息成功, userId:', response.data.userid, 'name:', response.data.name);
      return {
        userId: response.data.userid,
        name: response.data.name,
        department: response.data.department,
        position: response.data.position,
        mobile: response.data.mobile,
        email: response.data.email
      };
    } else {
      logger.error('[企业微信] 获取用户信息失败, userId:', userId, 'errcode:', response.data.errcode);
      throw new Error(`获取用户详细信息失败: ${response.data.errmsg}`);
    }
  } catch (error) {
    logger.error('[企业微信] 获取用户信息异常:', error.message);
    throw error;
  }
}

// ==================== JWT认证中间件 ====================

/**
 * JWT验证中间件（支持认证开关）
 */
function authenticateToken(req, res, next) {
  // 如果认证开关关闭，直接跳过认证
  if (!ENABLE_AUTH) {
    logger.warn('[认证] 认证开关关闭，跳过检查');
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn('[认证] 请求缺少token, path:', req.path);
    return res.status(401).json({ 
      error: '未授权访问',
      code: 'NO_TOKEN'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      logger.error('[认证] token验证失败:', err.message);
      return res.status(403).json({ 
        error: 'token无效或已过期',
        code: 'INVALID_TOKEN'
      });
    }
    
    req.user = user;
    logger.warn('[认证] 用户通过验证, user:', user.name, 'type:', user.loginType);
    next();
  });
}

// API路由 - 必须在静态文件服务之前定义
// 健康检查端点（无需认证）
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AI Chat API'
  });
});

// ==================== 认证路由 ====================

/**
 * 发起企业微信OAuth授权
 */
app.get('/api/auth/wework/redirect', (req, res) => {
  try {
    logger.info('[认证] 发起企业微信授权');
    
    if (!WEWORK_CORP_ID || !WEWORK_AGENT_ID || !WEWORK_REDIRECT_URI) {
      return res.status(500).json({
        error: '企业微信配置不完整',
        code: 'WEWORK_CONFIG_INCOMPLETE'
      });
    }

    // 构建企业微信授权URL
    const redirectUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${WEWORK_CORP_ID}&redirect_uri=${encodeURIComponent(WEWORK_REDIRECT_URI)}&response_type=code&scope=snsapi_base&state=STATE#wechat_redirect`;
    
    logger.debug('[认证] 授权URL:', redirectUrl);
    
    res.json({
      redirectUrl: redirectUrl
    });
  } catch (error) {
    logger.error('[认证] 生成授权URL失败:', error.message);
    res.status(500).json({
      error: '生成授权URL失败',
      code: 'REDIRECT_ERROR'
    });
  }
});

/**
 * 用户名密码登录
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    logger.warn('[认证] 登录尝试, username:', username);
    
    if (!username || !password) {
      return res.status(400).json({
        error: '用户名和密码不能为空',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // 验证用户名和密码
    if (!authUsers[username] || authUsers[username] !== password) {
      logger.warn('[认证] 登录失败, username:', username, 'reason: 密码错误');
      return res.status(401).json({
        error: '用户名或密码错误',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // 生成JWT token
    const token = jwt.sign(
      {
        userId: username,
        name: username,
        loginType: 'password'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.warn('[认证] 登录成功, username:', username);

    res.json({
      success: true,
      token: token,
      user: {
        userId: username,
        name: username,
        loginType: 'password'
      }
    });
  } catch (error) {
    logger.error('[认证] 登录异常:', error.message);
    res.status(500).json({
      error: '登录失败，请重试',
      code: 'LOGIN_ERROR'
    });
  }
});

/**
 * 获取认证配置
 */
app.get('/api/auth/config', (req, res) => {
  try {
    logger.debug('[认证] 获取认证配置');
    
    res.json({
      authEnabled: ENABLE_AUTH,
      weworkEnabled: !!(WEWORK_CORP_ID && WEWORK_AGENT_ID && WEWORK_CORP_SECRET),
      availableUsers: Object.keys(authUsers)
    });
  } catch (error) {
    logger.error('[认证] 获取认证配置失败:', error.message);
    res.status(500).json({
      error: '获取认证配置失败',
      code: 'CONFIG_ERROR'
    });
  }
});

/**
 * 企业微信OAuth回调处理
 */
app.get('/api/auth/wework/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    logger.warn('[认证] 企业微信回调, code存在:', !!code);
    
    if (!code) {
      return res.status(400).json({
        error: '缺少授权code',
        code: 'NO_CODE'
      });
    }

    // 1. 通过code获取userId
    const userId = await getUserIdByCode(code);
    
    if (!userId) {
      return res.status(400).json({
        error: '获取用户ID失败',
        code: 'NO_USERID'
      });
    }

    // 2. 获取用户详细信息
    const userInfo = await getUserInfo(userId);
    
    // 3. 生成JWT token
    const token = jwt.sign(
      {
        userId: userInfo.userId,
        name: userInfo.name,
        loginType: 'wework'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.warn('[认证] 企业微信登录成功, user:', userInfo.name, 'userId:', userInfo.userId);

    res.json({
      success: true,
      token: token,
      user: {
        userId: userInfo.userId,
        name: userInfo.name,
        avatar: userInfo.avatar || '', // 企业微信头像URL
        loginType: 'wework'
      }
    });
  } catch (error) {
    logger.error('[认证] 企业微信回调失败:', error.message);
    res.status(500).json({
      error: '授权失败，请重试',
      code: 'AUTH_CALLBACK_ERROR',
      details: error.message
    });
  }
});

/**
 * 获取当前登录用户信息
 */
app.get('/api/auth/userinfo', authenticateToken, (req, res) => {
  try {
    logger.debug('[认证] 获取用户信息请求');
    res.json({
      success: true,
      user: {
        userId: req.user.userId,
        name: req.user.name,
        avatar: req.user.avatar || '',
        loginType: req.user.loginType || 'password' // 默认为password以保持向后兼容
      }
    });
  } catch (error) {
    logger.error('[认证] 获取用户信息失败:', error.message);
    res.status(500).json({
      error: '获取用户信息失败',
      code: 'USERINFO_ERROR'
    });
  }
});

/**
 * 退出登录
 */
app.post('/api/auth/logout', (req, res) => {
  try {
    logger.info('[认证] 用户退出, user:', req.user?.name);
    res.json({
      success: true,
      message: '退出成功'
    });
  } catch (error) {
    logger.error('[认证] 退出失败:', error.message);
    res.status(500).json({
      error: '退出登录失败',
      code: 'LOGOUT_ERROR'
    });
  }
});

// ==================== 业务API ====================

// 应用配置端点（公开访问，无需认证）
app.get('/api/config', (req, res) => {
  // 解析示例问题（分号分隔）
  const exampleQuestions = process.env.EXAMPLE_QUESTIONS 
    ? process.env.EXAMPLE_QUESTIONS.split(';').map(q => q.trim()).filter(q => q)
    : [];
  
  res.json({
    name: APP_NAME,
    description: APP_DESCRIPTION,
    welcomeMessage: WELCOME_MESSAGE,
    enableI18nButton: process.env.ENABLE_I18N_BUTTON === 'true',
    enableDebugMode: process.env.ENABLE_DEBUG_MODE === 'true',
    exampleQuestions: exampleQuestions
  });
});

// AI聊天API端点 - 流式传输版本（需要认证）
app.post('/api/chat', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { message, contextMessages = [], stream = false } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        error: '消息内容不能为空',
        code: 'INVALID_MESSAGE'
      });
    }

    // warn级别：关键业务摘要
    logger.warn('[AI] 请求开始', {
      user: req.user?.name || 'anonymous',
      messageLen: message.length,
      contextCount: contextMessages.length,
      stream: stream
    });

    // info级别：详细内容
    logger.info('[AI] 用户消息:', message.slice(0, 100) + (message.length > 100 ? '...' : ''));
    logger.info('[AI] 上下文消息:', contextMessages.length, '条');
    logger.info('[AI] 流式传输:', stream);

    // 构建messages数组格式的对话数据
    // 1) 渲染系统提示词（从环境变量读取并用企业微信登录人姓名替换 {{name}}）
    const rawSystemPrompt = process.env.SYSTEM_PROMPT || '';
    const currentUserName = (req.user && (req.user.name || req.user.userId)) || '当前用户';
    const renderedSystemPrompt = rawSystemPrompt.replace(/\{\{name\}\}/g, currentUserName);

    // 2) 构建messages数组
    const messages = [];
    
    // 添加系统消息（如果存在）
    if (renderedSystemPrompt) {
      messages.push({
        role: 'system',
        content: renderedSystemPrompt
      });
    }
    
    // 添加上下文消息
    if (contextMessages && contextMessages.length > 0) {
      // 限制上下文消息数量
      const limitedContext = contextMessages.slice(-CONTEXT_MESSAGE_COUNT);
      
      // 将上下文消息转换为标准格式
      limitedContext.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }
    
    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: message
    });

    // info级别：消息数组信息
    logger.info('[AI] 消息数组长度:', messages.length, '条');
    logger.info('[AI] 消息总字符数:', messages.reduce((sum, msg) => sum + msg.content.length, 0), '字符');
    
    if (renderedSystemPrompt) {
      logger.info('[AI] 系统消息:', renderedSystemPrompt.slice(0, 150) + '...');
    }
    
    // debug级别：完整消息数组
    logger.debug('[AI] 完整消息数组:', JSON.stringify(messages, null, 2));

    // 检查AI适配器是否可用
    if (!aiAdapter) {
      logger.error('[AI] AI适配器未初始化');
      return res.status(500).json({
        error: 'AI服务配置错误，请联系管理员',
        code: 'AI_CONFIG_ERROR'
      });
    }

    if (stream) {
      // 流式传输模式 - 真正的SSE流处理
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      try {
        // 使用适配器构建流式请求
        const requestBody = aiAdapter.buildStreamRequestBody(messages, {});
        const requestConfig = aiAdapter.getStreamRequestConfig();
        
        logger.debug('[AI-流式] 请求体:', JSON.stringify(requestBody, null, 2));
        logger.debug('[AI-流式] 请求配置:', JSON.stringify(requestConfig, null, 2));

        const response = await axios.post(
          aiAdapter.getApiUrl(),
          requestBody,
          requestConfig
        );

        // 实时处理SSE流 - 完整的消息切分和格式转换
        let buffer = '';
        let accumulatedText = '';
        let chunkCount = 0;
        let isFirstMessage = true;

        response.data.on('data', (chunk) => {
          buffer += chunk.toString();
          
          // 按双换行符分割完整的SSE消息
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || ''; // 保留不完整的消息
          
          for (const message of messages) {
            if (message.trim() === '') continue;
            
            // 解析SSE消息的各个字段
            const lines = message.split('\n');
            const sseMessage = {};
            
            for (const line of lines) {
              if (line.startsWith('id:')) {
                sseMessage.id = line.slice(3).trim();
              } else if (line.startsWith('event:')) {
                sseMessage.event = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                sseMessage.data = line.slice(5).trim();
              }
            }
            
            // 只处理包含data字段的消息
            if (!sseMessage.data) continue;
            
            chunkCount++;
            
            // Debug日志：打印原始SSE消息
            logger.debug(`[AI-流式-原始] 消息 #${chunkCount}`, {
              id: sseMessage.id,
              event: sseMessage.event,
              dataPreview: sseMessage.data.slice(0, 150)
            });
            
            // 转换阿里云格式到OpenAI标准格式
            try {
              if (aiAdapter.getProvider() === 'dashscope') {
                // 解析阿里云JSON
                const parsed = JSON.parse(sseMessage.data);
                const incrementalText = parsed.output?.text || '';
                const finishReason = parsed.output?.finish_reason;
                
                // Debug日志：打印解析结果
                logger.debug(`[AI-流式-解析] 消息 #${sseMessage.id}`, {
                  incrementalText: incrementalText,
                  textLength: incrementalText.length,
                  finishReason: finishReason,
                  accumulatedLength: accumulatedText.length
                });
                
                // 第一个消息无论是否有内容都发送
                if (isFirstMessage || incrementalText) {
                  accumulatedText += incrementalText;
                  
                  // 转换为OpenAI标准格式 - 发送累积文本
                  const standardChunk = {
                    content: accumulatedText, // 发送累积文本
                    done: finishReason === 'stop',
                    timestamp: new Date().toISOString()
                  };
                  
                  const sseData = `data: ${JSON.stringify(standardChunk)}\n\n`;
                  res.write(sseData);
                  
                  // Debug日志：打印发送给前端的实际SSE数据
                  logger.debug(`[AI-流式-发送] 消息 #${sseMessage.id}`, {
                    contentLength: accumulatedText.length,
                    contentPreview: accumulatedText.slice(0, 100),
                    done: standardChunk.done,
                    sseData: sseData.trim()
                  });
                  
                  // 强制输出到控制台（用于调试）
                  console.log(`[SSE发送] #${sseMessage.id}: ${sseData.trim()}`);
                  
                  isFirstMessage = false;
                } else {
                  logger.debug(`[AI-流式-跳过] 空内容消息 #${sseMessage.id}`);
                }
                
                // 处理完成信号
                if (finishReason === 'stop') {
                  logger.info('[AI-流式] 流式传输完成', {
                    totalMessages: chunkCount,
                    totalLength: accumulatedText.length
                  });
                  res.write('data: [DONE]\n\n');
                  res.end();
                  return;
                }
              } else {
                // OpenAI格式直接透传
                res.write(`data: ${sseMessage.data}\n\n`);
                logger.debug(`[AI-流式-透传] 消息 #${sseMessage.id}`);
              }
            } catch (parseError) {
              logger.error('[AI-流式] 消息解析错误:', parseError);
              logger.error('[AI-流式] 原始数据:', sseMessage.data);
              
              // 发送错误信息给前端
              res.write(`data: ${JSON.stringify({
                error: '数据解析错误',
                code: 'PARSE_ERROR',
                details: parseError.message
              })}\n\n`);
            }
          }
        });

        response.data.on('end', () => {
          if (!res.writableEnded) {
            logger.info('[AI-流式] 流结束');
            res.write('data: [DONE]\n\n');
            res.end();
          }
        });

        response.data.on('error', (error) => {
          logger.error('[AI-流式] 流错误:', error);
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({
              error: '流式传输错误',
              code: 'STREAM_ERROR',
              details: error.message
            })}\n\n`);
            res.end();
          }
        });

      } catch (error) {
        logger.error('[AI-流式] 请求失败:', error);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            error: 'AI服务调用失败',
            code: 'API_ERROR',
            details: error.message
          })}\n\n`);
          res.end();
        }
      }
    } else {
      // 非流式传输模式
      const requestBody = aiAdapter.buildRequestBody(messages, {});
      const requestConfig = aiAdapter.getRequestConfig();
      
      logger.debug('[AI] 非流式请求体:', JSON.stringify(requestBody, null, 2));

      const response = await axios.post(
        aiAdapter.getApiUrl(),
        requestBody,
        requestConfig
      );

      // info级别：响应状态
      logger.info(`[AI] ${aiAdapter.getProvider()}响应状态:`, response.status);

      if (response.data) {
        // 使用适配器解析响应
        const responseText = aiAdapter.parseResponse(response);
        
        // warn级别：完成摘要
        const duration = Date.now() - startTime;
        logger.warn('[AI] 请求完成', {
          user: req.user?.name || 'anonymous',
          provider: aiAdapter.getProvider(),
          duration: duration + 'ms',
          responseLen: responseText.length
        });
        
        res.json({
          success: true,
          message: responseText,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.error('[AI] 响应格式异常:', response.data);
        res.status(500).json({
          error: 'AI服务响应格式异常',
          code: 'INVALID_RESPONSE'
        });
      }
    }

  } catch (error) {
    // error级别：请求失败
    logger.error('[AI] 请求失败', {
      user: req.user?.name,
      provider: aiAdapter?.getProvider() || 'unknown',
      error: error.message,
      code: error.code,
      status: error.response?.status
    });
    
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
        logger.error('[AI] API错误响应:', error.response.status, error.response.data);
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
  logger.error('[服务器] 未捕获错误:', err.message);
  logger.debug('[服务器] 错误堆栈:', err.stack);
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
  console.log(`📊 日志级别: ${LOG_LEVEL}`);
});

module.exports = app;