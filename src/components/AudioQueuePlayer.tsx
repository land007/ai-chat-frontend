import React, { useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { AudioQueueItem, AudioQueuePlayerHandle, AudioQueuePlayerProps } from '@/types';

/**
 * 双音频元素轮换播放组件
 * 
 * 核心功能：
 * 1. 使用两个<audio>元素轮换播放，实现无缝切换
 * 2. 当前播放一个，预加载下一个
 * 3. 支持自动播放、暂停、继续、清空队列
 * 4. 错误自动跳过
 */
const AudioQueuePlayer = forwardRef<AudioQueuePlayerHandle, AudioQueuePlayerProps>(
  ({ onPlayingChange, autoPlay = true }, ref) => {
    // ==================== 常量定义 ====================
    const AUDIO_NAMES = ['Audio1', 'Audio2'] as const;
    
    // ==================== Refs ====================
    const audio1Ref = useRef<HTMLAudioElement>(null);
    const audio2Ref = useRef<HTMLAudioElement>(null);
    
    // 播放状态
    const queueRef = useRef<AudioQueueItem[]>([]);
    const currentIndexRef = useRef(0);
    const isPlayingRef = useRef(false);
    const isPausedRef = useRef(false);
    const activeAudioIndexRef = useRef<0 | 1>(0); // 0: audio1, 1: audio2
    const autoPlayRef = useRef(autoPlay);
    
    // ==================== 工具函数 ====================
    
    /**
     * 获取音频元素名称
     */
    const getAudioName = useCallback((index: 0 | 1) => AUDIO_NAMES[index], []);
    
    /**
     * 获取当前活跃的音频元素
     */
    const getActiveAudio = useCallback(() => {
      return activeAudioIndexRef.current === 0 ? audio1Ref.current : audio2Ref.current;
    }, []);
    
    /**
     * 获取待机音频元素
     */
    const getStandbyAudio = useCallback(() => {
      return activeAudioIndexRef.current === 0 ? audio2Ref.current : audio1Ref.current;
    }, []);
    
    /**
     * 切换音频元素索引
     */
    const switchAudioIndex = useCallback(() => {
      activeAudioIndexRef.current = (1 - activeAudioIndexRef.current) as 0 | 1;
    }, []);
    
    /**
     * 比较URL是否相同（处理绝对路径和相对路径）
     */
    const isSameUrl = useCallback((currentSrc: string, newSrc: string): boolean => {
      if (!currentSrc || !newSrc) return false;
      
      try {
        const currentUrl = new URL(currentSrc, window.location.href).href;
        const newUrl = new URL(newSrc, window.location.href).href;
        return currentUrl === newUrl;
      } catch {
        return currentSrc === newSrc || currentSrc.endsWith(newSrc);
      }
    }, []);
    
    /**
     * 重置播放状态
     */
    const resetPlaybackState = useCallback(() => {
      isPlayingRef.current = false;
      isPausedRef.current = false;
      currentIndexRef.current = 0;
      activeAudioIndexRef.current = 0;
      queueRef.current = [];
      onPlayingChange?.(null);
    }, [onPlayingChange]);
    
    /**
     * 清理音频元素
     */
    const cleanupAudio = useCallback((audio: HTMLAudioElement | null) => {
      if (!audio) return;
      
      audio.pause();
      audio.src = '';
      audio.onended = null;
      audio.onerror = null;
    }, []);
    
    // ==================== 核心功能 ====================
    
    /**
     * 预加载音频到指定元素
     */
    const preloadAudio = useCallback((
      audioElement: HTMLAudioElement | null,
      item: AudioQueueItem,
      audioName: string
    ) => {
      if (!audioElement) return;
      
      // 只在URL不同时才重新加载
      if (!isSameUrl(audioElement.src, item.url)) {
        console.log(`🔄 [${audioName}] 预加载音频:`, item.textRef?.text || item.url);
        audioElement.src = item.url;
        audioElement.load();
      }
    }, [isSameUrl]);
    
    /**
     * 播放指定索引的音频
     */
    const playAudioAtIndex = useCallback((index: number) => {
      const queue = queueRef.current;
      
      // 检查队列是否播放完毕
      if (index >= queue.length) {
        console.log('✅ 队列播放完毕');
        resetPlaybackState();
        return;
      }
      
      const currentItem = queue[index];
      const nextItem = queue[index + 1];
      const activeAudio = getActiveAudio();
      const standbyAudio = getStandbyAudio();
      const activeAudioName = getAudioName(activeAudioIndexRef.current);
      const standbyAudioName = getAudioName((1 - activeAudioIndexRef.current) as 0 | 1);
      
      if (!activeAudio) return;
      
      console.log(`\n========== 播放索引 ${index} (${currentItem.textRef?.text}) ==========`);
      console.log(`当前使用: ${activeAudioName}, 待机: ${standbyAudioName}`);
      
      // 设置当前音频源
      if (!isSameUrl(activeAudio.src, currentItem.url)) {
        console.log(`📥 [${activeAudioName}] 设置音频源:`, currentItem.textRef?.text);
        activeAudio.src = currentItem.url;
        // 不调用load()，让play()自动处理加载，实现边加载边播放
      } else {
        console.log(`✅ [${activeAudioName}] 当前音频已加载`);
      }
      
      // 预加载下一个音频
      if (nextItem && standbyAudio) {
        console.log(`📥 [${standbyAudioName}] 预加载下一个音频:`, nextItem.textRef?.text);
        preloadAudio(standbyAudio, nextItem, standbyAudioName);
      } else if (!nextItem) {
        console.log(`ℹ️ 没有下一个音频需要预加载`);
      }
      
      // 提前设置播放状态，避免连续enqueue时状态不一致
      isPlayingRef.current = true;
      isPausedRef.current = false;
      
      // 播放当前音频
      activeAudio.play()
        .then(() => {
          console.log(`▶️ [${activeAudioName}] 开始播放:`, currentItem.textRef?.text);
          onPlayingChange?.(currentItem.textRef);
        })
        .catch((error) => {
          console.warn(`❌ [${activeAudioName}] 播放失败，跳过:`, currentItem.textRef?.text, error);
          // 播放失败，跳到下一个
          currentIndexRef.current = index + 1;
          switchAudioIndex();
          playAudioAtIndex(currentIndexRef.current);
        });
      
      // 监听播放完成
      activeAudio.onended = () => {
        console.log(`⏹️ [${activeAudioName}] 播放完成，切换到下一个`);
        currentIndexRef.current = index + 1;
        switchAudioIndex();
        playAudioAtIndex(currentIndexRef.current);
      };
      
      // 监听错误
      activeAudio.onerror = () => {
        console.warn(`❌ [${activeAudioName}] 加载失败，跳过:`, currentItem.textRef?.text);
        currentIndexRef.current = index + 1;
        switchAudioIndex();
        playAudioAtIndex(currentIndexRef.current);
      };
      
    }, [
      getActiveAudio,
      getStandbyAudio,
      getAudioName,
      isSameUrl,
      preloadAudio,
      resetPlaybackState,
      switchAudioIndex,
      onPlayingChange
    ]);
    
    // ==================== 暴露的API ====================
    
    useImperativeHandle(ref, () => ({
      /**
       * 添加音频到队列
       */
      enqueue: (item: AudioQueueItem) => {
        const wasEmpty = queueRef.current.length === 0;
        const newIndex = queueRef.current.length;
        queueRef.current.push(item);
        
        console.log(
          `📝 [enqueue] 添加音频，索引: ${newIndex}, ` +
          `当前播放: ${currentIndexRef.current}, ` +
          `播放状态: ${isPlayingRef.current}`
        );
        
        // 场景1: 队列为空且自动播放开启，开始播放
        if (autoPlayRef.current && wasEmpty && !isPlayingRef.current && !isPausedRef.current) {
          console.log(`🎬 [enqueue] 队列为空，开始播放第一个音频`);
          currentIndexRef.current = 0;
          activeAudioIndexRef.current = 0;
          playAudioAtIndex(0);
        }
        // 场景2: 正在播放，且新添加的是下一个音频，立即预加载
        else if (isPlayingRef.current && newIndex === currentIndexRef.current + 1) {
          const standbyAudio = getStandbyAudio();
          const standbyAudioName = getAudioName((1 - activeAudioIndexRef.current) as 0 | 1);
          console.log(`📥 [enqueue] 预加载下一个音频到 ${standbyAudioName}:`, item.textRef?.text);
          preloadAudio(standbyAudio, item, standbyAudioName);
        }
        // 场景3: 其他情况，稍后播放
        else {
          console.log(`⏭️ [enqueue] 音频已加入队列，稍后播放`);
        }
      },
      
      /**
       * 暂停播放
       */
      pause: () => {
        const activeAudio = getActiveAudio();
        if (activeAudio && !activeAudio.paused) {
          activeAudio.pause();
          isPausedRef.current = true;
          isPlayingRef.current = false;
          console.log('⏸️ 暂停播放');
        }
      },
      
      /**
       * 继续播放
       */
      resume: () => {
        const activeAudio = getActiveAudio();
        if (activeAudio && isPausedRef.current) {
          activeAudio.play()
            .then(() => {
              isPausedRef.current = false;
              isPlayingRef.current = true;
              console.log('▶️ 继续播放');
            })
            .catch((error) => {
              console.warn('❌ 恢复播放失败:', error);
            });
        }
      },
      
      /**
       * 清空队列
       */
      clear: () => {
        cleanupAudio(getActiveAudio());
        cleanupAudio(getStandbyAudio());
        resetPlaybackState();
        console.log('🗑️ 清空队列');
      },
      
      /**
       * 检查是否正在播放
       */
      isPlaying: () => {
        return isPlayingRef.current && !isPausedRef.current;
      },
      
      /**
       * 获取队列剩余数量（未播放的segment数）
       */
      getQueueRemaining: () => {
        return Math.max(0, queueRef.current.length - currentIndexRef.current);
      },
      
      /**
       * 设置自动播放
       */
      setAutoPlay: (enabled: boolean) => {
        autoPlayRef.current = enabled;
        console.log(`🎛️ 自动播放: ${enabled ? '开启' : '关闭'}`);
      }
    }), [
      getActiveAudio,
      getStandbyAudio,
      getAudioName,
      playAudioAtIndex,
      preloadAudio,
      cleanupAudio,
      resetPlaybackState
    ]);
    
    // ==================== 生命周期 ====================
    
    /**
     * 组件卸载时清理资源
     */
    React.useEffect(() => {
      return () => {
        cleanupAudio(audio1Ref.current);
        cleanupAudio(audio2Ref.current);
      };
    }, [cleanupAudio]);
    
    // ==================== 渲染 ====================
    
    return (
      <div style={{ display: 'none' }}>
        {/* 双音频元素用于轮换播放 - preload="metadata"允许快速开始播放 */}
        <audio ref={audio1Ref} preload="metadata" />
        <audio ref={audio2Ref} preload="metadata" />
      </div>
    );
  }
);

AudioQueuePlayer.displayName = 'AudioQueuePlayer';

export default AudioQueuePlayer;
