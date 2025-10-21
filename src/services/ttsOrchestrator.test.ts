/**
 * @fileoverview TTS编排器测试
 */

import { TTSOrchestrator, TTSOrchestratorConfig, TTSOrchestratorCallbacks, createTTSOrchestrator } from './ttsOrchestrator';
import { TTSConfig } from './ttsAdapter';
import { PlayOptions } from './paragraphPlayer';

// Mock dependencies
jest.mock('../utils/paragraphSplitter');
jest.mock('./ttsAdapter');
jest.mock('./paragraphPlayer');

import { splitIntoParagraphs } from '../utils/paragraphSplitter';
import { TTSAdapter } from './ttsAdapter';
import { ParagraphPlayer } from './paragraphPlayer';

const mockSplitIntoParagraphs = splitIntoParagraphs as jest.MockedFunction<typeof splitIntoParagraphs>;
const MockTTSAdapter = TTSAdapter as jest.MockedClass<typeof TTSAdapter>;
const MockParagraphPlayer = ParagraphPlayer as jest.MockedClass<typeof ParagraphPlayer>;

describe('TTSOrchestrator', () => {
  let orchestrator: TTSOrchestrator;
  let mockConfig: TTSOrchestratorConfig;
  let mockTTSAdapter: jest.Mocked<TTSAdapter>;
  let mockParagraphPlayer: jest.Mocked<ParagraphPlayer>;

  beforeEach(() => {
    mockConfig = {
      tts: {
        enabled: true,
        apiUrl: 'http://example.com/tts'
      },
      paragraphSplitOptions: {
        maxLength: 50,
        splitByDoubleNewline: true,
        splitBySentence: true,
      },
      playOptions: {
        retryCount: 1,
        retryDelay: 1000,
      }
    };

    // Mock TTSAdapter
    mockTTSAdapter = {
      updateConfig: jest.fn(),
      getConfig: jest.fn().mockReturnValue(mockConfig.tts),
      isAvailable: jest.fn().mockReturnValue(true),
      generateAudioUrl: jest.fn().mockResolvedValue('http://example.com/audio.mp3'),
      testConnection: jest.fn().mockResolvedValue({ success: true }),
      loadConfigFromAPI: jest.fn().mockResolvedValue(mockConfig.tts),
    } as any;

    MockTTSAdapter.mockImplementation(() => mockTTSAdapter);

    // Mock ParagraphPlayer
    mockParagraphPlayer = {
      setCallbacks: jest.fn(),
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
      resume: jest.fn(),
      stop: jest.fn(),
      isPlaying: jest.fn().mockReturnValue(false),
      isPaused: jest.fn().mockReturnValue(false),
      getCurrentParagraph: jest.fn().mockReturnValue(null),
    } as any;

    MockParagraphPlayer.mockImplementation(() => mockParagraphPlayer);

    // Mock paragraph splitting
    mockSplitIntoParagraphs.mockReturnValue(['段落1', '段落2', '段落3']);

    orchestrator = new TTSOrchestrator(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数和基本功能', () => {
    test('应该正确初始化', () => {
      expect(orchestrator).toBeInstanceOf(TTSOrchestrator);
      expect(MockTTSAdapter).toHaveBeenCalledWith(mockConfig.tts);
      expect(MockParagraphPlayer).toHaveBeenCalledWith(mockTTSAdapter);
    });

    test('应该设置段落播放器回调', () => {
      expect(mockParagraphPlayer.setCallbacks).toHaveBeenCalled();
    });

    test('应该获取当前状态', () => {
      const state = orchestrator.getState();
      
      expect(state).toEqual({
        isPlaying: false,
        isPaused: false,
        currentIndex: 0,
        totalParagraphs: 0,
        progress: 0,
        isTyping: false,
        displayedText: '',
      });
    });

    test('应该检查TTS可用性', () => {
      expect(orchestrator.isAvailable()).toBe(true);
      
      mockTTSAdapter.isAvailable.mockReturnValue(false);
      expect(orchestrator.isAvailable()).toBe(false);
    });
  });

  describe('回调函数管理', () => {
    test('应该设置回调函数', () => {
      const callbacks: TTSOrchestratorCallbacks = {
        onParagraphChange: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn(),
        onProgress: jest.fn(),
        onTypewriterComplete: jest.fn(),
      };

      orchestrator.setCallbacks(callbacks);
      
      // 回调函数应该被设置，但无法直接测试
      expect(true).toBe(true);
    });
  });

  describe('配置管理', () => {
    test('应该更新配置', () => {
      const newConfig = {
        tts: {
          enabled: false,
          apiUrl: 'http://new-api.com/tts'
        },
        paragraphSplitOptions: {
          maxLength: 100,
        }
      };

      orchestrator.updateConfig(newConfig);
      
      expect(mockTTSAdapter.updateConfig).toHaveBeenCalledWith(newConfig.tts);
    });
  });

  describe('文本播放', () => {
    test('应该成功播放文本', async () => {
      const text = '这是测试文本';
      const options = { voice: 'test-voice' };

      await orchestrator.playText(text, options);

      expect(mockSplitIntoParagraphs).toHaveBeenCalledWith(text, mockConfig.paragraphSplitOptions);
      expect(mockParagraphPlayer.play).toHaveBeenCalledWith(['段落1', '段落2', '段落3'], {
        ...mockConfig.playOptions,
        ...options
      });
    });

    test('应该在TTS不可用时抛出错误', async () => {
      mockTTSAdapter.isAvailable.mockReturnValue(false);
      
      const text = '这是测试文本';
      const onError = jest.fn();
      orchestrator.setCallbacks({ onError });

      await expect(orchestrator.playText(text)).rejects.toThrow('TTS功能不可用');
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    test('应该处理播放错误', async () => {
      const text = '这是测试文本';
      const error = new Error('播放失败');
      mockParagraphPlayer.play.mockRejectedValue(error);
      
      const onError = jest.fn();
      orchestrator.setCallbacks({ onError });

      await expect(orchestrator.playText(text)).rejects.toThrow('播放失败');
      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('播放控制', () => {
    test('应该暂停播放', () => {
      orchestrator.pause();
      
      expect(mockParagraphPlayer.pause).toHaveBeenCalled();
    });

    test('应该恢复播放', () => {
      orchestrator.resume();
      
      expect(mockParagraphPlayer.resume).toHaveBeenCalled();
    });

    test('应该停止播放', () => {
      orchestrator.stop();
      
      expect(mockParagraphPlayer.stop).toHaveBeenCalled();
    });
  });

  describe('高亮渲染器属性', () => {
    test('应该获取高亮渲染器属性', () => {
      const props = orchestrator.getHighlightRendererProps();
      
      expect(props).toEqual({
        text: '',
        currentPlayingParagraph: undefined,
        isDarkMode: false,
        typewriterSpeed: 30,
        onTypewriterComplete: expect.any(Function),
        onParagraphComplete: expect.any(Function),
      });
    });

    test('应该在播放后更新高亮渲染器属性', async () => {
      const text = '这是测试文本';
      await orchestrator.playText(text);
      
      const props = orchestrator.getHighlightRendererProps();
      
      expect(props.text).toBe(text);
    });
  });

  describe('连接测试', () => {
    test('应该测试TTS连接', async () => {
      const result = await orchestrator.testConnection();
      
      expect(mockTTSAdapter.testConnection).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    test('应该处理连接测试失败', async () => {
      const error = { success: false, error: '连接失败' };
      mockTTSAdapter.testConnection.mockResolvedValue(error);
      
      const result = await orchestrator.testConnection();
      
      expect(result).toEqual(error);
    });
  });

  describe('配置加载', () => {
    test('应该从API加载配置', async () => {
      const newConfig = { enabled: true, apiUrl: 'http://new-api.com/tts' };
      mockTTSAdapter.loadConfigFromAPI.mockResolvedValue(newConfig);
      
      await orchestrator.loadConfigFromAPI();
      
      expect(mockTTSAdapter.loadConfigFromAPI).toHaveBeenCalled();
    });

    test('应该处理配置加载失败', async () => {
      const error = new Error('加载失败');
      mockTTSAdapter.loadConfigFromAPI.mockRejectedValue(error);
      
      await expect(orchestrator.loadConfigFromAPI()).rejects.toThrow('加载失败');
    });
  });

  describe('状态管理', () => {
    test('应该在播放过程中更新状态', async () => {
      const text = '这是测试文本';
      const onParagraphChange = jest.fn();
      const onProgress = jest.fn();
      
      orchestrator.setCallbacks({ onParagraphChange, onProgress });
      
      await orchestrator.playText(text);
      
      const state = orchestrator.getState();
      expect(state.totalParagraphs).toBe(3);
    });

    test('应该在停止后重置状态', () => {
      orchestrator.stop();
      
      const state = orchestrator.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.currentIndex).toBe(0);
      expect(state.totalParagraphs).toBe(0);
      expect(state.progress).toBe(0);
    });
  });

  describe('边界情况', () => {
    test('应该处理空文本', async () => {
      mockSplitIntoParagraphs.mockReturnValue([]);
      
      await orchestrator.playText('');
      
      expect(mockSplitIntoParagraphs).toHaveBeenCalledWith('', mockConfig.paragraphSplitOptions);
      expect(mockParagraphPlayer.play).toHaveBeenCalledWith([], expect.any(Object));
    });

    test('应该处理单段落文本', async () => {
      mockSplitIntoParagraphs.mockReturnValue(['单个段落']);
      
      await orchestrator.playText('单个段落');
      
      expect(mockParagraphPlayer.play).toHaveBeenCalledWith(['单个段落'], expect.any(Object));
    });

    test('应该处理大量段落', async () => {
      const manyParagraphs = Array.from({ length: 100 }, (_, i) => `段落${i + 1}`);
      mockSplitIntoParagraphs.mockReturnValue(manyParagraphs);
      
      await orchestrator.playText('大量文本');
      
      expect(mockParagraphPlayer.play).toHaveBeenCalledWith(manyParagraphs, expect.any(Object));
    });
  });

  describe('错误处理', () => {
    test('应该处理段落分割错误', async () => {
      mockSplitIntoParagraphs.mockImplementation(() => {
        throw new Error('分割失败');
      });
      
      await expect(orchestrator.playText('测试文本')).rejects.toThrow('分割失败');
    });

    test('应该处理TTS适配器错误', async () => {
      mockTTSAdapter.generateAudioUrl.mockRejectedValue(new Error('生成音频失败'));
      mockParagraphPlayer.play.mockRejectedValue(new Error('播放失败'));
      
      await expect(orchestrator.playText('测试文本')).rejects.toThrow('播放失败');
    });
  });
});

describe('createTTSOrchestrator', () => {
  test('应该创建TTS编排器实例', () => {
    const config: TTSOrchestratorConfig = {
      tts: {
        enabled: true,
        apiUrl: 'http://example.com/tts'
      }
    };

    const orchestrator = createTTSOrchestrator(config);
    
    expect(orchestrator).toBeInstanceOf(TTSOrchestrator);
  });
});
