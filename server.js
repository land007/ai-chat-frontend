const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// 从环境变量读取配置
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || 'your_api_key_here';
const DASHSCOPE_API_URL = process.env.DASHSCOPE_API_URL || 'https://dashscope.aliyuncs.com/api/v1/apps/your_app_id/completion';
const APP_NAME = process.env.APP_NAME || 'AI智能助手';
const APP_DESCRIPTION = process.env.APP_DESCRIPTION || '基于阿里云DashScope的智能对话';
const WELCOME_MESSAGE = process.env.WELCOME_MESSAGE || '';
const CONTEXT_MESSAGE_COUNT = parseInt(process.env.CONTEXT_MESSAGE_COUNT || '5', 10);

// 企业微信认证配置
const WEWORK_CORP_ID = process.env.WEWORK_CORP_ID || '';
const WEWORK_AGENT_ID = process.env.WEWORK_AGENT_ID || '';
const WEWORK_CORP_SECRET = process.env.WEWORK_CORP_SECRET || '';
const WEWORK_REDIRECT_URI = process.env.WEWORK_REDIRECT_URI || '';
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

// 认证开关和用户配置
const ENABLE_AUTH = process.env.ENABLE_AUTH === 'true';
const BASIC_AUTH_USERS = process.env.BASIC_AUTH_USERS || 'admin:admin123';

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
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 企业微信域名验证文件 - 优先处理
app.get('/WW_verify_XXXXXXXXXXXXXXX.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'WW_verify_XXXXXXXXXXXXXXX.txt'));
});

// 静态文件服务 - 用于企业微信域名验证
app.use(express.static(path.join(__dirname, 'public')));

// ==================== 企业微信API服务 ====================

/**
 * 获取企业微信access_token
 */
async function getWeworkAccessToken() {
  try {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${WEWORK_CORP_ID}&corpsecret=${WEWORK_CORP_SECRET}`;
    const response = await axios.get(url);
    
    if (response.data.errcode === 0) {
      console.log('[企业微信] access_token获取成功');
      return response.data.access_token;
    } else {
      console.error('[企业微信] 获取access_token失败:', response.data);
      throw new Error(`获取access_token失败: ${response.data.errmsg}`);
    }
  } catch (error) {
    console.error('[企业微信] 获取access_token异常:', error.message);
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
      console.log('[企业微信] 获取UserId成功:', response.data.userid || response.data.UserId);
      return response.data.userid || response.data.UserId;
    } else {
      console.error('[企业微信] 获取UserId失败:', response.data);
      throw new Error(`获取用户信息失败: ${response.data.errmsg}`);
    }
  } catch (error) {
    console.error('[企业微信] 获取UserId异常:', error.message);
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
      console.log('[企业微信] 获取用户信息成功:', response.data.name);
      return {
        userId: response.data.userid,
        name: response.data.name,
        department: response.data.department,
        position: response.data.position,
        mobile: response.data.mobile,
        email: response.data.email
      };
    } else {
      console.error('[企业微信] 获取用户详细信息失败:', response.data);
      throw new Error(`获取用户详细信息失败: ${response.data.errmsg}`);
    }
  } catch (error) {
    console.error('[企业微信] 获取用户详细信息异常:', error.message);
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
    console.log('[认证] 认证开关关闭，跳过认证检查');
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.log('[认证] 缺少token');
    return res.status(401).json({ 
      error: '未授权访问',
      code: 'NO_TOKEN'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('[认证] token验证失败:', err.message);
      return res.status(403).json({ 
        error: 'token无效或已过期',
        code: 'INVALID_TOKEN'
      });
    }
    
    req.user = user;
    console.log('[认证] 用户验证成功:', user.name, '登录方式:', user.loginType);
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
    console.log('[认证] 发起企业微信授权');
    
    if (!WEWORK_CORP_ID || !WEWORK_AGENT_ID || !WEWORK_REDIRECT_URI) {
      return res.status(500).json({
        error: '企业微信配置不完整',
        code: 'WEWORK_CONFIG_INCOMPLETE'
      });
    }

    // 构建企业微信授权URL
    const redirectUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${WEWORK_CORP_ID}&redirect_uri=${encodeURIComponent(WEWORK_REDIRECT_URI)}&response_type=code&scope=snsapi_base&state=STATE#wechat_redirect`;
    
    console.log('[认证] 授权URL:', redirectUrl);
    
    res.json({
      redirectUrl: redirectUrl
    });
  } catch (error) {
    console.error('[认证] 生成授权URL失败:', error.message);
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
    
    console.log('[认证] 用户名密码登录尝试:', username);
    
    if (!username || !password) {
      return res.status(400).json({
        error: '用户名和密码不能为空',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // 验证用户名和密码
    if (!authUsers[username] || authUsers[username] !== password) {
      console.log('[认证] 用户名密码验证失败:', username);
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

    console.log('[认证] 用户名密码登录成功:', username);

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
    console.error('[认证] 用户名密码登录失败:', error.message);
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
    console.log('[认证] 获取认证配置');
    
    res.json({
      authEnabled: ENABLE_AUTH,
      weworkEnabled: !!(WEWORK_CORP_ID && WEWORK_AGENT_ID && WEWORK_CORP_SECRET),
      availableUsers: Object.keys(authUsers)
    });
  } catch (error) {
    console.error('[认证] 获取认证配置失败:', error.message);
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
    
    console.log('[认证] 收到授权回调, code:', code);
    
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

    console.log('[认证] JWT token生成成功, 用户:', userInfo.name);

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
    console.error('[认证] 授权回调处理失败:', error.message);
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
    console.log('[认证] 获取用户信息');
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
    console.error('[认证] 获取用户信息失败:', error.message);
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
    console.log('[认证] 用户退出登录');
    res.json({
      success: true,
      message: '退出成功'
    });
  } catch (error) {
    console.error('[认证] 退出登录失败:', error.message);
    res.status(500).json({
      error: '退出登录失败',
      code: 'LOGOUT_ERROR'
    });
  }
});

// ==================== 业务API ====================

// 应用配置端点（公开访问，无需认证）
app.get('/api/config', (req, res) => {
  res.json({
    name: APP_NAME,
    description: APP_DESCRIPTION,
    welcomeMessage: WELCOME_MESSAGE,
    enableI18nButton: process.env.ENABLE_I18N_BUTTON === 'true',
    enableDebugMode: process.env.ENABLE_DEBUG_MODE === 'true'
  });
});

// AI聊天API端点 - 流式传输版本（需要认证）
app.post('/api/chat', authenticateToken, async (req, res) => {
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