"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const axios_1 = __importDefault(require("axios"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000', 10);
// 从环境变量读取配置
const config = {
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || 'sk-b1a80ab373754d59a37b46a9c37a2d01',
    DASHSCOPE_API_URL: process.env.DASHSCOPE_API_URL || 'https://dashscope.aliyuncs.com/api/v1/apps/94e854e4500f472db5fbe7ca856a6c0c/completion',
    APP_NAME: process.env.APP_NAME || 'AI智能助手',
    APP_DESCRIPTION: process.env.APP_DESCRIPTION || '基于阿里云DashScope的智能对话',
    WELCOME_MESSAGE: process.env.WELCOME_MESSAGE || '',
    CONTEXT_MESSAGE_COUNT: parseInt(process.env.CONTEXT_MESSAGE_COUNT || '5', 10)
};
// 中间件
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// 请求日志中间件
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
// API路由 - 必须在静态文件服务之前定义
// 健康检查端点
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'AI Chat API'
    });
});
// 应用配置端点
app.get('/api/config', (_req, res) => {
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
// AI聊天API端点 - 流式返回
app.post('/api/chat/stream', async (req, res) => {
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
        let fullPrompt = message;
        if (contextMessages && contextMessages.length > 0) {
            // 限制上下文消息数量
            const limitedContext = contextMessages.slice(-config.CONTEXT_MESSAGE_COUNT);
            // 构建上下文
            const contextText = limitedContext.map((msg) => {
                const role = msg.role === 'user' ? '用户' : '助手';
                return `${role}: ${msg.content}`;
            }).join('\n');
            fullPrompt = `以下是之前的对话内容，请根据上下文回答用户的问题：\n\n${contextText}\n\n用户: ${message}`;
        }
        console.log(`[AI-STREAM-REQUEST] 完整提示词长度: ${fullPrompt.length}`);
        // 发送开始事件
        res.write(`data: ${JSON.stringify({ type: 'start', timestamp: new Date().toISOString() })}\n\n`);
        // 转发请求到阿里云DashScope - 尝试使用流式响应
        try {
            const dashScopeRequest = {
                input: {
                    prompt: fullPrompt
                },
                parameters: {
                    incremental_output: true // 启用增量输出
                },
                debug: {}
            };
            console.log('[AI-STREAM-REQUEST] 发送DashScope请求:', JSON.stringify(dashScopeRequest, null, 2));
            // 尝试使用流式请求
            const response = await axios_1.default.post(config.DASHSCOPE_API_URL, dashScopeRequest, {
                headers: {
                    'Authorization': `Bearer ${config.DASHSCOPE_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    'X-DashScope-SSE': 'enable' // 启用DashScope SSE
                },
                timeout: 30000,
                responseType: 'stream' // 设置响应类型为流
            });
            console.log('[AI-STREAM-RESPONSE] DashScope响应状态:', response.status);
            // 处理流式响应
            let buffer = '';
            let accumulatedText = '';
            response.data.on('data', (chunk) => {
                buffer += chunk.toString();
                console.log('[AI-STREAM-RESPONSE] 收到原始数据:', chunk.toString());
                // 处理SSE格式的数据
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保留最后一个不完整的行
                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        try {
                            const eventData = JSON.parse(line.slice(5).trim());
                            console.log('[AI-STREAM-RESPONSE] 收到DashScope事件:', eventData);
                            // 处理文本内容
                            if (eventData.output && eventData.output.text !== undefined) {
                                // DashScope的text字段包含累积的完整文本
                                const newText = eventData.output.text;
                                // 计算新增的文本
                                if (newText.length > accumulatedText.length) {
                                    const newContent = newText.slice(accumulatedText.length);
                                    accumulatedText = newText;
                                    console.log('[AI-STREAM-RESPONSE] 新增文本:', newContent);
                                    // 转发新增的文本给前端
                                    res.write(`data: ${JSON.stringify({
                                        type: 'content',
                                        content: newContent,
                                        timestamp: new Date().toISOString()
                                    })}\n\n`);
                                }
                            }
                            // 检查是否完成
                            if (eventData.output && eventData.output.finish_reason === 'stop') {
                                console.log('[AI-STREAM-RESPONSE] 流式响应完成');
                                res.write(`data: ${JSON.stringify({
                                    type: 'done',
                                    timestamp: new Date().toISOString()
                                })}\n\n`);
                            }
                        }
                        catch (parseError) {
                            console.warn('[AI-STREAM-RESPONSE] 解析DashScope事件失败:', parseError);
                            console.warn('[AI-STREAM-RESPONSE] 原始行:', line);
                        }
                    }
                }
            });
            response.data.on('end', () => {
                console.log('[AI-STREAM-RESPONSE] DashScope流式响应结束');
                res.write(`data: ${JSON.stringify({
                    type: 'done',
                    timestamp: new Date().toISOString()
                })}\n\n`);
            });
            response.data.on('error', (error) => {
                console.error('[AI-STREAM-RESPONSE] DashScope流式响应错误:', error);
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    error: 'DashScope流式响应错误',
                    code: 'STREAM_ERROR'
                })}\n\n`);
            });
        }
        catch (streamError) {
            console.warn('[AI-STREAM-FALLBACK] 流式请求失败，回退到传统方式:', streamError);
            // 如果流式请求失败，回退到传统方式
            try {
                const dashScopeRequest = {
                    input: {
                        prompt: fullPrompt
                    },
                    parameters: {},
                    debug: {}
                };
                const response = await axios_1.default.post(config.DASHSCOPE_API_URL, dashScopeRequest, {
                    headers: {
                        'Authorization': `Bearer ${config.DASHSCOPE_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000
                });
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
                }
                else {
                    console.error('[AI-STREAM-FALLBACK-ERROR] 响应格式异常:', response.data);
                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        error: 'AI服务响应格式异常',
                        code: 'INVALID_RESPONSE'
                    })}\n\n`);
                }
            }
            catch (fallbackError) {
                console.error('[AI-STREAM-FALLBACK-ERROR] 回退请求也失败:', fallbackError);
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    error: 'AI服务完全不可用',
                    code: 'SERVICE_UNAVAILABLE'
                })}\n\n`);
            }
        }
        res.end();
    }
    catch (error) {
        console.error('[AI-STREAM-ERROR] 处理失败:', error instanceof Error ? error.message : '未知错误');
        res.write(`data: ${JSON.stringify({
            type: 'error',
            error: '服务器内部错误',
            code: 'INTERNAL_ERROR'
        })}\n\n`);
        res.end();
    }
});
// AI聊天API端点 - 传统非流式（保留兼容性）
app.post('/api/chat', async (req, res) => {
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
        let fullPrompt = message;
        if (contextMessages && contextMessages.length > 0) {
            // 限制上下文消息数量
            const limitedContext = contextMessages.slice(-config.CONTEXT_MESSAGE_COUNT);
            // 构建上下文
            const contextText = limitedContext.map((msg) => {
                const role = msg.role === 'user' ? '用户' : '助手';
                return `${role}: ${msg.content}`;
            }).join('\n');
            fullPrompt = `以下是之前的对话内容，请根据上下文回答用户的问题：\n\n${contextText}\n\n用户: ${message}`;
        }
        console.log(`[AI-REQUEST] 完整提示词长度: ${fullPrompt.length}`);
        // 转发请求到阿里云DashScope
        const dashScopeRequest = {
            input: {
                prompt: fullPrompt
            },
            parameters: {},
            debug: {}
        };
        const response = await axios_1.default.post(config.DASHSCOPE_API_URL, dashScopeRequest, {
            headers: {
                'Authorization': `Bearer ${config.DASHSCOPE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000 // 30秒超时
        });
        console.log(`[AI-RESPONSE] 状态: ${response.status}`);
        if (response.data && response.data.output && response.data.output.text) {
            res.json({
                success: true,
                message: response.data.output.text,
                timestamp: new Date().toISOString()
            });
        }
        else {
            console.error('[AI-ERROR] 响应格式异常:', response.data);
            res.status(500).json({
                error: 'AI服务响应格式异常',
                code: 'INVALID_RESPONSE'
            });
        }
    }
    catch (error) {
        console.error('[AI-ERROR] API调用失败:', error instanceof Error ? error.message : '未知错误');
        if (axios_1.default.isAxiosError(error)) {
            if (error.response) {
                // API返回了错误响应
                console.error('[AI-ERROR] API错误响应:', error.response.status, error.response.data);
                res.status(error.response.status).json({
                    error: 'AI服务暂时不可用',
                    code: 'API_ERROR',
                    details: error.response.data
                });
            }
            else if (error.code === 'ECONNABORTED') {
                // 请求超时
                res.status(408).json({
                    error: '请求超时，请稍后重试',
                    code: 'TIMEOUT'
                });
            }
            else {
                // 其他网络错误
                res.status(500).json({
                    error: '网络连接失败，请检查网络设置',
                    code: 'NETWORK_ERROR'
                });
            }
        }
        else {
            // 其他未知错误
            res.status(500).json({
                error: '服务器内部错误',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// 静态文件服务 - 提供React构建文件
app.use(express_1.default.static(path_1.default.join(__dirname, 'build')));
// 前端路由处理 - 所有非API请求都返回index.html
app.get('*', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, 'build', 'index.html'));
});
// 错误处理中间件
app.use((err, _req, res, _next) => {
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
exports.default = app;
//# sourceMappingURL=server.js.map