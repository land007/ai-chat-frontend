// API服务 - 通过本地后端代理调用阿里云DashScope
import { 
  ChatMessage, 
  ChatResponse, 
  ChatError, 
  StreamChunk
} from '@/types';
import { authService } from './auth';

class ChatAPI {
  private readonly apiUrl = '/api/chat';

  /**
   * 获取认证header
   */
  private getAuthHeaders(): HeadersInit {
    const token = authService.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  async sendMessage(message: string, contextMessages: ChatMessage[] = []): Promise<string> {
    try {
      console.log(`[前端API] 发送消息: ${message}`);
      console.log(`[前端API] 上下文消息数量: ${contextMessages.length}`);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          message: message,
          contextMessages: contextMessages,
          stream: false
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

  async sendMessageStream(
    message: string, 
    contextMessages: ChatMessage[] = [],
    onChunk: (content: string, done: boolean) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      console.log(`[前端API-流式] 发送消息: ${message}`);
      console.log(`[前端API-流式] 上下文消息数量: ${contextMessages.length}`);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          message: message,
          contextMessages: contextMessages,
          stream: true
        })
      });

      if (!response.ok) {
        const errorData: ChatError = await response.json();
        throw new Error(`API请求失败: ${errorData.error} (${errorData.code})`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('[前端API-流式] 流式传输完成');
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留不完整的行

          for (const line of lines) {
            if (line.trim() === '') continue;
            
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                console.log('[前端API-流式] 收到完成信号');
                onChunk('', true);
                return;
              }

              try {
                const chunk: StreamChunk = JSON.parse(data);
                console.log(`[前端API-流式] 收到数据块: ${chunk.content.length} 字符`);
                onChunk(chunk.content, chunk.done);
                
                if (chunk.done) {
                  return;
                }
              } catch (parseError) {
                console.error('[前端API-流式] JSON解析错误:', parseError);
                console.error('[前端API-流式] 原始数据:', data);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error('[前端API-流式] 调用错误:', error);
      const errorMessage = error instanceof Error ? error.message : '发送消息失败，请稍后重试';
      onError?.(errorMessage);
    }
  }
}

export const chatAPI = new ChatAPI();

