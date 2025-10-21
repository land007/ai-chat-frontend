/**
 * @fileoverview SSE消息转发工具
 * 提供通用的SSE消息转发功能，确保消息完整转发
 */

export interface SSEForwarderConfig {
  /** 目标SSE服务URL */
  targetUrl: string;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retryCount?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
}

export interface SSEForwarderCallbacks {
  /** 开始转发 */
  onStart?: () => void;
  /** 收到数据 */
  onData?: (data: string) => void;
  /** 转发完成 */
  onComplete?: () => void;
  /** 发生错误 */
  onError?: (error: Error) => void;
  /** 连接状态变化 */
  onConnectionChange?: (connected: boolean) => void;
}

export interface SSEEvent {
  type: string;
  data?: any;
  id?: string;
  event?: string;
  retry?: number;
}

/**
 * SSE消息转发器类
 * 负责将SSE消息完整转发到目标服务
 */
export class SSEForwarder {
  private config: SSEForwarderConfig;
  private callbacks: SSEForwarderCallbacks = {};
  private isConnected = false;
  private abortController: AbortController | null = null;
  private retryCount = 0;

  constructor(config: SSEForwarderConfig) {
    this.config = {
      timeout: 30000,
      retryCount: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: SSEForwarderCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * 开始转发SSE消息
   */
  async forwardSSE(requestBody: any): Promise<void> {
    console.log('[SSEForwarder] 开始转发SSE消息:', {
      targetUrl: this.config.targetUrl,
      requestBody: typeof requestBody === 'string' ? requestBody.substring(0, 100) + '...' : requestBody
    });

    try {
      this.abortController = new AbortController();
      this.callbacks.onStart?.();
      this.callbacks.onConnectionChange?.(true);
      this.isConnected = true;

      const response = await fetch(this.config.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...this.config.headers
        },
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      console.log('[SSEForwarder] 连接成功，开始接收数据');
      await this.processStream(response.body);

    } catch (error) {
      console.error('[SSEForwarder] 转发失败:', error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[SSEForwarder] 转发被中止');
        return;
      }

      // 重试逻辑
      if (this.retryCount < this.config.retryCount!) {
        this.retryCount++;
        console.log(`[SSEForwarder] 第${this.retryCount}次重试，${this.config.retryDelay}ms后重试`);
        
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return this.forwardSSE(requestBody);
      }

      this.callbacks.onError?.(error as Error);
      this.callbacks.onConnectionChange?.(false);
      this.isConnected = false;
    }
  }

  /**
   * 处理流式响应
   */
  private async processStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('[SSEForwarder] 流式响应完成');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // 处理SSE事件
        const events = this.parseSSEEvents(buffer);
        buffer = events.remainingBuffer;

        for (const event of events.events) {
          console.log('[SSEForwarder] 转发事件:', event);
          this.callbacks.onData?.(JSON.stringify(event));
        }
      }

      this.callbacks.onComplete?.();
      this.callbacks.onConnectionChange?.(false);
      this.isConnected = false;

    } catch (error) {
      console.error('[SSEForwarder] 处理流时出错:', error);
      this.callbacks.onError?.(error as Error);
      this.callbacks.onConnectionChange?.(false);
      this.isConnected = false;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 解析SSE事件
   */
  private parseSSEEvents(buffer: string): { events: SSEEvent[], remainingBuffer: string } {
    const events: SSEEvent[] = [];
    const lines = buffer.split('\n');
    const remainingBuffer = lines.pop() || '';

    let currentEvent: Partial<SSEEvent> = {};
    let eventData = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        // 空行表示事件结束
        if (Object.keys(currentEvent).length > 0) {
          events.push({
            type: currentEvent.event || 'message',
            data: eventData,
            id: currentEvent.id,
            retry: currentEvent.retry
          });
        }
        currentEvent = {};
        eventData = '';
        continue;
      }

      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex === -1) continue;

      const field = trimmedLine.substring(0, colonIndex);
      const value = trimmedLine.substring(colonIndex + 1).trim();

      switch (field) {
        case 'event':
          currentEvent.event = value;
          break;
        case 'id':
          currentEvent.id = value;
          break;
        case 'retry':
          currentEvent.retry = parseInt(value, 10);
          break;
        case 'data':
          eventData += (eventData ? '\n' : '') + value;
          break;
      }
    }

    return { events, remainingBuffer };
  }

  /**
   * 停止转发
   */
  stop(): void {
    console.log('[SSEForwarder] 停止转发');
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isConnected = false;
    this.callbacks.onConnectionChange?.(false);
  }

  /**
   * 检查是否已连接
   */
  isConnectedToTarget(): boolean {
    return this.isConnected;
  }

  /**
   * 获取重试次数
   */
  getRetryCount(): number {
    return this.retryCount;
  }
}

/**
 * 创建SSE转发器实例
 */
export function createSSEForwarder(config: SSEForwarderConfig): SSEForwarder {
  return new SSEForwarder(config);
}

/**
 * 通用SSE转发函数
 * 简化版本的SSE转发，适用于简单场景
 */
export async function forwardSSE(
  targetUrl: string,
  requestBody: any,
  callbacks: SSEForwarderCallbacks = {},
  options: Partial<SSEForwarderConfig> = {}
): Promise<void> {
  const forwarder = createSSEForwarder({
    targetUrl,
    ...options
  });
  
  forwarder.setCallbacks(callbacks);
  return forwarder.forwardSSE(requestBody);
}

export default SSEForwarder;
