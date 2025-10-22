import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Square, Plus, Volume2, Music } from 'lucide-react';
import AudioQueuePlayer from './AudioQueuePlayer';
import { AudioQueuePlayerHandle, AudioQueueItem } from '@/types';

const AudioQueuePlayerTest: React.FC = () => {
  const audioPlayerRef = useRef<AudioQueuePlayerHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [audioItems, setAudioItems] = useState<AudioQueueItem[]>([]);
  const [loadingStatus, setLoadingStatus] = useState<string[]>([]); // 加载状态日志
  const [autoPlay, setAutoPlay] = useState(true); // 自动播放开关
  const audio1Ref = useRef<HTMLAudioElement>(null);
  const audio2Ref = useRef<HTMLAudioElement>(null);

  // 生成测试音频URL - 使用新的TTS API
  const generateTestAudioUrl = (text: string, index: number): string => {
    const encodedText = encodeURIComponent(text);
    // 使用絮语语音合成服务
    return `https://dub.qhkly.com/download?text=${encodedText}&name=zh-CN-XuyuNeural&lang=zh-CN&role=Default&style=Default&rate=%2B0&pitch=%2B0&volume=%2B0&format=riff-24khz-16bit-mono-pcm`;
  };

  // 添加10个测试音频到队列
  const handleAddTenAudios = () => {
    const testTexts = [
      '这是第一个测试音频',
      '这是第二个测试音频', 
      '这是第三个测试音频',
      '这是第四个测试音频',
      '这是第五个测试音频',
      '这是第六个测试音频',
      '这是第七个测试音频',
      '这是第八个测试音频',
      '这是第九个测试音频',
      '这是第十个测试音频'
    ];

    const newItems: AudioQueueItem[] = testTexts.map((text, index) => ({
      url: generateTestAudioUrl(text, index),
      textRef: { text, index }
    }));

    // 添加到队列
    newItems.forEach(item => {
      audioPlayerRef.current?.enqueue(item);
    });

    setAudioItems(prev => [...prev, ...newItems]);
    setQueueCount(prev => prev + newItems.length);
  };

  // 添加单个音频
  const handleAddSingleAudio = () => {
    const text = `单个测试音频 ${Date.now()}`;
    const item: AudioQueueItem = {
      url: generateTestAudioUrl(text, audioItems.length),
      textRef: { text, index: audioItems.length }
    };

    audioPlayerRef.current?.enqueue(item);
    setAudioItems(prev => [...prev, item]);
    setQueueCount(prev => prev + 1);
  };

  // 暂停播放
  const handlePause = () => {
    audioPlayerRef.current?.pause();
    setIsPlaying(false);
  };

  // 继续播放
  const handleResume = () => {
    audioPlayerRef.current?.resume();
    setIsPlaying(true);
  };

  // 清空队列
  const handleClear = () => {
    audioPlayerRef.current?.clear();
    setAudioItems([]);
    setQueueCount(0);
    setIsPlaying(false);
    setCurrentPlayingIndex(null);
  };

  // 切换自动播放
  const toggleAutoPlay = () => {
    const newAutoPlay = !autoPlay;
    setAutoPlay(newAutoPlay);
    audioPlayerRef.current?.setAutoPlay(newAutoPlay);
    addLog(`🎛️ 自动播放: ${newAutoPlay ? '已开启' : '已关闭'}`);
  };

  // 播放状态变化回调
  const handlePlayingChange = (textRef: any) => {
    if (textRef && textRef.index !== undefined) {
      setCurrentPlayingIndex(textRef.index);
      setIsPlaying(true);
      addLog(`🎵 正在播放: 音频 ${textRef.index + 1}`);
    }
  };

  // 添加日志
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLoadingStatus(prev => [...prev, `[${timestamp}] ${message}`].slice(-20)); // 只保留最后20条
  };

  // 监听audio元素的加载状态
  useEffect(() => {
    const audio1 = audio1Ref.current;
    const audio2 = audio2Ref.current;

    if (audio1) {
      audio1.addEventListener('loadstart', () => addLog('🔵 Audio1 开始加载'));
      audio1.addEventListener('loadeddata', () => addLog('✅ Audio1 加载完成'));
      audio1.addEventListener('play', () => addLog('▶️ Audio1 开始播放'));
      audio1.addEventListener('ended', () => addLog('⏹️ Audio1 播放结束'));
    }

    if (audio2) {
      audio2.addEventListener('loadstart', () => addLog('🟢 Audio2 开始加载'));
      audio2.addEventListener('loadeddata', () => addLog('✅ Audio2 加载完成'));
      audio2.addEventListener('play', () => addLog('▶️ Audio2 开始播放'));
      audio2.addEventListener('ended', () => addLog('⏹️ Audio2 播放结束'));
    }

    return () => {
      if (audio1) {
        audio1.removeEventListener('loadstart', () => {});
        audio1.removeEventListener('loadeddata', () => {});
        audio1.removeEventListener('play', () => {});
        audio1.removeEventListener('ended', () => {});
      }
      if (audio2) {
        audio2.removeEventListener('loadstart', () => {});
        audio2.removeEventListener('loadeddata', () => {});
        audio2.removeEventListener('play', () => {});
        audio2.removeEventListener('ended', () => {});
      }
    };
  }, []);

  // 样式定义
  const styles = {
    container: {
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '20px',
      color: '#333'
    },
    controls: {
      display: 'flex',
      gap: '10px',
      marginBottom: '20px',
      flexWrap: 'wrap' as const
    },
    button: {
      padding: '10px 16px',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s ease'
    },
    primaryButton: {
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    secondaryButton: {
      backgroundColor: '#6b7280',
      color: 'white'
    },
    dangerButton: {
      backgroundColor: '#ef4444',
      color: 'white'
    },
    successButton: {
      backgroundColor: '#10b981',
      color: 'white'
    },
    warningButton: {
      backgroundColor: '#f59e0b',
      color: 'white'
    },
    infoButton: {
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    status: {
      backgroundColor: '#f3f4f6',
      padding: '16px',
      borderRadius: '8px',
      marginBottom: '20px'
    },
    statusTitle: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '8px',
      color: '#374151'
    },
    statusItem: {
      marginBottom: '4px',
      color: '#6b7280'
    },
    queueList: {
      backgroundColor: '#f9fafb',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #e5e7eb'
    },
    queueItem: {
      padding: '8px 12px',
      marginBottom: '4px',
      borderRadius: '4px',
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    playingItem: {
      backgroundColor: '#dbeafe',
      borderColor: '#3b82f6'
    },
    audioIcon: {
      color: '#6b7280'
    },
    playingIcon: {
      color: '#3b82f6'
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🎵 音频播放模块测试</h1>
      
      {/* 控制按钮 */}
      <div style={styles.controls}>
        <button
          style={{
            ...styles.button, 
            ...(autoPlay ? styles.successButton : styles.secondaryButton),
            fontWeight: 'bold'
          }}
          onClick={toggleAutoPlay}
        >
          <Music size={16} />
          {autoPlay ? '🔊 自动播放：开' : '🔇 自动播放：关'}
        </button>

        <button
          style={{...styles.button, ...styles.primaryButton}}
          onClick={handleAddTenAudios}
        >
          <Plus size={16} />
          添加10个音频
        </button>
        
        <button
          style={{...styles.button, ...styles.secondaryButton}}
          onClick={handleAddSingleAudio}
        >
          <Plus size={16} />
          添加1个音频
        </button>
        
        {isPlaying ? (
          <button
            style={{...styles.button, ...styles.warningButton}}
            onClick={handlePause}
          >
            <Pause size={16} />
            暂停
          </button>
        ) : (
          <button
            style={{...styles.button, ...styles.infoButton}}
            onClick={handleResume}
          >
            <Play size={16} />
            继续
          </button>
        )}
        
        <button
          style={{...styles.button, ...styles.dangerButton}}
          onClick={handleClear}
        >
          <Square size={16} />
          清空队列
        </button>
      </div>

      {/* 状态显示 */}
      <div style={styles.status}>
        <div style={styles.statusTitle}>📊 播放状态</div>
        <div style={styles.statusItem}>
          <strong>自动播放:</strong> {autoPlay ? '🔊 已开启' : '🔇 已关闭'}
        </div>
        <div style={styles.statusItem}>
          <strong>队列数量:</strong> {queueCount}
        </div>
        <div style={styles.statusItem}>
          <strong>播放状态:</strong> {isPlaying ? '🔊 播放中' : '⏸️ 暂停/空闲'}
        </div>
        <div style={styles.statusItem}>
          <strong>当前播放:</strong> {
            currentPlayingIndex !== null 
              ? `第 ${currentPlayingIndex + 1} 个音频` 
              : '无'
          }
        </div>
      </div>

      {/* 队列列表 */}
      {audioItems.length > 0 && (
        <div style={styles.queueList}>
          <div style={styles.statusTitle}>📋 音频队列</div>
          {audioItems.map((item, index) => (
            <div
              key={index}
              style={{
                ...styles.queueItem,
                ...(currentPlayingIndex === index ? styles.playingItem : {})
              }}
            >
              <Volume2 
                size={16} 
                style={currentPlayingIndex === index ? styles.playingIcon : styles.audioIcon}
              />
              <span>
                {index + 1}. {item.textRef?.text || `音频 ${index + 1}`}
              </span>
              {currentPlayingIndex === index && (
                <span style={{ color: '#3b82f6', fontSize: '12px' }}>
                  🔊 播放中
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 加载状态日志 */}
      {loadingStatus.length > 0 && (
        <div style={styles.queueList}>
          <div style={styles.statusTitle}>📊 加载和播放日志</div>
          <div style={{ 
            maxHeight: '300px', 
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px',
            lineHeight: '1.5'
          }}>
            {loadingStatus.map((log, index) => (
              <div key={index} style={{ padding: '2px 0' }}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 隐藏的audio元素引用，用于监听 */}
      <div style={{ display: 'none' }}>
        <audio ref={audio1Ref} id="test-audio-1" />
        <audio ref={audio2Ref} id="test-audio-2" />
      </div>

      {/* 隐藏的音频播放器 */}
      <AudioQueuePlayer 
        ref={audioPlayerRef}
        onPlayingChange={handlePlayingChange}
        autoPlay={autoPlay}
      />
    </div>
  );
};

export default AudioQueuePlayerTest;
