// API服务 - 通过本地后端代理调用阿里云DashScope
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface ChatResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

export interface ChatError {
  error: string;
  code: string;
  details?: any;
}

class ChatAPI {
  private readonly apiUrl = '/api/chat';

  async sendMessage(message: string): Promise<string> {
    try {
      console.log(`[前端API] 发送消息: ${message}`);
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message
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
}

export const chatAPI = new ChatAPI();

