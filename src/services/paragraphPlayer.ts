/**
 * 段落播放器 - 管理段落队列播放、处理音频生成和播放、错误重试机制
 */

import { TTSAdapter, TTSOptions } from './ttsAdapter';

export interface PlayerCallbacks {
  onProgress?: (progress: number) => void;
  onParagraphChange?: (paragraph: string, index: number) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface PlayOptions extends TTSOptions {
  retryCount?: number;
  retryDelay?: number;
}

export interface CurrentParagraph {
  text: string;
  index: number;
}

/**
 * 段落播放器类
 */
export class ParagraphPlayer {
  private adapter: TTSAdapter;
  private callbacks: PlayerCallbacks = {};
  private currentParagraphs: string[] = [];
  private currentParagraphIndex: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;
  private nextAudio: HTMLAudioElement | null = null;
  private playOptions: PlayOptions = {};

  constructor(adapter: TTSAdapter) {
    this.adapter = adapter;
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: PlayerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 播放段落队列
   * @param paragraphs 段落数组
   * @param options 播放选项
   */
  async play(paragraphs: string[], options: PlayOptions = {}): Promise<void> {
    if (!this.adapter.isAvailable()) {
      const error = new Error('TTS服务不可用');
      this.callbacks.onError?.(error);
      throw error;
    }

    console.log('[ParagraphPlayer] 开始播放段落队列:', paragraphs.length, '个段落');

    this.currentParagraphs = [...paragraphs];
    this.currentParagraphIndex = 0;
    this.isPlaying = true;
    this.isPaused = false;
    this.playOptions = { retryCount: 1, retryDelay: 1000, ...options };

    try {
      await this.playCurrentAndPrepareNext();
    } catch (error) {
      console.error('[ParagraphPlayer] 播放失败:', error);
      this.isPlaying = false;
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * 暂停播放
   */
  pause(): void {
    if (this.isPlaying && !this.isPaused) {
      console.log('[ParagraphPlayer] 暂停播放');
      this.isPaused = true;
      
      if (this.currentAudio) {
        this.currentAudio.pause();
      }
    }
  }

  /**
   * 恢复播放
   */
  resume(): void {
    if (this.isPlaying && this.isPaused) {
      console.log('[ParagraphPlayer] 恢复播放');
      this.isPaused = false;
      
      if (this.currentAudio) {
        this.currentAudio.play().catch(error => {
          console.error('[ParagraphPlayer] 恢复播放失败:', error);
          this.callbacks.onError?.(error);
        });
      }
    }
  }

  /**
   * 停止播放
   */
  stop(): void {
    console.log('[ParagraphPlayer] 停止播放');
    this.isPlaying = false;
    this.isPaused = false;
    this.currentParagraphIndex = 0;
    this.currentParagraphs = [];

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    if (this.nextAudio) {
      this.nextAudio.pause();
      this.nextAudio = null;
    }
  }

  /**
   * 获取当前播放的段落信息
   */
  getCurrentParagraph(): CurrentParagraph | null {
    if (this.currentParagraphIndex < this.currentParagraphs.length) {
      return {
        text: this.currentParagraphs[this.currentParagraphIndex],
        index: this.currentParagraphIndex
      };
    }
    return null;
  }

  /**
   * 获取播放状态
   */
  getPlaybackState(): {
    isPlaying: boolean;
    isPaused: boolean;
    currentIndex: number;
    totalParagraphs: number;
    progress: number;
  } {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentIndex: this.currentParagraphIndex,
      totalParagraphs: this.currentParagraphs.length,
      progress: this.currentParagraphs.length > 0 ? this.currentParagraphIndex / this.currentParagraphs.length : 0
    };
  }

  /**
   * 播放当前段落并准备下一个段落
   */
  private async playCurrentAndPrepareNext(): Promise<void> {
    if (this.currentParagraphIndex >= this.currentParagraphs.length) {
      // 所有段落播放完成
      console.log('[ParagraphPlayer] 所有段落播放完成');
      this.isPlaying = false;
      this.currentAudio = null;
      this.nextAudio = null;
      this.currentParagraphs = [];
      this.currentParagraphIndex = 0;
      this.callbacks.onComplete?.();
      return;
    }

    const currentParagraph = this.currentParagraphs[this.currentParagraphIndex];
    console.log(`[ParagraphPlayer] 播放第${this.currentParagraphIndex + 1}个段落:`, currentParagraph);

    // 通知段落切换
    this.callbacks.onParagraphChange?.(currentParagraph, this.currentParagraphIndex);

    try {
      // 生成当前段落的音频URL
      const audioUrl = await this.adapter.generateAudioUrl(currentParagraph, this.playOptions);
      
      // 播放当前段落
      await this.playSingleAudio(audioUrl, currentParagraph);
      
      // 播放完成后，切换到下一个段落
      this.currentParagraphIndex++;
      if (this.isPlaying) {
        // 无缝播放下一个段落
        await this.playCurrentAndPrepareNext();
      }
    } catch (error) {
      console.error('[ParagraphPlayer] 段落播放错误:', error);
      
      // 重试机制
      const retryCount = this.playOptions.retryCount || 1;
      if (retryCount > 0) {
        console.log(`[ParagraphPlayer] 重试播放段落 (剩余重试次数: ${retryCount}):`, currentParagraph);
        
        // 更新重试次数
        this.playOptions.retryCount = retryCount - 1;
        
        // 延迟后重试
        if (this.playOptions.retryDelay) {
          await new Promise(resolve => setTimeout(resolve, this.playOptions.retryDelay));
        }
        
        try {
          const audioUrl = await this.adapter.generateAudioUrl(currentParagraph, this.playOptions);
          await this.playSingleAudio(audioUrl, currentParagraph);
          
          // 重试成功后继续
          this.currentParagraphIndex++;
          if (this.isPlaying) {
            await this.playCurrentAndPrepareNext();
          }
        } catch (retryError) {
          console.error('[ParagraphPlayer] 重试失败，跳过段落:', retryError);
          // 重试失败，跳过当前段落
          this.currentParagraphIndex++;
          if (this.isPlaying) {
            await this.playCurrentAndPrepareNext();
          }
        }
      } else {
        console.error('[ParagraphPlayer] 重试次数用完，跳过段落');
        // 重试次数用完，跳过当前段落
        this.currentParagraphIndex++;
        if (this.isPlaying) {
          await this.playCurrentAndPrepareNext();
        }
      }
    }
  }

  /**
   * 播放单个音频
   * @param audioUrl 音频URL
   * @param paragraph 段落文本
   */
  private async playSingleAudio(audioUrl: string, paragraph: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      audio.onloadeddata = () => {
        console.log('[ParagraphPlayer] 音频加载完成:', paragraph);
      };

      audio.oncanplaythrough = () => {
        console.log('[ParagraphPlayer] 音频可以播放:', paragraph);
      };

      audio.onplay = () => {
        console.log('[ParagraphPlayer] 开始播放音频:', paragraph);
      };

      audio.onended = () => {
        console.log('[ParagraphPlayer] 音频播放完成:', paragraph);
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = (error) => {
        console.error('[ParagraphPlayer] 音频播放错误:', error);
        this.currentAudio = null;
        reject(new Error(`音频播放失败: ${paragraph}`));
      };

      audio.onpause = () => {
        console.log('[ParagraphPlayer] 音频暂停:', paragraph);
      };

      // 开始播放
      audio.play().catch(error => {
        console.error('[ParagraphPlayer] 播放失败:', error);
        this.currentAudio = null;
        reject(error);
      });
    });
  }

  /**
   * 预加载下一个段落的音频
   * @param paragraph 段落文本
   */
  private async preloadNextAudio(paragraph: string): Promise<void> {
    try {
      const audioUrl = await this.adapter.generateAudioUrl(paragraph, this.playOptions);
      const audio = new Audio(audioUrl);
      
      audio.preload = 'metadata';
      this.nextAudio = audio;
      
      console.log('[ParagraphPlayer] 预加载下一个段落音频:', paragraph);
    } catch (error) {
      console.error('[ParagraphPlayer] 预加载失败:', error);
    }
  }
}
