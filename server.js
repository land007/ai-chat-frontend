const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { promisify } = require('util');

// 文件系统Promise化
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

const app = express();
const PORT = process.env.PORT || 3000;

// 从环境变量读取配置
const APP_NAME = process.env.APP_NAME || 'AI智能助手';
const APP_DESCRIPTION = process.env.APP_DESCRIPTION || '基于AI的智能对话';
const WELCOME_MESSAGE = process.env.WELCOME_MESSAGE || '';
const CONTEXT_MESSAGE_COUNT = parseInt(process.env.CONTEXT_MESSAGE_COUNT || '5', 10);

// FAST建议（Qwen代理）配置（以 fast 前缀）
const FAST_SUGGEST_ENABLED = (process.env.FAST_SUGGEST_ENABLED || 'true') === 'true';
const FAST_SUGGEST_COUNT = parseInt(process.env.FAST_SUGGEST_COUNT || '3', 10);
const FAST_SUGGEST_API_BASEURL = process.env.FAST_SUGGEST_API_BASEURL || '';
const FAST_SUGGEST_API_KEY = process.env.FAST_SUGGEST_API_KEY || '';
const FAST_SUGGEST_MODEL = process.env.FAST_SUGGEST_MODEL || 'qwen-turbo';
const FAST_SUGGEST_TIMEOUT = parseInt(process.env.FAST_SUGGEST_TIMEOUT || '8000', 10);
// fast 建议提示词模板（支持 \n 转义为换行；支持占位符：{{N}}、{{USER_QUESTION}}、{{ANSWER}}）
const FAST_SUGGEST_SYSTEM_PROMPT = (
  process.env.FAST_SUGGEST_SYSTEM_PROMPT ||
  '你是对话助手。基于用户问题与当前回答，生成N个下一步追问，要求简短具体、无客套、中文、仅返回JSON数组。不要输出任何额外解释。'
).replace(/\\n/g, '\n');
const FAST_SUGGEST_USER_PROMPT_TEMPLATE = (
  process.env.FAST_SUGGEST_USER_PROMPT_TEMPLATE ||
  'N={{N}}\\n用户问题: {{USER_QUESTION}}\\n回答: {{ANSWER}}\\n请仅输出JSON数组，如 ["问题1","问题2","问题3"]。'
).replace(/\\n/g, '\n');

// API超时配置
const NON_STREAM_API_TIMEOUT = parseInt(process.env.NON_STREAM_API_TIMEOUT || '60000', 10); // 默认60秒（非流式请求超时）
const STREAM_INITIAL_TIMEOUT = parseInt(process.env.STREAM_INITIAL_TIMEOUT || '30000', 10); // 默认30秒（流式初始连接超时）
const STREAM_DATA_TIMEOUT = parseInt(process.env.STREAM_DATA_TIMEOUT || '60000', 10); // 默认60秒（流式数据接收超时）

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

// 反馈系统配置
const FEEDBACK_DIR = process.env.FEEDBACK_DIR || './feedbacks';
const FEEDBACK_PAGE_SIZE = parseInt(process.env.FEEDBACK_PAGE_SIZE || '20', 10);
const ADMIN_USERS = (process.env.ADMIN_USERS || 'admin').split(',').map(u => u.trim());

// 历史记录配置
const CHAT_HISTORY_DIR = process.env.CHAT_HISTORY_DIR || './chat-history';
const CHAT_HISTORY_PAGE_SIZE = parseInt(process.env.CHAT_HISTORY_PAGE_SIZE || '20', 10);
const CHAT_HISTORY_AUTO_SAVE = process.env.CHAT_HISTORY_AUTO_SAVE !== 'false';

// 语音识别配置
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || process.env.AI_API_KEY || '';
const VOICE_INPUT_VAD_MODE = process.env.VOICE_INPUT_VAD_MODE !== 'false'; // 默认true（VAD模式）
const VOICE_INPUT_SILENCE_DURATION_MS = parseInt(process.env.VOICE_INPUT_SILENCE_DURATION_MS || '800', 10);
const VOICE_INPUT_THRESHOLD = parseFloat(process.env.VOICE_INPUT_THRESHOLD || '0.2');
const VOICE_INPUT_MODEL = process.env.VOICE_INPUT_MODEL || 'qwen3-asr-flash-realtime';
const VOICE_INPUT_BASE_URL = process.env.VOICE_INPUT_BASE_URL || 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime';
const VOICE_INPUT_LANGUAGE = process.env.VOICE_INPUT_LANGUAGE || 'zh'; // 默认中文

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
  const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  logger.warn('[HTTP]', req.method, fullUrl, {
    path: req.path,
    query: req.query,
    originalUrl: req.originalUrl,
    url: req.url
  });
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
   * 检测是否为Dify API
   * 优先使用provider配置，URL检测作为备用
   */
  isDifyApi() {
    // 优先使用显式配置
    if (this.provider === 'dify') {
      return true;
    }
    // 备用：通过URL检测
    return this.apiUrl && this.apiUrl.includes('/v1/chat-messages');
  }

  /**
   * 从messages中提取用户消息内容
   */
  extractUserQuery(messages) {
    // 找到最后一条用户消息
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i].content;
      }
    }
    return '';
  }

  /**
   * 构建请求体（根据不同provider适配格式）
   */
  buildRequestBody(messages, parameters = {}) {
    // 显式检查provider配置，优先使用
    if (this.provider === 'dify') {
      // Dify格式
      const query = this.extractUserQuery(messages);
      const requestBody = {
        inputs: parameters.inputs || {},
        query: query,
        response_mode: 'blocking',
        // Dify要求user字段必须提供，使用默认值
        user: parameters.user || 'default-user'
      };
      
      // 只有当conversation_id不为空时才添加
      if (parameters.conversation_id) {
        requestBody.conversation_id = parameters.conversation_id;
      }
      
      // 只有当files不为空时才添加
      if (parameters.files && Array.isArray(parameters.files) && parameters.files.length > 0) {
        requestBody.files = parameters.files;
      }
      
      return requestBody;
    } else if (this.provider === 'openai') {
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
    } else if (this.isDifyApi()) {
      // 备用：通过URL自动检测Dify API
      const query = this.extractUserQuery(messages);
      const requestBody = {
        inputs: parameters.inputs || {},
        query: query,
        response_mode: 'blocking',
        // Dify要求user字段必须提供，使用默认值
        user: parameters.user || 'default-user'
      };
      
      // 只有当conversation_id不为空时才添加
      if (parameters.conversation_id) {
        requestBody.conversation_id = parameters.conversation_id;
      }
      
      // 只有当files不为空时才添加
      if (parameters.files && Array.isArray(parameters.files) && parameters.files.length > 0) {
        requestBody.files = parameters.files;
      }
      
      return requestBody;
    }
    throw new Error(`Unsupported AI provider: ${this.provider}`);
  }

  /**
   * 获取请求配置（统一的请求头和超时）
   * 用于非流式请求
   */
  getRequestConfig() {
    return {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: NON_STREAM_API_TIMEOUT
    };
  }

  /**
   * 获取流式请求配置（支持SSE）
   * 使用初始连接超时，用于检测能否建立连接并收到第一个数据块
   */
  getStreamRequestConfig() {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    };

    if (this.provider === 'dashscope') {
      // 阿里云DashScope需要特殊SSE头部
      headers['X-DashScope-SSE'] = 'enable';
    }

    return {
      headers: headers,
      timeout: STREAM_INITIAL_TIMEOUT, // 初始连接超时，用于检测连接是否建立
      responseType: 'stream'
    };
  }

  /**
   * 构建流式请求体（根据不同provider适配格式）
   */
  buildStreamRequestBody(messages, parameters = {}) {
    // 显式检查provider配置，优先使用
    if (this.provider === 'dify') {
      // Dify格式
      const query = this.extractUserQuery(messages);
      const requestBody = {
        inputs: parameters.inputs || {},
        query: query,
        response_mode: 'streaming',
        // Dify要求user字段必须提供，使用默认值
        user: parameters.user || 'default-user'
      };
      
      // 只有当conversation_id不为空时才添加
      if (parameters.conversation_id) {
        requestBody.conversation_id = parameters.conversation_id;
      }
      
      // 只有当files不为空时才添加
      if (parameters.files && Array.isArray(parameters.files) && parameters.files.length > 0) {
        requestBody.files = parameters.files;
      }
      
      return requestBody;
    } else if (this.provider === 'openai') {
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
    } else if (this.isDifyApi()) {
      // 备用：通过URL自动检测Dify API
      const query = this.extractUserQuery(messages);
      const requestBody = {
        inputs: parameters.inputs || {},
        query: query,
        response_mode: 'streaming',
        // Dify要求user字段必须提供，使用默认值
        user: parameters.user || 'default-user'
      };
      
      // 只有当conversation_id不为空时才添加
      if (parameters.conversation_id) {
        requestBody.conversation_id = parameters.conversation_id;
      }
      
      // 只有当files不为空时才添加
      if (parameters.files && Array.isArray(parameters.files) && parameters.files.length > 0) {
        requestBody.files = parameters.files;
      }
      
      return requestBody;
    }
    throw new Error(`Unsupported AI provider: ${this.provider}`);
  }

  /**
   * 解析响应（统一格式）
   */
  parseResponse(response) {
    // 显式检查provider配置，优先使用
    if (this.provider === 'dify') {
      // Dify格式: response.answer
      if (response.data && response.data.answer) {
        return response.data.answer;
      }
    } else if (this.provider === 'openai') {
      // OpenAI格式: response.choices[0].message.content
      if (response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
        return response.data.choices[0].message.content;
      }
    } else if (this.provider === 'dashscope') {
      // DashScope格式: response.output.text
      if (response.data.output && response.data.output.text) {
        return response.data.output.text;
      }
    } else if (this.isDifyApi()) {
      // 备用：通过URL自动检测Dify API
      if (response.data && response.data.answer) {
        return response.data.answer;
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

// ==================== 语音识别服务 ====================

/**
 * 语音识别服务抽象基类
 * 定义统一的接口，支持多种语音识别服务提供商
 */
class SpeechRecognitionService {
  constructor() {
    this.onTranscriptCallbacks = [];
    this.onErrorCallbacks = [];
    this.onCompleteCallbacks = [];
  }

  /**
   * 开始识别会话
   * @param {Object} config - 配置对象
   * @param {string} config.mode - 模式：'vad' 或 'manual'
   * @param {string} config.language - 语言代码，如 'zh'
   */
  async start(config) {
    throw new Error('start() method must be implemented by subclass');
  }

  /**
   * 发送音频数据
   * @param {Buffer} audioData - PCM音频数据
   */
  async sendAudio(audioData) {
    throw new Error('sendAudio() method must be implemented by subclass');
  }

  /**
   * 提交音频（Manual模式）
   */
  async commit() {
    throw new Error('commit() method must be implemented by subclass');
  }

  /**
   * 关闭连接
   */
  async close() {
    throw new Error('close() method must be implemented by subclass');
  }

  /**
   * 注册识别结果回调
   * @param {Function} callback - 回调函数 (text: string, isFinal: boolean) => void
   */
  onTranscript(callback) {
    this.onTranscriptCallbacks.push(callback);
  }

  /**
   * 注册错误回调
   * @param {Function} callback - 回调函数 (error: string) => void
   */
  onError(callback) {
    this.onErrorCallbacks.push(callback);
  }

  /**
   * 注册完成回调
   * @param {Function} callback - 回调函数 () => void
   */
  onComplete(callback) {
    this.onCompleteCallbacks.push(callback);
  }

  /**
   * 触发识别结果事件
   */
  _emitTranscript(text, isFinal) {
    this.onTranscriptCallbacks.forEach(cb => cb(text, isFinal));
  }

  /**
   * 触发错误事件
   */
  _emitError(error) {
    this.onErrorCallbacks.forEach(cb => cb(error));
  }

  /**
   * 触发完成事件
   */
  _emitComplete() {
    this.onCompleteCallbacks.forEach(cb => cb());
  }
}

/**
 * 阿里语音识别适配器
 * 实现阿里云DashScope Qwen-ASR Realtime WebSocket API
 */
class AliSpeechRecognitionAdapter extends SpeechRecognitionService {
  constructor(apiKey, baseUrl, model) {
    super();
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
    this.ws = null;
    this.isRunning = false;
    this.eventIdCounter = 0;
  }

  /**
   * 生成唯一事件ID
   */
  _generateEventId() {
    return `event_${Date.now()}_${++this.eventIdCounter}`;
  }

  /**
   * 开始识别会话
   */
  async start(config) {
    if (this.ws && this.ws.readyState === 1) { // WebSocket.OPEN
      logger.warn('[语音识别] WebSocket已连接，先关闭旧连接');
      await this.close();
    }

    const url = `${this.baseUrl}?model=${this.model}`;
    const WebSocket = require('ws');
    
    return new Promise((resolve, reject) => {
      try {
        logger.info('[语音识别] 连接到阿里语音识别服务:', url);
        
        this.ws = new WebSocket(url, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        });

        this.ws.on('open', () => {
          logger.info('[语音识别] WebSocket连接已建立');
          this.isRunning = true;
          this._sendSessionUpdate(config);
          resolve();
        });

        this.ws.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());
            this._handleMessage(data);
          } catch (error) {
            logger.error('[语音识别] 解析消息失败:', error.message);
          }
        });

        this.ws.on('close', (code, reason) => {
          logger.info('[语音识别] WebSocket连接已关闭:', code, reason.toString());
          this.isRunning = false;
          this.ws = null;
        });

        this.ws.on('error', (error) => {
          logger.error('[语音识别] WebSocket错误:', error.message);
          this.isRunning = false;
          this._emitError(error.message);
          reject(error);
        });

        // 连接超时
        setTimeout(() => {
          if (!this.isRunning) {
            reject(new Error('连接超时'));
          }
        }, 10000);
      } catch (error) {
        logger.error('[语音识别] 创建WebSocket连接失败:', error.message);
        reject(error);
      }
    });
  }

  /**
   * 发送会话更新事件
   */
  _sendSessionUpdate(config) {
    const eventId = this._generateEventId();
    const mode = config.mode || 'vad';
    const language = config.language || 'zh';

    const sessionConfig = {
      event_id: eventId,
      type: 'session.update',
      session: {
        modalities: ['text'],
        input_audio_format: 'pcm',
        sample_rate: 16000,
        input_audio_transcription: {
          language: language
        }
      }
    };

    if (mode === 'vad') {
      // VAD模式：启用服务器端语音活动检测
      sessionConfig.session.turn_detection = {
        type: 'server_vad',
        threshold: VOICE_INPUT_THRESHOLD,
        silence_duration_ms: VOICE_INPUT_SILENCE_DURATION_MS
      };
      logger.info('[语音识别] 使用VAD模式，阈值:', VOICE_INPUT_THRESHOLD, '静音时长:', VOICE_INPUT_SILENCE_DURATION_MS);
    } else {
      // Manual模式：关闭VAD，需要手动提交
      sessionConfig.session.turn_detection = null;
      logger.info('[语音识别] 使用Manual模式');
    }

    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(sessionConfig));
      logger.debug('[语音识别] 发送session.update:', JSON.stringify(sessionConfig, null, 2));
    }
  }

  /**
   * 发送音频数据
   */
  async sendAudio(audioData) {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new Error('WebSocket未连接');
    }

    if (!this.isRunning) {
      return;
    }

    const eventId = this._generateEventId();
    const encoded = audioData.toString('base64');
    
    const appendEvent = {
      event_id: eventId,
      type: 'input_audio_buffer.append',
      audio: encoded
    };

    this.ws.send(JSON.stringify(appendEvent));
    logger.debug('[语音识别] 发送音频块:', eventId);
  }

  /**
   * 提交音频（Manual模式）
   */
  async commit() {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new Error('WebSocket未连接');
    }

    const eventId = this._generateEventId();
    const commitEvent = {
      event_id: eventId,
      type: 'input_audio_buffer.commit'
    };

    this.ws.send(JSON.stringify(commitEvent));
    logger.info('[语音识别] 发送commit事件');
  }

  /**
   * 关闭连接
   */
  async close() {
    this.isRunning = false;
    
    if (this.ws) {
      if (this.ws.readyState === 1) {
        this.ws.close(1000, 'ASR completed');
      }
      this.ws = null;
    }
  }

  /**
   * 处理接收到的消息
   */
  _handleMessage(data) {
    logger.debug('[语音识别] 收到事件:', JSON.stringify(data, null, 2));

    // 处理识别结果事件
    if (data.type === 'conversation.item.input_audio_transcription.completed') {
      const transcript = data.transcript || '';
      logger.info('[语音识别] 最终识别结果:', transcript);
      this._emitTranscript(transcript, true);
      this._emitComplete();
      this.isRunning = false;
      // 自动关闭连接
      if (this.ws && this.ws.readyState === 1) {
        this.ws.close(1000, 'ASR completed');
      }
    } else if (data.type === 'conversation.item.input_audio_transcription.delta') {
      // 增量识别结果（实时转录）
      const transcript = data.delta || '';
      if (transcript) {
        logger.debug('[语音识别] 增量识别结果:', transcript);
        this._emitTranscript(transcript, false);
      }
    } else if (data.type === 'error') {
      // 错误事件
      const errorMessage = data.error?.message || data.error?.code || '未知错误';
      logger.error('[语音识别] 错误事件:', errorMessage);
      this._emitError(errorMessage);
    } else if (data.type === 'session.updated') {
      // 会话更新确认
      logger.info('[语音识别] 会话已更新');
    }
  }
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

/**
 * 可选认证中间件（尝试获取用户信息，但不强制要求）
 */
function optionalAuth(req, res, next) {
  // 如果认证开关关闭，直接跳过
  if (!ENABLE_AUTH) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // 没有token，继续但不设置用户信息
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err) {
      req.user = user;
    }
    // 无论验证成功与否都继续
    next();
  });
}

/**
 * 管理员权限中间件
 */
function requireAdmin(req, res, next) {
  // 如果认证开关关闭，允许访问
  if (!ENABLE_AUTH) {
    return next();
  }

  const userId = req.user?.userId;
  if (!userId || !ADMIN_USERS.includes(userId)) {
    logger.warn('[管理员] 权限不足, userId:', userId);
    return res.status(403).json({ 
      error: '需要管理员权限',
      code: 'ADMIN_REQUIRED'
    });
  }
  
  logger.info('[管理员] 权限验证通过, userId:', userId);
  next();
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

// ==================== PDF 代理接口 ====================

/**
 * PDF 文件代理接口（绕过 CORS）
 * GET /api/pdf/proxy?url=https://example.com/file.pdf
 */
app.get('/api/pdf/proxy', optionalAuth, async (req, res) => {
  try {
    const pdfUrl = decodeURIComponent(req.query.url || '');
    
    logger.info('[PDF代理] 请求PDF文件:', pdfUrl);
    
    if (!pdfUrl || (!pdfUrl.startsWith('http://') && !pdfUrl.startsWith('https://'))) {
      logger.warn('[PDF代理] URL格式无效:', pdfUrl);
      return res.status(400).json({
        error: 'URL格式无效，必须是有效的HTTP或HTTPS链接',
        code: 'INVALID_URL'
      });
    }

    // 使用 axios 获取 PDF 文件
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30秒超时
      headers: {
        'Accept': 'application/pdf,*/*',
        'User-Agent': 'Mozilla/5.0 (compatible; PDF-Proxy/1.0)'
      },
      maxContentLength: 50 * 1024 * 1024, // 最大50MB
    });

    logger.info('[PDF代理] PDF加载成功, size:', response.data.length, 'bytes');

    // 设置响应头
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', response.data.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 缓存1小时

    // 返回 PDF 文件
    res.send(Buffer.from(response.data));
    
  } catch (error) {
    logger.error('[PDF代理] 加载失败:', error.message);
    
    if (error.response) {
      // HTTP 错误响应
      res.status(error.response.status || 500).json({
        error: `PDF加载失败: ${error.response.status} ${error.response.statusText}`,
        code: 'PDF_LOAD_ERROR',
        status: error.response.status
      });
    } else if (error.request) {
      // 请求发送但无响应
      res.status(504).json({
        error: 'PDF服务器无响应',
        code: 'PDF_TIMEOUT'
      });
    } else {
      // 其他错误
      res.status(500).json({
        error: `PDF加载失败: ${error.message}`,
        code: 'PDF_ERROR'
      });
    }
  }
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
    exampleQuestions: exampleQuestions,
    // fast 建议配置下发到前端（不开启任何敏感信息）
    enableFastSuggest: FAST_SUGGEST_ENABLED,
    fastSuggestDefaultCount: FAST_SUGGEST_COUNT,
    // 管理员用户列表（用于前端判断是否显示管理入口）
    adminUsers: ADMIN_USERS,
    // 输入框配置
    textareaMinRows: parseInt(process.env.TEXTAREA_MIN_ROWS || '2', 10),
    textareaMaxRows: parseInt(process.env.TEXTAREA_MAX_ROWS || '5', 10),
    // 语音输入功能配置
    enableVoiceInput: process.env.ENABLE_VOICE_INPUT !== 'false',
    voiceInputLanguage: VOICE_INPUT_LANGUAGE,
    voiceInputVadMode: VOICE_INPUT_VAD_MODE
  });
});

// 快速建议：基于当前回答与用户问题，生成N个下一步问题（OpenAI兼容协议）
app.post('/api/fast/suggest', authenticateToken, async (req, res) => {
  try {
    if (!FAST_SUGGEST_ENABLED) {
      return res.status(200).json({ suggestions: [] });
    }
    if (!FAST_SUGGEST_API_BASEURL || !FAST_SUGGEST_API_KEY) {
      logger.error('[FAST_SUGGEST] 缺少API配置');
      return res.status(500).json({ error: '建议功能未正确配置', code: 'FAST_SUGGEST_CONFIG_MISSING' });
    }

    const { answer, userQuestion = '', count } = req.body || {};
    const n = Math.max(1, Math.min(10, parseInt(count || FAST_SUGGEST_COUNT, 10)));
    if (!answer || typeof answer !== 'string') {
      return res.status(400).json({ error: 'answer不能为空', code: 'INVALID_ANSWER' });
    }

    const systemPrompt = FAST_SUGGEST_SYSTEM_PROMPT;
    const userPrompt = FAST_SUGGEST_USER_PROMPT_TEMPLATE
      .replace(/\{\{N\}\}/g, String(n))
      .replace(/\{\{USER_QUESTION\}\}/g, userQuestion || '（无）')
      .replace(/\{\{ANSWER\}\}/g, answer);

    logger.info('[FAST_SUGGEST] 请求', { user: req.user?.name || 'anonymous', n });

    const response = await axios.post(
      `${FAST_SUGGEST_API_BASEURL.replace(/\/$/, '')}/chat/completions`,
      {
        model: FAST_SUGGEST_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        n: 1
      },
      {
        headers: {
          Authorization: `Bearer ${FAST_SUGGEST_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: FAST_SUGGEST_TIMEOUT
      }
    );

    let text = '';
    try {
      text = response.data?.choices?.[0]?.message?.content || '';
    } catch (_) {
      text = '';
    }

    // 解析仅JSON数组
    let suggestions = [];
    try {
      // 提取第一个以 [ 开头到 ] 结束的JSON数组片段
      const match = text.match(/\[[\s\S]*\]/);
      const jsonStr = match ? match[0] : '[]';
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        suggestions = parsed.filter(x => typeof x === 'string').slice(0, n);
      }
    } catch (e) {
      logger.warn('[FAST_SUGGEST] 解析失败，返回空数组');
      suggestions = [];
    }

    logger.info('[FAST_SUGGEST] 完成', { count: suggestions.length });
    res.json({ suggestions });
  } catch (error) {
    logger.error('[FAST_SUGGEST] 请求失败', { error: error.message, code: error.code });
    res.status(500).json({ error: '建议生成失败', code: 'FAST_SUGGEST_ERROR' });
  }
});

// ==================== 反馈系统API ====================

/**
 * 保存用户反馈（支持匿名用户）
 */
app.post('/api/feedback', optionalAuth, async (req, res) => {
  try {
    const { feedback, messages, messageId } = req.body;
    
    // 验证参数
    if (!feedback || !['like', 'dislike'].includes(feedback)) {
      return res.status(400).json({
        error: '无效的反馈类型',
        code: 'INVALID_FEEDBACK_TYPE'
      });
    }
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: '消息历史不能为空',
        code: 'INVALID_MESSAGES'
      });
    }
    
    if (!messageId) {
      return res.status(400).json({
        error: '消息ID不能为空',
        code: 'INVALID_MESSAGE_ID'
      });
    }
    
    // 确保feedbacks目录存在
    try {
      await mkdir(FEEDBACK_DIR, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
    
    // 获取用户信息（支持匿名）
    const username = req.user?.userId || req.user?.name || 'anonymous';
    const userId = req.user?.userId || 'anonymous';
    
    // 生成文件名：YYYYMMDD_HHmmss_username_feedback.json
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
    const filename = `${dateStr}_${timeStr}_${username}_${feedback}.json`;
    const filepath = path.join(FEEDBACK_DIR, filename);
    
    // 构建反馈数据
    const feedbackData = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filename: filename,
      type: feedback,
      username: username,
      userId: userId,
      timestamp: now.getTime(),
      messageId: messageId,
      messages: messages,
      metadata: {
        userAgent: req.headers['user-agent'] || '',
        language: req.headers['accept-language'] || '',
        ip: req.ip || req.connection.remoteAddress || ''
      }
    };
    
    // 保存到文件
    await writeFile(filepath, JSON.stringify(feedbackData, null, 2), 'utf8');
    
    logger.warn('[反馈] 保存成功', {
      user: username,
      type: feedback,
      filename: filename,
      messageCount: messages.length
    });
    
    res.json({
      success: true,
      message: '反馈保存成功',
      filename: filename
    });
    
  } catch (error) {
    logger.error('[反馈] 保存失败:', error.message);
    res.status(500).json({
      error: '保存反馈失败',
      code: 'FEEDBACK_SAVE_ERROR',
      details: error.message
    });
  }
});

/**
 * 获取反馈列表（需要管理员权限）
 */
app.get('/api/feedback/list', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || String(FEEDBACK_PAGE_SIZE), 10);
    const type = req.query.type || 'all'; // all, like, dislike
    
    // 确保feedbacks目录存在
    try {
      await mkdir(FEEDBACK_DIR, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
    
    // 读取文件列表
    let files = await readdir(FEEDBACK_DIR);
    
    // 过滤JSON文件
    files = files.filter(f => f.endsWith('.json'));
    
    // 按类型过滤
    if (type !== 'all') {
      files = files.filter(f => f.includes(`_${type}.json`));
    }
    
    // 获取文件详细信息并排序（时间倒序）
    const fileInfos = await Promise.all(
      files.map(async (filename) => {
        const filepath = path.join(FEEDBACK_DIR, filename);
        const stats = await stat(filepath);
        const content = await readFile(filepath, 'utf8');
        const data = JSON.parse(content);
        
        return {
          filename: filename,
          type: data.type,
          username: data.username,
          timestamp: data.timestamp,
          messageCount: data.messages ? data.messages.length : 0,
          mtime: stats.mtime.getTime()
        };
      })
    );
    
    // 按时间戳倒序排序
    fileInfos.sort((a, b) => b.timestamp - a.timestamp);
    
    // 分页
    const total = fileInfos.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = fileInfos.slice(start, end);
    
    logger.info('[反馈列表] 查询成功', {
      user: req.user?.userId,
      page: page,
      pageSize: pageSize,
      type: type,
      total: total,
      returned: items.length
    });
    
    res.json({
      success: true,
      data: items,
      pagination: {
        page: page,
        pageSize: pageSize,
        total: total,
        totalPages: Math.ceil(total / pageSize),
        hasMore: end < total
      }
    });
    
  } catch (error) {
    logger.error('[反馈列表] 查询失败:', error.message);
    res.status(500).json({
      error: '获取反馈列表失败',
      code: 'FEEDBACK_LIST_ERROR',
      details: error.message
    });
  }
});

/**
 * 获取反馈详情（需要管理员权限）
 */
app.get('/api/feedback/:filename', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // 安全检查：确保文件名不包含路径穿越字符
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        error: '无效的文件名',
        code: 'INVALID_FILENAME'
      });
    }
    
    const filepath = path.join(FEEDBACK_DIR, filename);
    
    // 检查文件是否存在
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        error: '反馈文件不存在',
        code: 'FEEDBACK_NOT_FOUND'
      });
    }
    
    // 读取文件内容
    const content = await readFile(filepath, 'utf8');
    const data = JSON.parse(content);
    
    logger.info('[反馈详情] 查询成功', {
      user: req.user?.userId,
      filename: filename
    });
    
    res.json({
      success: true,
      data: data
    });
    
  } catch (error) {
    logger.error('[反馈详情] 查询失败:', error.message);
    res.status(500).json({
      error: '获取反馈详情失败',
      code: 'FEEDBACK_DETAIL_ERROR',
      details: error.message
    });
  }
});

// ==================== 历史记录系统API ====================

/**
 * 生成会话标题（基于第一条用户消息）
 */
function generateSessionTitle(messages) {
  const firstUserMessage = messages.find(m => m.role === 'user' && !m.isWelcome);
  if (!firstUserMessage || !firstUserMessage.content) {
    return '新对话';
  }
  
  const content = firstUserMessage.content.trim().replace(/\s+/g, ' ');
  if (content.length <= 30) {
    return content;
  }
  return content.slice(0, 30) + '...';
}

/**
 * 生成会话预览文本
 */
function generateSessionPreview(messages) {
  const firstUserMessage = messages.find(m => m.role === 'user' && !m.isWelcome);
  if (!firstUserMessage || !firstUserMessage.content) {
    return '';
  }
  
  const content = firstUserMessage.content.trim().replace(/\s+/g, ' ');
  if (content.length <= 50) {
    return content;
  }
  return content.slice(0, 50) + '...';
}

/**
 * 保存或更新会话
 */
app.post('/api/history/save', authenticateToken, async (req, res) => {
  try {
    const { sessionId, messages } = req.body;
    
    // 验证参数
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: '消息列表不能为空',
        code: 'INVALID_MESSAGES'
      });
    }
    
    // 过滤欢迎消息
    const validMessages = messages.filter(m => !m.isWelcome);
    if (validMessages.length === 0) {
      return res.status(400).json({
        error: '没有有效的消息需要保存',
        code: 'NO_VALID_MESSAGES'
      });
    }
    
    const userId = req.user?.userId || req.user?.name || 'anonymous';
    const now = Date.now();
    
    // 确保用户历史目录存在
    const userHistoryDir = path.join(CHAT_HISTORY_DIR, userId);
    try {
      await mkdir(userHistoryDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
    
    // 生成或使用现有会话ID
    let finalSessionId = sessionId;
    let isNewSession = false;
    
    if (!finalSessionId) {
      // 新建会话
      const timestamp = now;
      const randomId = Math.random().toString(36).substr(2, 9);
      finalSessionId = `${timestamp}_${randomId}`;
      isNewSession = true;
    }
    
    // 检查会话是否存在（如果提供了sessionId）
    const metadataPath = path.join(userHistoryDir, `${finalSessionId}_metadata.json`);
    const messagesPath = path.join(userHistoryDir, `${finalSessionId}_messages.json`);
    
    let metadata;
    let createdAt = now;
    
    if (!isNewSession && fs.existsSync(metadataPath)) {
      // 更新现有会话
      const existingMetadata = JSON.parse(await readFile(metadataPath, 'utf8'));
      createdAt = existingMetadata.createdAt;
    } else {
      isNewSession = true;
    }
    
    // 生成会话标题和预览
    const title = generateSessionTitle(validMessages);
    const preview = generateSessionPreview(validMessages);
    
    // 构建元数据
    metadata = {
      id: finalSessionId,
      userId: userId,
      title: title,
      createdAt: createdAt,
      updatedAt: now,
      messageCount: validMessages.length,
      preview: preview
    };
    
    // 保存文件
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    await writeFile(messagesPath, JSON.stringify(validMessages, null, 2), 'utf8');
    
    logger.warn('[历史记录] 会话保存成功', {
      user: userId,
      sessionId: finalSessionId,
      messageCount: validMessages.length,
      isNew: isNewSession
    });
    
    res.json({
      success: true,
      message: isNewSession ? '会话创建成功' : '会话更新成功',
      session: metadata
    });
    
  } catch (error) {
    logger.error('[历史记录] 保存失败:', error.message);
    res.status(500).json({
      error: '保存会话失败',
      code: 'HISTORY_SAVE_ERROR',
      details: error.message
    });
  }
});

/**
 * 获取会话列表（分页）
 */
app.get('/api/history/list', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || String(CHAT_HISTORY_PAGE_SIZE), 10);
    
    const userId = req.user?.userId || req.user?.name || 'anonymous';
    const userHistoryDir = path.join(CHAT_HISTORY_DIR, userId);
    
    // 确保用户历史目录存在
    try {
      await mkdir(userHistoryDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
    
    // 读取所有元数据文件
    let files = await readdir(userHistoryDir);
    files = files.filter(f => f.endsWith('_metadata.json'));
    
    // 读取所有元数据
    const sessions = await Promise.all(
      files.map(async (filename) => {
        const filepath = path.join(userHistoryDir, filename);
        try {
          const content = await readFile(filepath, 'utf8');
          return JSON.parse(content);
        } catch (err) {
          logger.warn('[历史记录] 读取元数据失败:', filename, err.message);
          return null;
        }
      })
    );
    
    // 过滤无效数据并按更新时间倒序排序
    const validSessions = sessions.filter(s => s !== null);
    validSessions.sort((a, b) => b.updatedAt - a.updatedAt);
    
    // 分页
    const total = validSessions.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = validSessions.slice(start, end);
    
    logger.info('[历史记录] 列表查询成功', {
      user: userId,
      page: page,
      pageSize: pageSize,
      total: total,
      returned: items.length
    });
    
    res.json({
      success: true,
      data: items,
      pagination: {
        page: page,
        pageSize: pageSize,
        total: total,
        totalPages: Math.ceil(total / pageSize),
        hasMore: end < total
      }
    });
    
  } catch (error) {
    logger.error('[历史记录] 列表查询失败:', error.message);
    res.status(500).json({
      error: '获取会话列表失败',
      code: 'HISTORY_LIST_ERROR',
      details: error.message
    });
  }
});

/**
 * 搜索会话（全文搜索）
 * 注意：必须在动态路由 /:sessionId 之前定义，否则会被拦截
 */
app.get('/api/history/search', authenticateToken, async (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || String(CHAT_HISTORY_PAGE_SIZE), 10);
    
    if (!keyword || keyword.trim().length === 0) {
      return res.status(400).json({
        error: '搜索关键词不能为空',
        code: 'INVALID_KEYWORD'
      });
    }
    
    const userId = req.user?.userId || req.user?.name || 'anonymous';
    const userHistoryDir = path.join(CHAT_HISTORY_DIR, userId);
    
    // 确保用户历史目录存在
    try {
      await mkdir(userHistoryDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
    
    // 读取所有元数据文件
    let files = await readdir(userHistoryDir);
    files = files.filter(f => f.endsWith('_metadata.json'));
    
    const searchKeywordLower = keyword.trim().toLowerCase();
    const matchedSessions = [];
    
    // 搜索所有会话
    for (const filename of files) {
      const sessionId = filename.replace('_metadata.json', '');
      const metadataPath = path.join(userHistoryDir, filename);
      const messagesPath = path.join(userHistoryDir, `${sessionId}_messages.json`);
      
      try {
        const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
        
        // 搜索标题
        if (metadata.title && metadata.title.toLowerCase().includes(searchKeywordLower)) {
          matchedSessions.push({ session: metadata, relevance: 2 }); // 标题匹配优先级高
          continue;
        }
        
        // 搜索消息内容
        if (fs.existsSync(messagesPath)) {
          const messages = JSON.parse(await readFile(messagesPath, 'utf8'));
          const hasMatch = messages.some(msg => 
            msg.content && msg.content.toLowerCase().includes(searchKeywordLower)
          );
          
          if (hasMatch) {
            matchedSessions.push({ session: metadata, relevance: 1 }); // 内容匹配优先级低
          }
        }
      } catch (err) {
        logger.warn('[历史记录] 搜索时读取文件失败:', filename, err.message);
      }
    }
    
    // 按相关度和更新时间排序
    matchedSessions.sort((a, b) => {
      if (a.relevance !== b.relevance) {
        return b.relevance - a.relevance;
      }
      return b.session.updatedAt - a.session.updatedAt;
    });
    
    const sessions = matchedSessions.map(m => m.session);
    
    // 分页
    const total = sessions.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = sessions.slice(start, end);
    
    logger.info('[历史记录] 搜索成功', {
      user: userId,
      keyword: keyword,
      page: page,
      pageSize: pageSize,
      total: total,
      returned: items.length
    });
    
    res.json({
      success: true,
      data: items,
      pagination: {
        page: page,
        pageSize: pageSize,
        total: total,
        totalPages: Math.ceil(total / pageSize),
        hasMore: end < total
      }
    });
    
  } catch (error) {
    logger.error('[历史记录] 搜索失败:', error.message);
    res.status(500).json({
      error: '搜索会话失败',
      code: 'HISTORY_SEARCH_ERROR',
      details: error.message
    });
  }
});

/**
 * 获取会话详情
 */
app.get('/api/history/:sessionId', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    
    // 安全检查
    if (sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) {
      return res.status(400).json({
        error: '无效的会话ID',
        code: 'INVALID_SESSION_ID'
      });
    }
    
    const userId = req.user?.userId || req.user?.name || 'anonymous';
    const userHistoryDir = path.join(CHAT_HISTORY_DIR, userId);
    
    const metadataPath = path.join(userHistoryDir, `${sessionId}_metadata.json`);
    const messagesPath = path.join(userHistoryDir, `${sessionId}_messages.json`);
    
    // 检查文件是否存在
    if (!fs.existsSync(metadataPath) || !fs.existsSync(messagesPath)) {
      return res.status(404).json({
        error: '会话不存在',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    // 读取数据
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    const messages = JSON.parse(await readFile(messagesPath, 'utf8'));
    
    logger.info('[历史记录] 详情查询成功', {
      user: userId,
      sessionId: sessionId
    });
    
    res.json({
      success: true,
      data: {
        ...metadata,
        messages: messages
      }
    });
    
  } catch (error) {
    logger.error('[历史记录] 详情查询失败:', error.message);
    res.status(500).json({
      error: '获取会话详情失败',
      code: 'HISTORY_DETAIL_ERROR',
      details: error.message
    });
  }
});

/**
 * 删除会话
 */
app.delete('/api/history/:sessionId', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    
    // 安全检查
    if (sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) {
      return res.status(400).json({
        error: '无效的会话ID',
        code: 'INVALID_SESSION_ID'
      });
    }
    
    const userId = req.user?.userId || req.user?.name || 'anonymous';
    const userHistoryDir = path.join(CHAT_HISTORY_DIR, userId);
    
    const metadataPath = path.join(userHistoryDir, `${sessionId}_metadata.json`);
    const messagesPath = path.join(userHistoryDir, `${sessionId}_messages.json`);
    
    // 检查文件是否存在
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({
        error: '会话不存在',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    // 删除文件
    try {
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }
      if (fs.existsSync(messagesPath)) {
        fs.unlinkSync(messagesPath);
      }
    } catch (err) {
      throw new Error(`删除文件失败: ${err.message}`);
    }
    
    logger.warn('[历史记录] 会话删除成功', {
      user: userId,
      sessionId: sessionId
    });
    
    res.json({
      success: true,
      message: '会话删除成功'
    });
    
  } catch (error) {
    logger.error('[历史记录] 删除失败:', error.message);
    res.status(500).json({
      error: '删除会话失败',
      code: 'HISTORY_DELETE_ERROR',
      details: error.message
    });
  }
});

/**
 * 更新会话标题
 */
app.put('/api/history/:sessionId/title', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const { title } = req.body;
    
    // 验证参数
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        error: '标题不能为空',
        code: 'INVALID_TITLE'
      });
    }
    
    // 安全检查
    if (sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) {
      return res.status(400).json({
        error: '无效的会话ID',
        code: 'INVALID_SESSION_ID'
      });
    }
    
    const userId = req.user?.userId || req.user?.name || 'anonymous';
    const userHistoryDir = path.join(CHAT_HISTORY_DIR, userId);
    
    const metadataPath = path.join(userHistoryDir, `${sessionId}_metadata.json`);
    
    // 检查文件是否存在
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({
        error: '会话不存在',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    // 读取并更新元数据
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    metadata.title = title.trim();
    metadata.updatedAt = Date.now();
    
    // 保存
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    
    logger.info('[历史记录] 标题更新成功', {
      user: userId,
      sessionId: sessionId,
      newTitle: title.trim()
    });
    
    res.json({
      success: true,
      message: '标题更新成功',
      session: metadata
    });
    
  } catch (error) {
    logger.error('[历史记录] 标题更新失败:', error.message);
    res.status(500).json({
      error: '更新标题失败',
      code: 'HISTORY_TITLE_UPDATE_ERROR',
      details: error.message
    });
  }
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

    // 1.5) 规范化用户输入：仅在存在用户姓名/ID时，将“我的”替换为“{{name}}的”，以提升知识库检索精度
    const hasUserName = !!(req.user && (req.user.name || req.user.userId));
    const normalizeForRetrieval = (text) => {
      if (!hasUserName) return text;
      return typeof text === 'string' ? text.replace(/我的/g, `${currentUserName}的`) : text;
    };

    const normalizedMessage = normalizeForRetrieval(message);
    const normalizedContextMessages = Array.isArray(contextMessages)
      ? contextMessages.map(m => ({
          ...m,
          content: m.role === 'user' ? normalizeForRetrieval(m.content) : m.content
        }))
      : [];

    logger.info('[NLP-Preprocess] 规范化完成', {
      replacedInCurrent: message === normalizedMessage ? 0 : 1,
      contextCount: normalizedContextMessages.length
    });

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
    if (normalizedContextMessages && normalizedContextMessages.length > 0) {
      // 限制上下文消息数量
      const limitedContext = normalizedContextMessages.slice(-CONTEXT_MESSAGE_COUNT);
      
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
      content: normalizedMessage
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
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'Content-Encoding': 'identity',
        'X-Accel-Buffering': 'no'
      });

      // 立即刷新头，避免代理/浏览器等待
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      // 发送前置填充，突破某些代理/浏览器的缓冲阈值
      res.write(':' + ' '.repeat(2048) + '\n');

      // 流式传输相关变量（需要在try-catch外部定义，以便catch块可以访问）
      const connectionStartTime = Date.now();
      let firstDataReceivedTime = null; // 第一次数据接收时间（包括任何底层数据，不仅是SSE消息）
      let lastDataReceivedTime = null; // 最后一次接收到任何数据的时间（包括心跳、空白行等底层stream数据）
      let dataTimeoutTimer = null; // 数据接收超时定时器（检测是否有任何数据返回，包括心跳）
      let isConnectionEstablished = false; // 连接是否已建立（收到第一个数据块）
      
      logger.info('[AI-流式] 开始建立连接', {
        initialTimeout: STREAM_INITIAL_TIMEOUT,
        dataTimeout: STREAM_DATA_TIMEOUT
      });

      try {
        // 使用适配器构建流式请求
        // 获取实际用户名用于Dify API
        const currentUser = (req.user && (req.user.name || req.user.userId)) || 'default-user';
        const requestBody = aiAdapter.buildStreamRequestBody(messages, {
          user: currentUser
        });
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

        // 心跳检测函数：检查是否超过数据接收超时时间
        // 超时判断：从最后一次收到任何数据（包括心跳、SSE消息、底层stream数据）开始计算
        // 如果没有收到任何数据返回（包括心跳），则认为连接中断
        const checkDataTimeout = () => {
          if (isConnectionEstablished && lastDataReceivedTime) {
            const timeSinceLastData = Date.now() - lastDataReceivedTime;
            if (timeSinceLastData > STREAM_DATA_TIMEOUT) {
              logger.error('[AI-流式] 数据接收超时（无任何数据返回，包括心跳）', {
                timeSinceLastData: timeSinceLastData + 'ms',
                dataTimeout: STREAM_DATA_TIMEOUT + 'ms',
                chunkCount: chunkCount,
                accumulatedLength: accumulatedText.length
              });
              
              if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify({
                  error: '数据接收超时，连接可能已中断',
                  code: 'DATA_TIMEOUT',
                  details: `超过${STREAM_DATA_TIMEOUT / 1000}秒未收到新数据`
                })}\n\n`);
                res.end();
              }
              
              // 清理定时器
              if (dataTimeoutTimer) {
                clearInterval(dataTimeoutTimer);
                dataTimeoutTimer = null;
              }
              
              // 销毁响应流
              try {
                response.data.destroy();
              } catch (e) {
                // 忽略销毁错误
              }
              
              return true;
            }
          }
          return false;
        };

        // 启动心跳检测定时器（每10秒检查一次）
        dataTimeoutTimer = setInterval(() => {
          if (checkDataTimeout()) {
            // 超时已处理，定时器会在checkDataTimeout中清理
            return;
          }
        }, 10000);

        response.data.on('data', (chunk) => {
          const currentTime = Date.now();
          
          // 记录第一次数据接收时间（包括任何底层stream数据，不仅是SSE消息）
          if (!isConnectionEstablished) {
            firstDataReceivedTime = currentTime;
            isConnectionEstablished = true;
            const connectionEstablishTime = currentTime - connectionStartTime;
            logger.info('[AI-流式] 连接已建立，收到第一个数据块', {
              connectionTime: connectionEstablishTime + 'ms',
              chunkSize: chunk.length,
              initialTimeout: STREAM_INITIAL_TIMEOUT + 'ms'
            });
          }
          
          // 更新最后数据接收时间（收到任何底层数据都会重置超时，包括心跳、空白行等）
          // 这样确保：只要有数据返回（即使是心跳），就不会超时
          const previousLastDataTime = lastDataReceivedTime;
          lastDataReceivedTime = currentTime;
          
          // 记录数据间隔（如果不是第一次）
          if (previousLastDataTime) {
            const dataInterval = currentTime - previousLastDataTime;
            if (dataInterval > 5000) { // 超过5秒的数据间隔，记录日志
              logger.warn('[AI-流式] 数据间隔较长', {
                interval: dataInterval + 'ms',
                chunkCount: chunkCount + 1
              });
            }
          }
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
            
            // 转换不同格式到OpenAI标准格式
            try {
              // 显式检查provider配置，优先使用
              if (aiAdapter.getProvider() === 'dify' || aiAdapter.isDifyApi()) {
                // 解析Dify格式
                const parsed = JSON.parse(sseMessage.data);
                const event = parsed.event;
                
                // Dify可能使用不同的字段名：answer, text, content
                // 对于 agent_message 事件，可能使用 answer 字段
                let answer = '';
                if (parsed.answer !== undefined && parsed.answer !== null) {
                  answer = String(parsed.answer);
                } else if (parsed.text !== undefined && parsed.text !== null) {
                  answer = String(parsed.text);
                } else if (parsed.content !== undefined && parsed.content !== null) {
                  answer = String(parsed.content);
                }
                
                // Debug日志：打印解析结果
                logger.debug(`[AI-流式-解析] Dify消息 #${chunkCount}`, {
                  event: event,
                  answerLength: answer.length,
                  accumulatedLength: accumulatedText.length,
                  hasAnswer: parsed.answer !== undefined,
                  hasText: parsed.text !== undefined,
                  hasContent: parsed.content !== undefined,
                  answerType: typeof parsed.answer,
                  answerValue: parsed.answer,
                  parsedKeys: Object.keys(parsed),
                  fullParsed: JSON.stringify(parsed).substring(0, 200)
                });
                
                // Dify支持多种事件类型：message, agent_message, agent_thought, message_end
                // agent_thought 是思考过程，不发送给前端
                if (event === 'message' || event === 'agent_message') {
                  // 消息事件，提取增量文本
                  if (answer && answer.length > 0) {
                    accumulatedText += answer;
                    
                    // 转换为OpenAI标准格式 - 发送增量文本
                    const standardChunk = {
                      content: answer, // 发送增量文本
                      done: false,
                      timestamp: new Date().toISOString()
                    };
                    
                    const sseData = `data: ${JSON.stringify(standardChunk)}\n\n`;
                    res.write(sseData);
                    
                    logger.warn(`[AI-流式-发送] Dify消息 #${chunkCount}`, {
                      event: event,
                      incrementalLength: answer.length,
                      accumulatedLength: accumulatedText.length,
                      answerPreview: answer.substring(0, 100)
                    });
                    
                    isFirstMessage = false;
                  } else {
                    logger.debug(`[AI-流式-跳过] Dify消息 #${chunkCount} - answer为空`, {
                      event: event,
                      answer: answer,
                      answerLength: answer.length,
                      parsed: parsed
                    });
                  }
                } else if (event === 'message_end' || event === 'agent_message_end') {
                  // 消息结束事件
                  const totalDuration = Date.now() - connectionStartTime;
                  const dataDuration = firstDataReceivedTime 
                    ? Date.now() - firstDataReceivedTime 
                    : 0;
                  
                  logger.info('[AI-流式] Dify流式传输完成', {
                    totalMessages: chunkCount,
                    totalLength: accumulatedText.length,
                    totalDuration: totalDuration + 'ms',
                    dataDuration: dataDuration + 'ms'
                  });
                  
                  // 清理心跳检测定时器
                  if (dataTimeoutTimer) {
                    clearInterval(dataTimeoutTimer);
                    dataTimeoutTimer = null;
                  }
                  
                  res.write('data: [DONE]\n\n');
                  res.end();
                  return;
                }
              } else if (aiAdapter.getProvider() === 'dashscope') {
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
                  
                  // 转换为OpenAI标准格式 - 发送增量文本
                  const standardChunk = {
                    content: incrementalText, // 发送增量文本，不是累积文本
                    done: finishReason === 'stop',
                    timestamp: new Date().toISOString()
                  };
                  
                  const sseData = `data: ${JSON.stringify(standardChunk)}\n\n`;
                  res.write(sseData);
                  
                  // Debug日志：打印发送给前端的实际SSE数据
                  logger.debug(`[AI-流式-发送] 消息 #${sseMessage.id}`, {
                    incrementalLength: incrementalText.length,
                    incrementalPreview: incrementalText.slice(0, 100),
                    accumulatedLength: accumulatedText.length,
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
                  const totalDuration = Date.now() - connectionStartTime;
                  const dataDuration = firstDataReceivedTime 
                    ? Date.now() - firstDataReceivedTime 
                    : 0;
                  
                  logger.info('[AI-流式] 流式传输完成', {
                    totalMessages: chunkCount,
                    totalLength: accumulatedText.length,
                    totalDuration: totalDuration + 'ms',
                    dataDuration: dataDuration + 'ms',
                    connectionTime: firstDataReceivedTime 
                      ? firstDataReceivedTime - connectionStartTime + 'ms'
                      : 'N/A'
                  });
                  
                  // 清理心跳检测定时器
                  if (dataTimeoutTimer) {
                    clearInterval(dataTimeoutTimer);
                    dataTimeoutTimer = null;
                  }
                  
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
          const totalDuration = Date.now() - connectionStartTime;
          const dataDuration = firstDataReceivedTime 
            ? Date.now() - firstDataReceivedTime 
            : 0;
          
          logger.info('[AI-流式] 流结束', {
            totalDuration: totalDuration + 'ms',
            dataDuration: dataDuration + 'ms',
            chunkCount: chunkCount,
            totalLength: accumulatedText.length
          });
          
          // 清理心跳检测定时器
          if (dataTimeoutTimer) {
            clearInterval(dataTimeoutTimer);
            dataTimeoutTimer = null;
          }
          
          if (!res.writableEnded) {
            res.write('data: [DONE]\n\n');
            res.end();
          }
        });

        response.data.on('error', (error) => {
          const totalDuration = Date.now() - connectionStartTime;
          
          logger.error('[AI-流式] 流错误', {
            error: error.message,
            code: error.code,
            totalDuration: totalDuration + 'ms',
            chunkCount: chunkCount,
            isConnectionEstablished: isConnectionEstablished
          });
          
          // 清理心跳检测定时器
          if (dataTimeoutTimer) {
            clearInterval(dataTimeoutTimer);
            dataTimeoutTimer = null;
          }
          
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
        const totalDuration = Date.now() - connectionStartTime;
        const isTimeoutError = error.code === 'ECONNABORTED' || error.message.includes('timeout');
        
        // 尝试读取错误响应的内容（如果是流）
        let errorResponseData = null;
        if (error.response && error.response.data) {
          try {
            // 如果是流对象，需要读取内容
            if (error.response.data && typeof error.response.data.on === 'function' && !error.response.data.readableEnded) {
              // 这是流对象，需要读取
              const chunks = [];
              
              error.response.data.on('data', (chunk) => {
                chunks.push(chunk);
              });
              
              await new Promise((resolve) => {
                error.response.data.on('end', resolve);
                error.response.data.on('error', resolve);
                // 设置超时，避免无限等待
                setTimeout(resolve, 1000);
              });
              
              if (chunks.length > 0) {
                const errorText = Buffer.concat(chunks).toString('utf-8');
                try {
                  errorResponseData = JSON.parse(errorText);
                } catch {
                  errorResponseData = errorText;
                }
              }
            } else if (error.response.data) {
              // 如果不是流，直接使用
              errorResponseData = error.response.data;
            }
          } catch (e) {
            logger.debug('[AI-流式] 读取错误响应失败:', e.message);
          }
        }
        
        logger.error('[AI-流式] 请求失败', {
          error: error.message,
          code: error.code,
          totalDuration: totalDuration + 'ms',
          isTimeoutError: isTimeoutError,
          isConnectionEstablished: isConnectionEstablished || false,
          responseStatus: error.response?.status,
          responseData: errorResponseData || '无法读取错误响应',
          responseHeaders: error.response?.headers
        });
        
        // 清理心跳检测定时器
        if (dataTimeoutTimer) {
          clearInterval(dataTimeoutTimer);
          dataTimeoutTimer = null;
        }
        
        if (!res.writableEnded) {
          let errorCode = 'API_ERROR';
          let errorMessage = 'AI服务调用失败';
          
          if (isTimeoutError) {
            if (isConnectionEstablished) {
              errorCode = 'DATA_TIMEOUT';
              errorMessage = '数据接收超时，连接可能已中断';
            } else {
              errorCode = 'CONNECTION_TIMEOUT';
              errorMessage = `连接超时，超过${STREAM_INITIAL_TIMEOUT / 1000}秒未能建立连接`;
            }
          }
          
          res.write(`data: ${JSON.stringify({
            error: errorMessage,
            code: errorCode,
            details: error.message
          })}\n\n`);
          res.end();
        }
      }
    } else {
      // 非流式传输模式
      // 获取实际用户名用于Dify API
      const currentUser = (req.user && (req.user.name || req.user.userId)) || 'default-user';
      const requestBody = aiAdapter.buildRequestBody(messages, {
        user: currentUser
      });
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

// ==================== WebSocket服务器（语音识别代理）====================

const http = require('http');
const server = http.createServer(app);

// 创建WebSocket服务器
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ 
  server: server,
  path: '/api/ws/speech-recognition'
});

// 存储客户端连接及其对应的语音识别适配器
const clientAdapters = new Map();

wss.on('connection', (ws, req) => {
  const clientId = `${req.socket.remoteAddress}_${Date.now()}`;
  logger.info('[语音识别WS] 新客户端连接:', clientId);
  
  let adapter = null;
  let mode = 'vad'; // 默认VAD模式

  // 处理客户端消息
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      logger.debug('[语音识别WS] 收到客户端消息:', data.type);

      if (data.type === 'start') {
        // 开始识别会话
        mode = data.mode || (VOICE_INPUT_VAD_MODE ? 'vad' : 'manual');
        const language = data.language || VOICE_INPUT_LANGUAGE;

        if (!DASHSCOPE_API_KEY) {
          logger.error('[语音识别WS] API密钥未配置');
          ws.send(JSON.stringify({
            type: 'error',
            message: '语音识别服务未配置API密钥'
          }));
          return;
        }

        // 创建语音识别适配器
        adapter = new AliSpeechRecognitionAdapter(
          DASHSCOPE_API_KEY,
          VOICE_INPUT_BASE_URL,
          VOICE_INPUT_MODEL
        );

        // 注册回调
        adapter.onTranscript((text, isFinal) => {
          ws.send(JSON.stringify({
            type: 'transcript',
            text: text,
            isFinal: isFinal
          }));
        });

        adapter.onError((error) => {
          ws.send(JSON.stringify({
            type: 'error',
            message: error
          }));
        });

        adapter.onComplete(() => {
          ws.send(JSON.stringify({
            type: 'complete'
          }));
        });

        // 保存适配器
        clientAdapters.set(ws, adapter);

        // 开始会话
        try {
          await adapter.start({ mode, language });
          logger.info('[语音识别WS] 会话已启动，模式:', mode);
        } catch (error) {
          logger.error('[语音识别WS] 启动会话失败:', error.message);
          ws.send(JSON.stringify({
            type: 'error',
            message: `启动会话失败: ${error.message}`
          }));
        }

      } else if (data.type === 'audio') {
        // 发送音频数据
        if (!adapter) {
          logger.warn('[语音识别WS] 适配器未初始化，忽略音频数据');
          return;
        }

        try {
          // 将base64编码的音频数据转换为Buffer
          const audioBuffer = Buffer.from(data.data, 'base64');
          await adapter.sendAudio(audioBuffer);
        } catch (error) {
          logger.error('[语音识别WS] 发送音频失败:', error.message);
          ws.send(JSON.stringify({
            type: 'error',
            message: `发送音频失败: ${error.message}`
          }));
        }

      } else if (data.type === 'commit') {
        // 提交音频（Manual模式）
        if (!adapter) {
          logger.warn('[语音识别WS] 适配器未初始化，无法提交');
          return;
        }

        try {
          await adapter.commit();
          logger.info('[语音识别WS] 音频已提交');
        } catch (error) {
          logger.error('[语音识别WS] 提交音频失败:', error.message);
          ws.send(JSON.stringify({
            type: 'error',
            message: `提交音频失败: ${error.message}`
          }));
        }

      } else {
        logger.warn('[语音识别WS] 未知消息类型:', data.type);
      }
    } catch (error) {
      logger.error('[语音识别WS] 处理消息失败:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        message: `处理消息失败: ${error.message}`
      }));
    }
  });

  // 处理连接关闭
  ws.on('close', async () => {
    logger.info('[语音识别WS] 客户端断开连接:', clientId);
    
    // 清理适配器
    if (adapter) {
      try {
        await adapter.close();
      } catch (error) {
        logger.error('[语音识别WS] 关闭适配器失败:', error.message);
      }
      clientAdapters.delete(ws);
    }
  });

  // 处理错误
  ws.on('error', (error) => {
    logger.error('[语音识别WS] WebSocket错误:', error.message);
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`🚀 AI聊天应用已启动`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`🔗 API端点: http://localhost:${PORT}/api/chat`);
  console.log(`🔊 语音识别WebSocket: ws://localhost:${PORT}/api/ws/speech-recognition`);
  console.log(`❤️  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`📊 日志级别: ${LOG_LEVEL}`);
});

module.exports = app;