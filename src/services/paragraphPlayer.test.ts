/**
 * 段落播放器测试
 */

import { ParagraphPlayer, PlayerCallbacks, PlayOptions } from './paragraphPlayer';
import { TTSAdapter, TTSConfig } from './ttsAdapter';

// Mock Audio
const createMockAudio = (): Partial<HTMLAudioElement> & {
  play: jest.MockedFunction<() => Promise<void>>;
  pause: jest.MockedFunction<() => void>;
  addEventListener: jest.MockedFunction<(type: string, listener: EventListener) => void>;
  removeEventListener: jest.MockedFunction<(type: string, listener: EventListener) => void>;
  load: jest.MockedFunction<() => void>;
  onloadeddata: (() => void) | null;
  oncanplaythrough: (() => void) | null;
  onplay: (() => void) | null;
  onended: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  onpause: (() => void) | null;
} => ({
  preload: '',
  src: '',
  onloadeddata: null,
  oncanplaythrough: null,
  onplay: null,
  onended: null,
  onerror: null,
  onpause: null,
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  load: jest.fn(),
  readyState: 4, // Simulate HAVE_ENOUGH_DATA
  duration: 10, // Simulate a 10-second audio
  currentTime: 0,
});

// 确保每次调用 new Audio() 都返回一个新的 mock 实例
global.Audio = jest.fn().mockImplementation(() => createMockAudio());

describe('ParagraphPlayer', () => {
  let player: ParagraphPlayer;
  let adapter: TTSAdapter;
  let mockConfig: TTSConfig;

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      apiUrl: 'http://example.com/tts?text={text}&voice={voice}'
    };
    adapter = new TTSAdapter(mockConfig);
    player = new ParagraphPlayer(adapter);
    
    // Mock TTSAdapter methods
    jest.spyOn(adapter, 'generateAudioUrl').mockResolvedValue('http://example.com/audio.mp3');
    
    // 重置mock
    jest.clearAllMocks();
  });

  describe('构造函数和基本功能', () => {
    test('应该正确初始化', () => {
      expect(player).toBeInstanceOf(ParagraphPlayer);
    });

    test('应该能够设置回调函数', () => {
      const callbacks: PlayerCallbacks = {
        onProgress: jest.fn(),
        onParagraphChange: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      };

      player.setCallbacks(callbacks);
      expect(player).toBeDefined();
    });

    test('应该获取当前段落信息', () => {
      const current = player.getCurrentParagraph();
      expect(current).toBeNull();
    });

    test('应该获取播放状态', () => {
      const state = player.getPlaybackState();
      expect(state).toEqual({
        isPlaying: false,
        isPaused: false,
        currentIndex: 0,
        totalParagraphs: 0,
        progress: 0
      });
    });
  });

  describe('播放控制', () => {
    test('应该能够停止播放', () => {
      player.stop();
      const state = player.getPlaybackState();
      expect(state.isPlaying).toBe(false);
      expect(state.isPaused).toBe(false);
    });

    test('应该能够暂停播放', () => {
      player.pause();
      const state = player.getPlaybackState();
      expect(state.isPaused).toBe(false); // 因为没有在播放
    });

    test('应该能够恢复播放', () => {
      player.resume();
      const state = player.getPlaybackState();
      expect(state.isPaused).toBe(false); // 因为没有在播放
    });
  });

  describe('播放段落队列', () => {
    test('应该在TTS不可用时抛出错误', async () => {
      adapter.updateConfig({ enabled: false });
      
      const callbacks: PlayerCallbacks = {
        onError: jest.fn()
      };
      player.setCallbacks(callbacks);

      await expect(player.play(['段落1', '段落2'])).rejects.toThrow('TTS服务不可用');
      expect(callbacks.onError).toHaveBeenCalled();
    });

    test('应该成功播放单个段落', async () => {
      const callbacks: PlayerCallbacks = {
        onParagraphChange: jest.fn(),
        onComplete: jest.fn()
      };
      player.setCallbacks(callbacks);

      const playPromise = player.play(['段落1']);

      // 模拟音频播放完成
      setTimeout(() => {
        const audioInstances = (global.Audio as jest.Mock).mock.results;
        if (audioInstances.length > 0) {
          const audio = audioInstances[0].value;
          if (audio.onended) {
            audio.onended();
          }
        }
      }, 100);

      await playPromise;

      expect(callbacks.onParagraphChange).toHaveBeenCalledWith('段落1', 0);
      expect(callbacks.onComplete).toHaveBeenCalled();
      expect(global.Audio).toHaveBeenCalled();
    });

    test('应该成功播放多个段落', async () => {
      const callbacks: PlayerCallbacks = {
        onParagraphChange: jest.fn(),
        onComplete: jest.fn()
      };
      player.setCallbacks(callbacks);

      let callCount = 0;
      const paragraphs = ['段落1', '段落2', '段落3'];
      
      const mockAudioInstance = createMockAudio();
      (global.Audio as jest.Mock).mockReturnValue(mockAudioInstance);
      
      // 模拟音频播放完成
      const simulatePlayback = () => {
        if (callCount < paragraphs.length) {
          setTimeout(() => {
            if (mockAudioInstance.onended) {
              mockAudioInstance.onended();
            }
            callCount++;
            if (callCount < paragraphs.length) {
              simulatePlayback();
            }
          }, 50);
        }
      };
      
      simulatePlayback();

      await player.play(paragraphs);

      expect(callbacks.onParagraphChange).toHaveBeenCalledTimes(3);
      expect(callbacks.onParagraphChange).toHaveBeenNthCalledWith(1, '段落1', 0);
      expect(callbacks.onParagraphChange).toHaveBeenNthCalledWith(2, '段落2', 1);
      expect(callbacks.onParagraphChange).toHaveBeenNthCalledWith(3, '段落3', 2);
      expect(callbacks.onComplete).toHaveBeenCalled();
    });

    test('应该处理播放错误', async () => {
      const callbacks: PlayerCallbacks = {
        onError: jest.fn(),
        onComplete: jest.fn()
      };
      player.setCallbacks(callbacks);

      // 模拟播放错误
      const mockAudioInstance = createMockAudio();
      mockAudioInstance.play.mockRejectedValue(new Error('播放失败'));
      (global.Audio as jest.Mock).mockReturnValue(mockAudioInstance);

      await player.play(['段落1']);

      expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));
      expect(callbacks.onComplete).toHaveBeenCalled();
    });

    test('应该处理音频加载错误', async () => {
      const callbacks: PlayerCallbacks = {
        onError: jest.fn(),
        onComplete: jest.fn()
      };
      player.setCallbacks(callbacks);

      // 模拟音频错误
      const mockAudioInstance = createMockAudio();
      (global.Audio as jest.Mock).mockReturnValue(mockAudioInstance);
      
      setTimeout(() => {
        if (mockAudioInstance.onerror) {
          const errorEvent = new Event('error');
          mockAudioInstance.onerror(errorEvent);
        }
      }, 100);

      await player.play(['段落1']);

      expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));
      expect(callbacks.onComplete).toHaveBeenCalled();
    }, 10000); // 增加超时时间
  });

  describe('重试机制', () => {
    test('应该在播放失败时重试', async () => {
      const callbacks: PlayerCallbacks = {
        onComplete: jest.fn(),
        onError: jest.fn()
      };
      player.setCallbacks(callbacks);

      let attemptCount = 0;
      const mockAudioInstance = createMockAudio();
      mockAudioInstance.play.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(new Error('第一次失败'));
        }
        return Promise.resolve();
      });
      (global.Audio as jest.Mock).mockReturnValue(mockAudioInstance);

      // 模拟重试后成功播放
      setTimeout(() => {
        if (mockAudioInstance.onended) {
          mockAudioInstance.onended();
        }
      }, 200);

      const options: PlayOptions = {
        retryCount: 1,
        retryDelay: 50
      };

      await player.play(['段落1'], options);

      expect(attemptCount).toBe(2); // 第一次失败，第二次成功
      expect(callbacks.onComplete).toHaveBeenCalled();
    });

    test('应该在重试次数用完后跳过段落', async () => {
      const callbacks: PlayerCallbacks = {
        onComplete: jest.fn()
      };
      player.setCallbacks(callbacks);

      const mockAudioInstance = createMockAudio();
      mockAudioInstance.play.mockRejectedValue(new Error('持续失败'));
      (global.Audio as jest.Mock).mockReturnValue(mockAudioInstance);

      const options: PlayOptions = {
        retryCount: 1,
        retryDelay: 10
      };

      await player.play(['段落1', '段落2'], options);

      expect(callbacks.onComplete).toHaveBeenCalled();
    });
  });

  describe('暂停和恢复', () => {
    test('应该能够暂停和恢复播放', async () => {
      const callbacks: PlayerCallbacks = {
        onComplete: jest.fn()
      };
      player.setCallbacks(callbacks);

      const mockAudioInstance = createMockAudio();
      (global.Audio as jest.Mock).mockReturnValue(mockAudioInstance);

      // 开始播放
      const playPromise = player.play(['段落1']);

      // 等待一小段时间后暂停
      setTimeout(() => {
        // 模拟音频对象存在
        player['currentAudio'] = mockAudioInstance as any;
        player.pause();
        expect(mockAudioInstance.pause).toHaveBeenCalled();
        
        // 恢复播放
        player.resume();
        expect(mockAudioInstance.play).toHaveBeenCalled();
        
        // 完成播放
        setTimeout(() => {
          if (mockAudioInstance.onended) {
            mockAudioInstance.onended();
          }
        }, 50);
      }, 50);

      await playPromise;
      expect(callbacks.onComplete).toHaveBeenCalled();
    });
  });

  describe('播放状态管理', () => {
    test('应该在播放过程中更新状态', async () => {
      const callbacks: PlayerCallbacks = {
        onParagraphChange: jest.fn()
      };
      player.setCallbacks(callbacks);

      // 模拟播放过程
      let stateUpdateCount = 0;
      const checkState = () => {
        const state = player.getPlaybackState();
        stateUpdateCount++;
        
        if (stateUpdateCount === 1) {
          expect(state.isPlaying).toBe(true);
          expect(state.currentIndex).toBe(0);
          expect(state.totalParagraphs).toBe(2);
          expect(state.progress).toBe(0);
        }
      };

      // 开始播放
      const playPromise = player.play(['段落1', '段落2']);
      
      setTimeout(checkState, 10);
      
      // 完成播放
      setTimeout(() => {
        const audioInstances = (global.Audio as jest.Mock).mock.results;
        if (audioInstances.length > 0) {
          const audio = audioInstances[0].value;
          if (audio.onended) {
            audio.onended();
          }
        }
      }, 100);

      await playPromise;
    });

    test('应该在停止后重置状态', () => {
      player.stop();
      const state = player.getPlaybackState();
      
      expect(state.isPlaying).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.currentIndex).toBe(0);
      expect(state.totalParagraphs).toBe(0);
      expect(state.progress).toBe(0);
    });
  });

  describe('边界情况', () => {
    test('应该处理空段落数组', async () => {
      const callbacks: PlayerCallbacks = {
        onComplete: jest.fn()
      };
      player.setCallbacks(callbacks);

      await player.play([]);
      
      expect(callbacks.onComplete).toHaveBeenCalled();
    });

    test('应该处理单个空段落', async () => {
      const callbacks: PlayerCallbacks = {
        onComplete: jest.fn()
      };
      player.setCallbacks(callbacks);

      const mockAudioInstance = createMockAudio();
      (global.Audio as jest.Mock).mockReturnValue(mockAudioInstance);

      // 模拟播放完成
      setTimeout(() => {
        const audioInstances = (global.Audio as jest.Mock).mock.results;
        if (audioInstances.length > 0) {
          const audio = audioInstances[0].value;
          if (audio.onended) {
            audio.onended();
          }
        }
      }, 100);

      await player.play(['']);
      
      expect(callbacks.onComplete).toHaveBeenCalled();
    });

    test('应该处理大量段落', async () => {
      const callbacks: PlayerCallbacks = {
        onComplete: jest.fn()
      };
      player.setCallbacks(callbacks);

      const paragraphs = Array.from({ length: 10 }, (_, i) => `段落${i + 1}`);
      
      const mockAudioInstance = createMockAudio();
      (global.Audio as jest.Mock).mockReturnValue(mockAudioInstance);
      
      // 模拟快速播放完成
      let completedCount = 0;
      const simulatePlayback = () => {
        if (completedCount < paragraphs.length) {
          setTimeout(() => {
            if (mockAudioInstance.onended) {
              mockAudioInstance.onended();
            }
            completedCount++;
            if (completedCount < paragraphs.length) {
              simulatePlayback();
            }
          }, 10);
        }
      };
      
      simulatePlayback();

      await player.play(paragraphs);
      
      expect(callbacks.onComplete).toHaveBeenCalled();
      expect(adapter.generateAudioUrl).toHaveBeenCalledTimes(10);
      expect(mockAudioInstance.play).toHaveBeenCalledTimes(10);
    }, 10000); // 增加超时时间到10秒
  });
});
