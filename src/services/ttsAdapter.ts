/**
 * TTS适配器 - 封装TTS API调用和URL模板字符串替换
 */

export interface TTSConfig {
  enabled: boolean;
  apiUrl: string;
}

export interface TTSOptions {
  voice?: string;
  speed?: number;
  volume?: number;
  language?: string;
  [key: string]: unknown;
}

export interface TTSResponse {
  success: boolean;
  audioUrl?: string;
  error?: string;
}

/**
 * TTS适配器类
 */
export class TTSAdapter {
  private config: TTSConfig;

  constructor(config: TTSConfig) {
    this.config = config;
  }

  /**
   * 获取配置
   */
  getConfig(): TTSConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TTSConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 检查TTS是否可用
   */
  isAvailable(): boolean {
    return this.config.enabled && !!this.config.apiUrl;
  }

  /**
   * 生成音频URL
   * @param text 要转换的文本
   * @param options TTS选项
   * @returns 音频URL
   */
  async generateAudioUrl(text: string, options: TTSOptions = {}): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('TTS服务不可用');
    }

    console.log('[TTSAdapter] 生成音频URL:', { text: text.substring(0, 50) + '...', options });

    try {
      // 构建URL，支持模板字符串替换
      let url = this.config.apiUrl;
      
      // 替换模板字符串
      const templateParams = {
        text: text,
        voice: options.voice || 'default',
        speed: options.speed || 1.0,
        volume: options.volume || 1.0,
        language: options.language || 'zh',
        ...options
      };

      // 替换所有模板参数
      Object.entries(templateParams).forEach(([key, value]) => {
        const placeholder = `{${key}}`;
        if (url.includes(placeholder)) {
          url = url.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), encodeURIComponent(String(value)));
        }
      });

      // 如果没有使用模板字符串，则使用标准URL参数
      if (!url.includes('{')) {
        const urlObj = new URL(url);
        Object.entries(templateParams).forEach(([key, value]) => {
          urlObj.searchParams.set(key, String(value));
        });
        url = urlObj.toString();
      }

      console.log('[TTSAdapter] 生成的URL:', url);

      // 验证URL是否有效
      try {
        new URL(url);
      } catch (error) {
        throw new Error(`无效的TTS URL: ${url}`);
      }

      return url;
    } catch (error) {
      console.error('[TTSAdapter] 生成音频URL失败:', error);
      throw error;
    }
  }

  /**
   * 测试TTS服务连接
   * @param testText 测试文本
   * @returns 测试结果
   */
  async testConnection(testText: string = '测试'): Promise<TTSResponse> {
    try {
      const audioUrl = await this.generateAudioUrl(testText);
      
      // 尝试预加载音频来测试连接
      const audio = new Audio();
      audio.preload = 'metadata';
      
      return new Promise((resolve) => {
        audio.onloadedmetadata = () => {
          console.log('[TTSAdapter] TTS服务连接测试成功');
          resolve({
            success: true,
            audioUrl
          });
        };
        
        audio.onerror = (error) => {
          console.error('[TTSAdapter] TTS服务连接测试失败:', error);
          resolve({
            success: false,
            error: 'TTS服务连接失败'
          });
        };
        
        audio.src = audioUrl;
      });
    } catch (error) {
      console.error('[TTSAdapter] TTS服务测试失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 从API获取配置
   */
  async loadConfigFromAPI(): Promise<TTSConfig> {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const config: TTSConfig = {
        enabled: data.tts?.enabled || false,
        apiUrl: data.tts?.apiUrl || ''
      };
      
      console.log('[TTSAdapter] 从API加载配置:', config);
      this.updateConfig(config);
      
      return config;
    } catch (error) {
      console.error('[TTSAdapter] 从API加载配置失败:', error);
      throw error;
    }
  }
}

/**
 * 创建TTS适配器实例
 */
export function createTTSAdapter(config: TTSConfig): TTSAdapter {
  return new TTSAdapter(config);
}
