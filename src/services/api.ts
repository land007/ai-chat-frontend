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
  private readonly suggestUrl = '/api/fast/suggest';

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

  async getFastSuggestions(answer: string, userQuestion: string = '', count?: number): Promise<string[]> {
    try {
      const response = await fetch(this.suggestUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ answer, userQuestion, count })
      });
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      if (Array.isArray(data?.suggestions)) return data.suggestions as string[];
      return [];
    } catch (e) {
      return [];
    }
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
      let accumulatedContent = ''; // 前端累积完整内容
      let chunkCount = 0; // 数据块计数

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('[前端API-流式] 流式传输完成');
            // 输出累积的完整内容
            console.log(`[前端API-流式] 累积内容总结:`, {
              totalChunks: chunkCount,
              totalLength: accumulatedContent.length,
              contentPreview: accumulatedContent.slice(0, 200) + (accumulatedContent.length > 200 ? '...' : ''),
              fullContent: accumulatedContent
            });
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
                // 输出累积的完整内容
                console.log(`[前端API-流式] 累积内容总结:`, {
                  totalChunks: chunkCount,
                  totalLength: accumulatedContent.length,
                  contentPreview: accumulatedContent.slice(0, 200) + (accumulatedContent.length > 200 ? '...' : ''),
                  fullContent: accumulatedContent
                });
                // 传递最终累积的完整内容，避免为空导致后续建议接口answer为空
                onChunk(accumulatedContent, true);
                return;
              }

              try {
                const chunk: StreamChunk = JSON.parse(data);
                chunkCount++;
                
                // 后端现在发送的是增量内容，需要在前端累积
                accumulatedContent += chunk.content;
                
                console.log(`[前端API-流式] 收到增量 #${chunkCount}: +${chunk.content.length}字符, 总长度:${accumulatedContent.length}`);
                
                // 传递累积后的完整内容给回调
                onChunk(accumulatedContent, chunk.done);
                
                if (chunk.done) {
                  // 输出累积的完整内容
                  console.log(`[前端API-流式] 累积内容总结:`, {
                    totalChunks: chunkCount,
                    totalLength: accumulatedContent.length,
                    contentPreview: accumulatedContent.slice(0, 200) + (accumulatedContent.length > 200 ? '...' : ''),
                    fullContent: accumulatedContent
                  });
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

