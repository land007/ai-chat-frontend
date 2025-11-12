/**
 * 语音识别WebSocket客户端服务
 * 连接到后端WebSocket代理，实现实时语音识别
 */

import { SpeechRecognitionConfig, SpeechRecognitionEvent } from '@/types';

class SpeechRecognitionService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isSessionStarted = false; // 会话是否已启动（关键：确保收到ready消息）
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;

  private transcriptCallbacks: Array<(text: string, isFinal: boolean) => void> = [];
  private errorCallbacks: Array<(error: string) => void> = [];
  private completeCallbacks: Array<() => void> = [];
  private closeCallbacks: Array<() => void> = [];
  
  // 用于保存connect Promise的resolve和reject
  private connectResolve: (() => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;

  /**
   * 获取WebSocket URL（方案1：在URL参数中传递配置）
   */
  private getWebSocketUrl(config: SpeechRecognitionConfig): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const params = new URLSearchParams({
      mode: config.mode,
      language: config.language
    });
    return `${protocol}//${host}/api/ws/speech-recognition?${params.toString()}`;
  }

  /**
   * 连接WebSocket（方案1：在连接时传递配置参数）
   */
  private connect(config: SpeechRecognitionConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.getWebSocketUrl(config);
      console.log('[语音识别] 连接WebSocket（方案1：URL参数传递配置）:', url);

      // 保存resolve和reject，等待ready消息
      let connectResolve: (() => void) | null = resolve;
      let connectReject: ((error: Error) => void) | null = reject;

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[语音识别] WebSocket连接已建立，后端将自动初始化适配器，等待ready消息...');
          this.isConnected = true;
          this.isSessionStarted = false; // 等待ready消息后才确认会话已启动
          this.reconnectAttempts = 0;
          // 不立即resolve，等待ready消息
        };

        this.ws.onmessage = (event) => {
          try {
            // 检查是否是二进制消息（音频数据）
            if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
              // 二进制消息，忽略（音频数据是从客户端发送到服务端的）
              return;
            }
            
            // 文本消息，解析JSON
            const data: SpeechRecognitionEvent = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[语音识别] 解析消息失败:', error);
            this.emitError('解析消息失败');
            // 如果连接过程中出错，reject连接Promise
            if (this.connectReject && !this.isSessionStarted) {
              this.connectReject(new Error('解析消息失败'));
              this.connectReject = null;
            }
          }
        };

        this.ws.onclose = (event) => {
          console.log('[语音识别] WebSocket连接已关闭:', event.code, event.reason);
          this.isConnected = false;
          this.isSessionStarted = false; // 重置会话状态
          this.ws = null;
          
          // 如果连接过程中关闭，reject连接Promise
          if (this.connectReject && !this.isSessionStarted) {
            this.connectReject(new Error('连接已关闭'));
            this.connectReject = null;
          }

          // 触发关闭回调（用于清理资源）
          this.emitClose();

          // 注意：重连需要配置信息，但这里没有保存，所以不支持自动重连
          // 如果需要重连，需要调用 start() 方法
        };

        this.ws.onerror = (error) => {
          console.error('[语音识别] WebSocket错误:', error);
          this.isConnected = false;
          if (this.connectReject) {
            this.connectReject(new Error('WebSocket连接失败'));
            this.connectReject = null;
          }
        };

        // 保存resolve和reject
        this.connectResolve = connectResolve;
        this.connectReject = connectReject;

        // 连接超时
        setTimeout(() => {
          if (!this.isSessionStarted && this.ws) {
            this.ws.close();
            if (this.connectReject) {
              this.connectReject(new Error('连接超时：未收到ready消息'));
              this.connectReject = null;
            }
          }
        }, 10000);
      } catch (error) {
        console.error('[语音识别] 创建WebSocket连接失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: SpeechRecognitionEvent) {
    console.log('[语音识别] 收到消息:', data);

    if (data.type === 'ready') {
      // 通路完全打通，确认连接成功
      console.log('[语音识别] ✅ 收到ready消息，通路完全打通');
      this.isSessionStarted = true;
      // 如果有等待连接的Promise，现在resolve它
      if (this.connectResolve) {
        this.connectResolve();
        this.connectResolve = null;
      }
    } else if (data.type === 'transcript') {
      // 识别结果
      if (data.text !== undefined && data.isFinal !== undefined) {
        this.emitTranscript(data.text, data.isFinal);
      }
    } else if (data.type === 'error') {
      // 错误
      this.emitError(data.message || '未知错误');
      // 如果连接过程中出错，reject连接Promise
      if (this.connectReject && !this.isSessionStarted) {
        this.connectReject(new Error(data.message || '未知错误'));
        this.connectReject = null;
      }
    } else if (data.type === 'complete') {
      // 完成
      this.emitComplete();
    }
  }

  /**
   * 发送消息
   */
  private sendMessage(message: any) {
    if (!this.ws || !this.isConnected) {
      console.error('[语音识别] WebSocket未连接，无法发送消息:', message);
      throw new Error('WebSocket未连接');
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error('[语音识别] WebSocket未打开，状态:', this.ws.readyState, '无法发送消息:', message);
      throw new Error('WebSocket未打开');
    }

    const messageStr = JSON.stringify(message);
    console.log('[语音识别] 发送消息:', message.type, '长度:', messageStr.length, 'bytes');
    this.ws.send(messageStr);
  }

  /**
   * 开始识别会话（方案1：在连接时通过URL参数传递配置）
   */
  async start(config: SpeechRecognitionConfig): Promise<void> {
    console.log('[语音识别] 开始启动会话（方案1：URL参数传递配置）:', config);
    
    try {
      // 如果已连接，先关闭
      if (this.ws) {
        console.log('[语音识别] 发现已有WebSocket连接，先关闭');
        await this.close();
      }

      // 重置会话状态
      this.isSessionStarted = false;
      console.log('[语音识别] 会话状态已重置');

      // 连接WebSocket（方案1：在连接时传递配置参数，后端自动初始化）
      console.log('[语音识别] 开始连接WebSocket（配置通过URL参数传递）...');
      await this.connect(config);
      console.log('[语音识别] ✅ WebSocket连接成功，后端已自动初始化适配器');
      console.log('[语音识别] ✅ 会话已启动，模式:', config.mode, 'isSessionStarted:', this.isSessionStarted);
    } catch (error: any) {
      console.error('[语音识别] ❌ 启动会话失败:', error);
      this.isSessionStarted = false;
      throw error;
    }
  }

  /**
   * 发送音频数据（使用二进制消息，参考微软SDK）
   */
  async sendAudio(audioData: ArrayBuffer): Promise<void> {
    // 检查连接状态，如果未连接则抛出错误（由调用方处理暂存）
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket未连接');
    }

    // 关键：检查会话是否已启动
    // 如果会话未启动，抛出错误（由调用方暂存，等待会话启动）
    if (!this.isSessionStarted) {
      throw new Error('会话未启动');
    }

    // 参考微软SDK：直接发送二进制数据，而不是base64编码的JSON
    // 使用二进制消息发送，提高传输效率
    this.ws.send(audioData);
  }

  /**
   * 提交音频（Manual模式）
   */
  async commit(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('WebSocket未连接');
    }

    this.sendMessage({
      type: 'commit'
    });

    console.log('[语音识别] 音频已提交');
  }

  /**
   * 停止识别（用户松手时调用，通知服务器关闭连接）
   */
  async stop(): Promise<void> {
    if (!this.isConnected) {
      console.warn('[语音识别] WebSocket未连接，无法发送stop消息');
      return;
    }

    try {
      this.sendMessage({
        type: 'stop'
      });
      console.log('[语音识别] 已发送stop消息，等待服务器关闭连接');
    } catch (error: any) {
      console.error('[语音识别] 发送stop消息失败:', error.message);
      // 如果发送失败，直接关闭连接
      await this.close();
    }
  }

  /**
   * 关闭连接（仅在需要主动关闭时调用，正常情况下由服务器关闭）
   */
  async close(): Promise<void> {
    this.isConnected = false;
    this.isSessionStarted = false; // 重置会话状态

    if (this.ws) {
      this.ws.close(1000, 'Client closed');
      this.ws = null;
    }

    console.log('[语音识别] 连接已关闭');
  }

  /**
   * 注册识别结果回调
   */
  onTranscript(callback: (text: string, isFinal: boolean) => void) {
    this.transcriptCallbacks.push(callback);
  }

  /**
   * 注册错误回调
   */
  onError(callback: (error: string) => void) {
    this.errorCallbacks.push(callback);
  }

  /**
   * 注册完成回调
   */
  onComplete(callback: () => void) {
    this.completeCallbacks.push(callback);
  }

  /**
   * 注册关闭回调（连接关闭时触发，用于清理资源）
   */
  onClose(callback: () => void) {
    this.closeCallbacks.push(callback);
  }

  /**
   * 移除回调
   */
  removeCallbacks() {
    this.transcriptCallbacks = [];
    this.errorCallbacks = [];
    this.completeCallbacks = [];
    this.closeCallbacks = [];
  }

  /**
   * 触发识别结果事件
   */
  private emitTranscript(text: string, isFinal: boolean) {
    this.transcriptCallbacks.forEach(cb => cb(text, isFinal));
  }

  /**
   * 触发错误事件
   */
  private emitError(error: string) {
    this.errorCallbacks.forEach(cb => cb(error));
  }

  /**
   * 触发完成事件
   */
  private emitComplete() {
    this.completeCallbacks.forEach(cb => cb());
  }

  /**
   * 触发关闭事件
   */
  private emitClose() {
    this.closeCallbacks.forEach(cb => cb());
  }

  /**
   * 将ArrayBuffer转换为base64（已废弃，现在使用二进制消息）
   * 保留此方法以备后用
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * 检查连接状态（关键：必须连接且会话已启动）
   */
  isReady(): boolean {
    const ready = this.isConnected && this.isSessionStarted && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    
    // 调试日志：如果返回 false，记录原因
    if (!ready) {
      console.debug('[语音识别] isReady() 返回 false:', {
        isConnected: this.isConnected,
        isSessionStarted: this.isSessionStarted,
        wsNotNull: this.ws !== null,
        wsReadyState: this.ws?.readyState,
        wsReadyStateText: this.ws ? (this.ws.readyState === WebSocket.CONNECTING ? 'CONNECTING' : 
                                     this.ws.readyState === WebSocket.OPEN ? 'OPEN' : 
                                     this.ws.readyState === WebSocket.CLOSING ? 'CLOSING' : 
                                     this.ws.readyState === WebSocket.CLOSED ? 'CLOSED' : 'UNKNOWN') : 'null'
      });
    }
    
    return ready;
  }
}

// 导出单例实例
export const speechRecognitionService = new SpeechRecognitionService();

