/**
 * @fileoverview TTS编排器
 * 组装所有TTS相关模块，提供统一的TTS功能接口
 */

import { splitIntoParagraphs } from '../utils/paragraphSplitter';
import { TTSAdapter, TTSConfig, TTSOptions } from '../services/ttsAdapter';
import { ParagraphPlayer, PlayerCallbacks, PlayOptions } from '../services/paragraphPlayer';
import { HighlightRendererProps } from '../components/HighlightRenderer';

export interface TTSOrchestratorConfig {
  /** TTS配置 */
  tts: TTSConfig;
  /** 段落分割选项 */
  paragraphSplitOptions?: {
    maxLength?: number;
    splitByDoubleNewline?: boolean;
    splitBySentence?: boolean;
  };
  /** 播放选项 */
  playOptions?: PlayOptions;
}

export interface TTSOrchestratorCallbacks {
  /** 段落变化回调 */
  onParagraphChange?: (paragraph: string, index: number) => void;
  /** 播放完成回调 */
  onComplete?: () => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 进度回调 */
  onProgress?: (progress: number) => void;
  /** 打字机完成回调 */
  onTypewriterComplete?: () => void;
  /** TTS就绪回调 */
  onReady?: (ready: boolean) => void;
}

export interface TTSOrchestratorState {
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 是否暂停 */
  isPaused: boolean;
  /** 当前播放的段落 */
  currentParagraph?: string;
  /** 当前段落索引 */
  currentIndex: number;
  /** 总段落数 */
  totalParagraphs: number;
  /** 播放进度 */
  progress: number;
  /** 是否正在打字 */
  isTyping: boolean;
  /** 显示的文本 */
  displayedText: string;
}

/**
 * TTS编排器类
 * 负责协调所有TTS相关模块的工作
 */
export class TTSOrchestrator {
  private ttsAdapter: TTSAdapter;
  private paragraphPlayer: ParagraphPlayer;
  private config: TTSOrchestratorConfig;
  private callbacks: TTSOrchestratorCallbacks = {};
  private state: TTSOrchestratorState = {
    isPlaying: false,
    isPaused: false,
    currentIndex: 0,
    totalParagraphs: 0,
    progress: 0,
    isTyping: false,
    displayedText: '',
  };
  private paragraphs: string[] = [];
  private currentText: string = '';

  constructor(config: TTSOrchestratorConfig) {
    this.config = config;
    this.ttsAdapter = new TTSAdapter(config.tts);
    this.paragraphPlayer = new ParagraphPlayer(this.ttsAdapter);
    
    this.setupPlayerCallbacks();
  }

  /**
   * 设置回调函数
   */
  public setCallbacks(callbacks: TTSOrchestratorCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<TTSOrchestratorConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.tts) {
      this.ttsAdapter.updateConfig(config.tts);
    }
  }

  /**
   * 获取当前状态
   */
  public getState(): TTSOrchestratorState {
    return { ...this.state };
  }

  /**
   * 检查TTS是否可用
   */
  public isAvailable(): boolean {
    return this.ttsAdapter.isAvailable();
  }

  /**
   * 播放文本
   */
  public async playText(text: string, options?: TTSOptions): Promise<void> {
    if (!this.isAvailable()) {
      const error = new Error('TTS功能不可用');
      this.callbacks.onError?.(error);
      throw error;
    }

    this.currentText = text;
    this.paragraphs = this.splitText(text);
    this.state.totalParagraphs = this.paragraphs.length;
    this.state.currentIndex = 0;
    this.state.progress = 0;
    this.state.isTyping = true;
    this.state.displayedText = '';

    console.log('[TTSOrchestrator] 开始播放文本:', {
      textLength: text.length,
      paragraphsCount: this.paragraphs.length,
      options
    });

    try {
      const playOptions = {
        ...this.config.playOptions,
        ...options
      };

      await this.paragraphPlayer.play(this.paragraphs, playOptions);
    } catch (error) {
      console.error('[TTSOrchestrator] 播放失败:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * 暂停播放
   */
  public pause(): void {
    this.paragraphPlayer.pause();
    this.state.isPlaying = false;
    this.state.isPaused = true;
  }

  /**
   * 恢复播放
   */
  public resume(): void {
    this.paragraphPlayer.resume();
    this.state.isPlaying = true;
    this.state.isPaused = false;
  }

  /**
   * 停止播放
   */
  public stop(): void {
    this.paragraphPlayer.stop();
    this.resetState();
  }

  /**
   * 获取高亮渲染器属性
   */
  public getHighlightRendererProps(): HighlightRendererProps {
    return {
      text: this.currentText,
      currentPlayingParagraph: this.state.currentParagraph,
      isDarkMode: false, // 这个应该从外部传入
      typewriterSpeed: 30,
      onTypewriterComplete: () => {
        this.state.isTyping = false;
        this.callbacks.onTypewriterComplete?.();
      },
      onParagraphComplete: (paragraph: string, index: number) => {
        this.callbacks.onParagraphChange?.(paragraph, index);
      },
    };
  }

  /**
   * 测试TTS连接
   */
  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    return this.ttsAdapter.testConnection();
  }

  /**
   * 从API加载配置
   */
  public async loadConfigFromAPI(): Promise<void> {
    try {
      const ttsConfig = await this.ttsAdapter.loadConfigFromAPI();
      this.config.tts = ttsConfig;
      console.log('[TTSOrchestrator] 从API加载配置成功:', ttsConfig);
    } catch (error) {
      console.error('[TTSOrchestrator] 从API加载配置失败:', error);
      throw error;
    }
  }

  /**
   * 分割文本为段落
   */
  private splitText(text: string): string[] {
    const options = this.config.paragraphSplitOptions || {};
    return splitIntoParagraphs(text, options);
  }

  /**
   * 设置段落播放器回调
   */
  private setupPlayerCallbacks(): void {
    const playerCallbacks: PlayerCallbacks = {
      onParagraphChange: (paragraph: string, index: number) => {
        this.state.currentParagraph = paragraph;
        this.state.currentIndex = index;
        this.callbacks.onParagraphChange?.(paragraph, index);
      },
      onComplete: () => {
        this.resetState();
        this.callbacks.onComplete?.();
      },
      onError: (error: Error) => {
        this.resetState();
        this.callbacks.onError?.(error);
      },
      onProgress: (progress: number) => {
        this.state.progress = progress;
        this.callbacks.onProgress?.(progress);
      },
    };

    this.paragraphPlayer.setCallbacks(playerCallbacks);
  }

  /**
   * 重置状态
   */
  private resetState(): void {
    this.state = {
      isPlaying: false,
      isPaused: false,
      currentIndex: 0,
      totalParagraphs: 0,
      progress: 0,
      isTyping: false,
      displayedText: '',
    };
    this.state.currentParagraph = undefined;
  }
}

/**
 * 创建TTS编排器实例
 */
export const createTTSOrchestrator = (config: TTSOrchestratorConfig): TTSOrchestrator => {
  return new TTSOrchestrator(config);
};

export default TTSOrchestrator;
