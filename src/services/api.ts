// API服务 - 通过本地后端代理调用阿里云DashScope
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  feedback?: 'like' | 'dislike' | null;
  retryCount?: number;
}

export interface ChatResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

export interface ChatError {
  error: string;
  code: string;
  details?: unknown;
}

// SSE流式响应事件类型
export interface SSEEvent {
  type: 'start' | 'content' | 'done' | 'error';
  content?: string;
  error?: string;
  code?: string;
  details?: unknown;
  timestamp: string;
}

// SSE流式回调接口
export interface SSEStreamCallbacks {
  onStart?: () => void;
  onContent?: (content: string) => void;
  onDone?: () => void;
  onError?: (error: string, code?: string) => void;
}

class ChatAPI {
  private readonly apiUrl = '/api/chat';
  private readonly streamApiUrl = '/api/chat/stream';

  // 传统非流式API（保留兼容性）
  async sendMessage(message: string, contextMessages: ChatMessage[] = []): Promise<string> {
    try {
      console.log(`[前端API] 发送消息: ${message}`);
      console.log(`[前端API] 上下文消息数量: ${contextMessages.length}`);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          contextMessages: contextMessages
        })
      });

      if (!response.ok) {
        const errorData: ChatError = await response.json();
        throw new Error(`API请求失败: ${errorData.error} (${errorData.code})`);
      }

      const data: ChatResponse = await response.json();
      console.log(`[前端API] 收到响应: ${data.message}`);

      return data.message;
    } catch (error) {
      console.error('[前端API] 调用错误:', error);
      throw new Error('发送消息失败，请稍后重试');
    }
  }

  // SSE流式API
  async sendMessageStream(
    message: string, 
    contextMessages: ChatMessage[] = [],
    callbacks: SSEStreamCallbacks = {}
  ): Promise<void> {
    try {
      console.log(`[前端SSE-API] 发送流式消息: ${message}`);
      console.log(`[前端SSE-API] 上下文消息数量: ${contextMessages.length}`);

      const response = await fetch(this.streamApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          contextMessages: contextMessages
        })
      });

      if (!response.ok) {
        const errorData: ChatError = await response.json();
        throw new Error(`SSE请求失败: ${errorData.error} (${errorData.code})`);
      }

      if (!response.body) {
        throw new Error('SSE响应体为空');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('[前端SSE-API] 流式响应完成');
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          console.log('[前端SSE-API] 收到原始数据块:', value.length, '字节');
          console.log('[前端SSE-API] 当前缓冲区内容:', buffer);
          
          // 处理SSE事件
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个不完整的行

          let currentEvent = '';
          for (const line of lines) {
            console.log('[前端SSE-API] 处理行:', line);
            
            if (line.trim() === '') {
              // 空行表示事件结束
              if (currentEvent.startsWith('data: ')) {
                try {
                  const eventData: SSEEvent = JSON.parse(currentEvent.slice(6));
                  console.log(`[前端SSE-API] 收到事件:`, eventData);

                  switch (eventData.type) {
                    case 'start':
                      callbacks.onStart?.();
                      break;
                    case 'content':
                      if (eventData.content) {
                        callbacks.onContent?.(eventData.content);
                      }
                      break;
                    case 'done':
                      callbacks.onDone?.();
                      return; // 流式响应完成
                    case 'error':
                      callbacks.onError?.(eventData.error || '未知错误', eventData.code);
                      return; // 发生错误，结束流
                  }
                } catch (parseError) {
                  console.warn('[前端SSE-API] 解析事件数据失败:', parseError);
                  console.warn('[前端SSE-API] 原始事件:', currentEvent);
                }
              }
              currentEvent = '';
            } else if (line.startsWith('data: ')) {
              currentEvent = line;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error('[前端SSE-API] 流式调用错误:', error);
      callbacks.onError?.(error instanceof Error ? error.message : '流式请求失败');
    }
  }
}

export const chatAPI = new ChatAPI();

