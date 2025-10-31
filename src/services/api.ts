// API服务 - 通过本地后端代理调用阿里云DashScope
import { 
  ChatMessage, 
  ChatResponse, 
  ChatError, 
  StreamChunk,
  FeedbackListResponse,
  FeedbackDetailResponse
} from '@/types';
import { authService } from './auth';

class ChatAPI {
  private readonly apiUrl = '/api/chat';
  private readonly suggestUrl = '/api/fast/suggest';
  private readonly feedbackUrl = '/api/feedback';
  private currentAbortController: AbortController | null = null;

  /**
   * 中止当前请求
   */
  abortCurrentRequest(): void {
    if (this.currentAbortController) {
      console.log('[前端API] 中止当前请求');
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

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

  async sendMessage(message: string, contextMessages: ChatMessage[] = [], signal?: AbortSignal): Promise<string> {
    try {
      console.log(`[前端API] 发送消息: ${message}`);
      console.log(`[前端API] 上下文消息数量: ${contextMessages.length}`);

      // 创建新的 AbortController
      const abortController = new AbortController();
      this.currentAbortController = abortController;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          message: message,
          contextMessages: contextMessages,
          stream: false
        }),
        signal: signal || abortController.signal
      });

      if (!response.ok) {
        const errorData: ChatError = await response.json();
        throw new Error(`API请求失败: ${errorData.error} (${errorData.code})`);
      }

      const data: ChatResponse = await response.json();
      console.log(`[前端API] 收到响应: ${data.message}`);

      return data.message;
    } catch (error) {
      // 检查是否是用户主动中止
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[前端API] 请求已被中止');
        throw error;
      }
      console.error('[前端API] 调用错误:', error);
      throw new Error('发送消息失败，请稍后重试');
    } finally {
      this.currentAbortController = null;
    }
  }

  async sendMessageStream(
    message: string, 
    contextMessages: ChatMessage[] = [],
    onChunk: (content: string, done: boolean) => void,
    onError?: (error: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      console.log(`[前端API-流式] 发送消息: ${message}`);
      console.log(`[前端API-流式] 上下文消息数量: ${contextMessages.length}`);

      // 创建新的 AbortController
      const abortController = new AbortController();
      this.currentAbortController = abortController;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          message: message,
          contextMessages: contextMessages,
          stream: true
        }),
        signal: signal || abortController.signal
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
      // 检查是否是用户主动中止
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[前端API-流式] 请求已被中止');
        onError?.('请求已取消');
        return;
      }
      console.error('[前端API-流式] 调用错误:', error);
      const errorMessage = error instanceof Error ? error.message : '发送消息失败，请稍后重试';
      onError?.(errorMessage);
    } finally {
      this.currentAbortController = null;
    }
  }

  /**
   * 保存用户反馈
   */
  async saveFeedback(
    feedback: 'like' | 'dislike',
    messages: ChatMessage[],
    messageId: string
  ): Promise<{ success: boolean; message: string; filename: string }> {
    try {
      console.log(`[前端API-反馈] 保存反馈: ${feedback}, 消息数: ${messages.length}`);

      const response = await fetch(this.feedbackUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          feedback,
          messages,
          messageId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`保存反馈失败: ${errorData.error}`);
      }

      const data = await response.json();
      console.log(`[前端API-反馈] 保存成功: ${data.filename}`);

      return data;
    } catch (error) {
      console.error('[前端API-反馈] 保存错误:', error);
      throw new Error('保存反馈失败，请稍后重试');
    }
  }

  /**
   * 获取反馈列表（管理员）
   */
  async getFeedbackList(
    page: number = 1,
    pageSize: number = 20,
    type: 'all' | 'like' | 'dislike' = 'all'
  ): Promise<FeedbackListResponse> {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        type: type
      });

      const response = await fetch(`${this.feedbackUrl}/list?${params}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`获取反馈列表失败: ${errorData.error}`);
      }

      const data: FeedbackListResponse = await response.json();
      console.log(`[前端API-反馈列表] 获取成功, 总数: ${data.pagination.total}`);

      return data;
    } catch (error) {
      console.error('[前端API-反馈列表] 获取错误:', error);
      throw error;
    }
  }

  /**
   * 获取反馈详情（管理员）
   */
  async getFeedbackDetail(filename: string): Promise<FeedbackDetailResponse> {
    try {
      const response = await fetch(`${this.feedbackUrl}/${filename}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`获取反馈详情失败: ${errorData.error}`);
      }

      const data: FeedbackDetailResponse = await response.json();
      console.log(`[前端API-反馈详情] 获取成功: ${filename}`);

      return data;
    } catch (error) {
      console.error('[前端API-反馈详情] 获取错误:', error);
      throw error;
    }
  }
}

export const chatAPI = new ChatAPI();

