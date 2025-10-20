// TTS服务配置和API
export interface TTSConfig {
  enabled: boolean;
  apiUrl: string;
}

export interface TTSResponse {
  success: boolean;
  audioUrl?: string;
  error?: string;
}

class TTSService {
  private config: TTSConfig;
  private currentAudio: HTMLAudioElement | null = null;
  private isPlaying = false;
  private currentText = '';
  private currentParagraphs: string[] = [];
  private currentParagraphIndex = 0;
  private onProgressCallback?: (progress: number) => void;
  private onCompleteCallback?: () => void;

  constructor() {
    this.config = {
      enabled: false,
      apiUrl: ''
    };
    this.loadConfig();
  }

  // 从API加载TTS配置
  private async loadConfig() {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      
      if (data.tts) {
        this.config = {
          enabled: data.tts.enabled,
          apiUrl: data.tts.apiUrl
        };
        console.log('[TTS] 配置加载成功:', this.config);
      }
    } catch (error) {
      console.warn('[TTS] 配置加载失败，使用默认配置:', error);
      // 使用环境变量作为后备
      this.config = {
        enabled: process.env.REACT_APP_TTS_ENABLED === 'true',
        apiUrl: process.env.REACT_APP_TTS_API_URL || ''
      };
    }
  }

  // 检查TTS是否可用
  isAvailable(): boolean {
    return this.config.enabled && !!this.config.apiUrl;
  }

  // 分割文本为段落
  private splitIntoParagraphs(text: string): string[] {
    console.log('[TTS] 开始分割文本:', text);
    
    // 按段落分割（双换行符、列表项、标题等）
    const paragraphs = text
      .split(/\n\s*\n/) // 按双换行符分割
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    console.log('[TTS] 按双换行符分割结果:', paragraphs);
    
    // 如果段落太长，进一步分割
    const result: string[] = [];
    paragraphs.forEach((paragraph, index) => {
      console.log(`[TTS] 处理第${index + 1}个段落，长度: ${paragraph.length}`);
      
      if (paragraph.length > 200) {
        // 长段落按句子分割
        const sentences = paragraph.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
        console.log(`[TTS] 长段落分割为${sentences.length}个句子:`, sentences);
        sentences.forEach(sentence => {
          if (sentence.trim().length > 0) {
            result.push(sentence.trim());
          }
        });
      } else {
        result.push(paragraph);
      }
    });
    
    console.log('[TTS] 最终分割结果:', result);
    return result;
  }

  // 生成TTS音频（单个段落）
  async generateAudio(text: string, options: {
    voice?: string;
    speed?: number;
    volume?: number;
    language?: string;
    [key: string]: any; // 支持任意参数
  } = {}): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('TTS服务不可用');
    }

    try {
      // 使用模板字符串替换的方式
      let url = this.config.apiUrl;
      
      // 替换所有可能的模板字符串
      const templateVars = {
        text: text,
        ...options
      };
      
      // 替换模板变量
      Object.entries(templateVars).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          const placeholder = `{${key}}`;
          if (url.includes(placeholder)) {
            url = url.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), encodeURIComponent(value.toString()));
          }
        }
      });
      
      // 如果还有未替换的{text}占位符，使用传入的text参数
      if (url.includes('{text}')) {
        url = url.replace(/{text}/g, encodeURIComponent(text));
      }
      
      // 如果URL中没有{text}占位符，且没有text参数，则添加text参数
      if (!url.includes('text=') && !url.includes('{text}')) {
        const baseUrl = new URL(url);
        baseUrl.searchParams.set('text', text);
        url = baseUrl.toString();
      }
      
      console.log('[TTS] 原始API URL:', this.config.apiUrl);
      console.log('[TTS] 当前段落文本:', text);
      console.log('[TTS] 最终请求URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'audio/*'
        }
      });

      if (!response.ok) {
        throw new Error(`TTS API请求失败: ${response.status}`);
      }

      // 如果返回的是音频文件，直接返回blob URL
      if (response.headers.get('content-type')?.startsWith('audio/')) {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }

      // 如果返回的是JSON响应
      const data: TTSResponse = await response.json();
      
      if (!data.success || !data.audioUrl) {
        throw new Error(data.error || 'TTS生成失败');
      }

      return data.audioUrl;
    } catch (error) {
      console.error('TTS生成错误:', error);
      throw error;
    }
  }

  // 播放完整文本（段落方式）
  async playText(text: string, options: {
    voice?: string;
    speed?: number;
    volume?: number;
    language?: string;
    [key: string]: any;
  } = {}): Promise<void> {
    console.log('[TTS] playText方法被调用，文本长度:', text.length);
    
    // 停止当前播放
    this.stop();

    // 分割文本为段落
    this.currentParagraphs = this.splitIntoParagraphs(text);
    this.currentParagraphIndex = 0;
    this.currentText = text;
    this.isPlaying = true;

    console.log(`[TTS] 开始播放，共${this.currentParagraphs.length}个段落`);
    console.log('[TTS] 分割后的段落:', this.currentParagraphs);

    // 播放第一个段落
    await this.playNextParagraph(options);
  }

  // 播放下一个段落
  private async playNextParagraph(options: {
    voice?: string;
    speed?: number;
    volume?: number;
    language?: string;
    [key: string]: any;
  } = {}): Promise<void> {
    if (this.currentParagraphIndex >= this.currentParagraphs.length) {
      // 所有段落播放完成
      console.log('[TTS] 所有段落播放完成');
      this.isPlaying = false;
      this.currentAudio = null;
      this.currentText = '';
      this.currentParagraphs = [];
      this.currentParagraphIndex = 0;
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
      }
      return;
    }

    const currentParagraph = this.currentParagraphs[this.currentParagraphIndex];
    console.log(`[TTS] 播放第${this.currentParagraphIndex + 1}个段落:`, currentParagraph);

    try {
      // 生成当前段落的音频
      const audioUrl = await this.generateAudio(currentParagraph, options);
      
      // 播放音频
      await this.playSingleAudio(audioUrl, currentParagraph);
      
      // 播放完成后，播放下一个段落
      this.currentParagraphIndex++;
      if (this.isPlaying) {
        // 短暂停顿后播放下一段
        setTimeout(() => {
          if (this.isPlaying) {
            this.playNextParagraph(options);
          }
        }, 500); // 500ms停顿
      }
    } catch (error) {
      console.error('[TTS] 段落播放错误:', error);
      this.isPlaying = false;
      throw error;
    }
  }

  // 播放单个音频文件
  private async playSingleAudio(audioUrl: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.volume = 1.0;

      // 播放事件监听
      this.currentAudio.addEventListener('canplay', () => {
        console.log('[TTS] 音频可以播放');
      });

      this.currentAudio.addEventListener('play', () => {
        console.log('[TTS] 开始播放段落');
      });

      this.currentAudio.addEventListener('timeupdate', () => {
        if (this.currentAudio && this.onProgressCallback) {
          // 计算整体进度（当前段落进度 + 已完成段落）
          const paragraphProgress = this.currentAudio.currentTime / this.currentAudio.duration;
          const totalProgress = (this.currentParagraphIndex + paragraphProgress) / this.currentParagraphs.length;
          this.onProgressCallback(Math.min(totalProgress, 1));
        }
      });

      this.currentAudio.addEventListener('ended', () => {
        console.log('[TTS] 段落播放完成');
        resolve();
      });

      this.currentAudio.addEventListener('error', (error) => {
        console.error('[TTS] 段落播放错误:', error);
        reject(error);
      });

      // 开始播放
      this.currentAudio.play().catch(reject);
    });
  }

  // 停止播放
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isPlaying = false;
    this.currentText = '';
    this.currentParagraphs = [];
    this.currentParagraphIndex = 0;
  }

  // 暂停播放
  pause(): void {
    if (this.currentAudio && this.isPlaying) {
      this.currentAudio.pause();
      this.isPlaying = false;
    }
  }

  // 恢复播放
  async resume(): Promise<void> {
    if (this.currentAudio && !this.isPlaying && this.currentParagraphs.length > 0) {
      this.isPlaying = true;
      try {
        await this.currentAudio.play();
      } catch (error) {
        console.error('[TTS] 恢复播放失败:', error);
        this.isPlaying = false;
      }
    }
  }

  // 获取播放状态
  getPlayingState(): { isPlaying: boolean; text: string; currentParagraph?: string } {
    return {
      isPlaying: this.isPlaying,
      text: this.currentText,
      currentParagraph: this.currentParagraphs[this.currentParagraphIndex]
    };
  }

  // 设置进度回调
  setProgressCallback(callback: (progress: number) => void): void {
    this.onProgressCallback = callback;
  }

  // 设置完成回调
  setCompleteCallback(callback: () => void): void {
    this.onCompleteCallback = callback;
  }

  // 获取配置
  getConfig(): TTSConfig {
    return { ...this.config };
  }
}

export const ttsService = new TTSService();
