/**
 * 语音识别WebSocket客户端服务
 * 连接到后端WebSocket代理，实现实时语音识别
 */

import { SpeechRecognitionConfig, SpeechRecognitionEvent } from '@/types';

class SpeechRecognitionService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;

  private transcriptCallbacks: Array<(text: string, isFinal: boolean) => void> = [];
  private errorCallbacks: Array<(error: string) => void> = [];
  private completeCallbacks: Array<() => void> = [];

  /**
   * 获取WebSocket URL
   */
  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/api/ws/speech-recognition`;
  }

  /**
   * 连接WebSocket
   */
  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.getWebSocketUrl();
      console.log('[语音识别] 连接WebSocket:', url);

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[语音识别] WebSocket连接已建立');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: SpeechRecognitionEvent = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[语音识别] 解析消息失败:', error);
            this.emitError('解析消息失败');
          }
        };

        this.ws.onclose = (event) => {
          console.log('[语音识别] WebSocket连接已关闭:', event.code, event.reason);
          this.isConnected = false;
          this.ws = null;

          // 如果不是正常关闭，尝试重连
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[语音识别] 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => {
              this.connect().catch(err => {
                console.error('[语音识别] 重连失败:', err);
                this.emitError('连接失败，请重试');
              });
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[语音识别] WebSocket错误:', error);
          this.isConnected = false;
          reject(new Error('WebSocket连接失败'));
        };

        // 连接超时
        setTimeout(() => {
          if (!this.isConnected && this.ws) {
            this.ws.close();
            reject(new Error('连接超时'));
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

    if (data.type === 'transcript') {
      // 识别结果
      if (data.text !== undefined && data.isFinal !== undefined) {
        this.emitTranscript(data.text, data.isFinal);
      }
    } else if (data.type === 'error') {
      // 错误
      this.emitError(data.message || '未知错误');
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
      throw new Error('WebSocket未连接');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * 开始识别会话
   */
  async start(config: SpeechRecognitionConfig): Promise<void> {
    // 如果已连接，先关闭
    if (this.ws) {
      await this.close();
    }

    // 连接WebSocket
    await this.connect();

    // 发送开始消息
    this.sendMessage({
      type: 'start',
      mode: config.mode,
      language: config.language
    });

    console.log('[语音识别] 会话已启动，模式:', config.mode);
  }

  /**
   * 发送音频数据
   */
  async sendAudio(audioData: ArrayBuffer): Promise<void> {
    if (!this.isConnected) {
      throw new Error('WebSocket未连接');
    }

    // 将ArrayBuffer转换为base64
    const base64 = this.arrayBufferToBase64(audioData);

    this.sendMessage({
      type: 'audio',
      data: base64
    });
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
   * 关闭连接
   */
  async close(): Promise<void> {
    this.isConnected = false;

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
   * 移除回调
   */
  removeCallbacks() {
    this.transcriptCallbacks = [];
    this.errorCallbacks = [];
    this.completeCallbacks = [];
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
   * 将ArrayBuffer转换为base64
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
   * 检查连接状态
   */
  isReady(): boolean {
    return this.isConnected && this.ws !== null;
  }
}

// 导出单例实例
export const speechRecognitionService = new SpeechRecognitionService();

