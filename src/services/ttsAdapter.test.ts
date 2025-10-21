/**
 * TTS适配器测试
 */

import { TTSAdapter, createTTSAdapter, TTSConfig, TTSOptions } from './ttsAdapter';

// Mock fetch
global.fetch = jest.fn();

// Mock Audio
const createMockAudio = () => {
  const mockAudio = {
    preload: '' as any,
    src: '',
    onloadedmetadata: null as (() => void) | null,
    onerror: null as ((event: Event) => void) | null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
  };
  return mockAudio;
};

global.Audio = jest.fn().mockImplementation(() => createMockAudio());

describe('TTSAdapter', () => {
  let adapter: TTSAdapter;
  let mockConfig: TTSConfig;

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      apiUrl: 'http://example.com/tts?text={text}&voice={voice}&speed={speed}'
    };
    adapter = new TTSAdapter(mockConfig);
    jest.clearAllMocks();
  });

  describe('构造函数和配置', () => {
    test('应该正确初始化配置', () => {
      expect(adapter.getConfig()).toEqual(mockConfig);
    });

    test('应该能够更新配置', () => {
      const newConfig = { enabled: false };
      adapter.updateConfig(newConfig);
      expect(adapter.getConfig()).toEqual({
        ...mockConfig,
        ...newConfig
      });
    });

    test('应该正确检查TTS可用性', () => {
      expect(adapter.isAvailable()).toBe(true);
      
      adapter.updateConfig({ enabled: false });
      expect(adapter.isAvailable()).toBe(false);
      
      adapter.updateConfig({ enabled: true, apiUrl: '' });
      expect(adapter.isAvailable()).toBe(false);
    });
  });

  describe('generateAudioUrl', () => {
    test('应该生成正确的模板URL', async () => {
      const text = '测试文本';
      const options: TTSOptions = {
        voice: 'female',
        speed: 1.2,
        volume: 0.8
      };

      const url = await adapter.generateAudioUrl(text, options);
      
      expect(url).toContain('text=' + encodeURIComponent(text));
      expect(url).toContain('voice=female');
      expect(url).toContain('speed=1.2');
      expect(url).toContain('volume=0.8');
    });

    test('应该使用默认选项', async () => {
      const text = '测试文本';
      const url = await adapter.generateAudioUrl(text);
      
      expect(url).toContain('text=' + encodeURIComponent(text));
      expect(url).toContain('voice=default');
      expect(url).toContain('speed=1');
      expect(url).toContain('volume=1');
    });

    test('应该处理特殊字符', async () => {
      const text = '测试文本！@#$%^&*()';
      const url = await adapter.generateAudioUrl(text);
      
      // URLSearchParams会编码特殊字符，所以检查编码后的内容
      expect(url).toContain('%E6%B5%8B%E8%AF%95%E6%96%87%E6%9C%AC%EF%BC%81%40%23%24%25%5E%26*%28%29');
    });

    test('应该处理非模板URL', async () => {
      const config: TTSConfig = {
        enabled: true,
        apiUrl: 'http://example.com/tts'
      };
      const adapter2 = new TTSAdapter(config);
      
      const text = '测试文本';
      const url = await adapter2.generateAudioUrl(text, { voice: 'male' });
      
      expect(url).toContain('http://example.com/tts');
      expect(url).toContain('text=' + encodeURIComponent(text));
      expect(url).toContain('voice=male');
    });

    test('应该验证URL有效性', async () => {
      const config: TTSConfig = {
        enabled: true,
        apiUrl: 'invalid-url'
      };
      const adapter2 = new TTSAdapter(config);
      
      await expect(adapter2.generateAudioUrl('测试')).rejects.toThrow('Invalid URL');
    });

    test('应该在TTS不可用时抛出错误', async () => {
      adapter.updateConfig({ enabled: false });
      
      await expect(adapter.generateAudioUrl('测试')).rejects.toThrow('TTS服务不可用');
    });

    test('应该处理空文本', async () => {
      const url = await adapter.generateAudioUrl('');
      expect(url).toContain('text=');
    });

    test('应该处理长文本', async () => {
      const longText = 'a'.repeat(1000);
      const url = await adapter.generateAudioUrl(longText);
      expect(url).toContain(encodeURIComponent(longText));
    });
  });

  describe('testConnection', () => {
    test('应该成功测试连接', async () => {
      const mockAudio = createMockAudio();
      
      (global.Audio as jest.Mock).mockReturnValue(mockAudio);
      
      // 模拟成功加载
      setTimeout(() => {
        if (mockAudio.onloadedmetadata) {
          mockAudio.onloadedmetadata();
        }
      }, 0);

      const result = await adapter.testConnection('测试');
      
      expect(result.success).toBe(true);
      expect(result.audioUrl).toBeDefined();
    });

    test('应该处理连接失败', async () => {
      const mockAudio = createMockAudio();
      
      (global.Audio as jest.Mock).mockReturnValue(mockAudio);
      
      // 模拟加载失败
      setTimeout(() => {
        if (mockAudio.onerror) {
          const errorEvent = new Event('error');
          mockAudio.onerror(errorEvent);
        }
      }, 0);

      const result = await adapter.testConnection('测试');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('TTS服务连接失败');
    });

    test('应该处理生成URL失败', async () => {
      adapter.updateConfig({ enabled: false });
      
      const result = await adapter.testConnection('测试');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('TTS服务不可用');
    });
  });

  describe('loadConfigFromAPI', () => {
    test('应该成功从API加载配置', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          tts: {
            enabled: true,
            apiUrl: 'http://api.example.com/tts'
          }
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const config = await adapter.loadConfigFromAPI();
      
      expect(config.enabled).toBe(true);
      expect(config.apiUrl).toBe('http://api.example.com/tts');
      expect(adapter.getConfig()).toEqual(config);
    });

    test('应该处理API响应失败', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      await expect(adapter.loadConfigFromAPI()).rejects.toThrow('HTTP 404: Not Found');
    });

    test('应该处理网络错误', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('网络错误'));
      
      await expect(adapter.loadConfigFromAPI()).rejects.toThrow('网络错误');
    });

    test('应该处理无效的API响应', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const config = await adapter.loadConfigFromAPI();
      
      expect(config.enabled).toBe(false);
      expect(config.apiUrl).toBe('');
    });
  });

  describe('边界情况', () => {
    test('应该处理空配置', () => {
      const emptyConfig: TTSConfig = {
        enabled: false,
        apiUrl: ''
      };
      const adapter2 = new TTSAdapter(emptyConfig);
      
      expect(adapter2.isAvailable()).toBe(false);
    });

    test('应该处理特殊字符的选项', async () => {
      const options: TTSOptions = {
        voice: 'voice with spaces & symbols!',
        language: 'zh-CN'
      };
      
      const url = await adapter.generateAudioUrl('测试', options);
      
      // URLSearchParams会编码特殊字符
      expect(url).toContain('voice+with+spaces+%26+symbols%21');
      expect(url).toContain('zh-CN');
    });

    test('应该处理数字选项', async () => {
      const options: TTSOptions = {
        speed: 0.5,
        volume: 2.0,
        pitch: 1.5
      };
      
      const url = await adapter.generateAudioUrl('测试', options);
      
      expect(url).toContain('speed=0.5');
      expect(url).toContain('volume=2');
      expect(url).toContain('pitch=1.5');
    });
  });
});

describe('createTTSAdapter', () => {
  test('应该创建TTS适配器实例', () => {
    const config: TTSConfig = {
      enabled: true,
      apiUrl: 'http://example.com/tts'
    };
    
    const adapter = createTTSAdapter(config);
    
    expect(adapter).toBeInstanceOf(TTSAdapter);
    expect(adapter.getConfig()).toEqual(config);
  });
});
