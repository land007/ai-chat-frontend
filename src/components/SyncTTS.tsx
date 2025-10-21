import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Play, Pause, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createTTSOrchestrator, TTSOrchestrator } from '../services/ttsOrchestrator';
import HighlightRenderer from './HighlightRenderer';

interface SyncTTSProps {
  text: string;
  messageId: string;
  className?: string;
  isDarkMode?: boolean;
}

const SyncTTS: React.FC<SyncTTSProps> = ({
  text,
  messageId,
  className = '',
  isDarkMode = false
}) => {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // TTS编排器状态
  const [ttsProgress, setTtsProgress] = useState(0);
  const [currentParagraph, setCurrentParagraph] = useState<string | undefined>(undefined);
  const [isTTSAvailable, setIsTTSAvailable] = useState(false);
  
  // TTS编排器引用
  const ttsOrchestratorRef = useRef<TTSOrchestrator | null>(null);

  useEffect(() => {
    // 初始化TTS编排器
    const initTTS = async () => {
      try {
        const orchestrator = createTTSOrchestrator({
          tts: {
            enabled: true,
            apiUrl: '' // 将从API加载
          }
        });
        
        // 设置回调
        orchestrator.setCallbacks({
          onProgress: (progress) => {
            setTtsProgress(progress);
          },
          onParagraphChange: (paragraph, index) => {
            console.log(`[SyncTTS] 段落切换到第${index + 1}个:`, paragraph);
            setCurrentParagraph(paragraph);
          },
          onComplete: () => {
            setIsPlaying(false);
            setIsPaused(false);
            setTtsProgress(0);
            setCurrentParagraph(undefined);
          },
          onError: (error) => {
            console.error('[SyncTTS] TTS错误:', error);
            setError(error.message);
            setIsLoading(false);
            setIsPlaying(false);
            setIsPaused(false);
          },
          onReady: (ready) => {
            setIsTTSAvailable(ready);
          }
        });
        
        ttsOrchestratorRef.current = orchestrator;
        
        // 初始化TTS
        await orchestrator.loadConfigFromAPI();
      } catch (error) {
        console.error('[SyncTTS] TTS初始化失败:', error);
        setIsTTSAvailable(false);
      }
    };
    
    initTTS();
    
    return () => {
      if (ttsOrchestratorRef.current) {
        ttsOrchestratorRef.current.stop();
      }
    };
  }, []);

  // 监听文本变化，自动播放TTS
  React.useEffect(() => {
    if (!isTTSAvailable || !ttsOrchestratorRef.current || !isPlaying || isPaused) {
      return;
    }

    // 当文本变化时，自动播放TTS
    const playCurrentText = async () => {
      try {
        setIsLoading(true);
        await ttsOrchestratorRef.current!.playText(text, {});
        setIsLoading(false);
      } catch (err) {
        console.error('TTS自动播放错误:', err);
        setError(err instanceof Error ? err.message : '自动播放失败');
        setIsLoading(false);
      }
    };

    // 延迟一点时间让文本稳定
    const timer = setTimeout(playCurrentText, 100);
    return () => clearTimeout(timer);
  }, [text, isTTSAvailable, isPlaying, isPaused]);

  // 处理段落完成（保留用于手动触发）
  const handleParagraphComplete = React.useCallback(async (paragraph: string, index: number) => {
    console.log(`[SyncTTS] 段落${index + 1}完成:`, paragraph);
    
    setCurrentParagraph(paragraph);

    // 如果TTS正在播放，播放这个段落
    if (isPlaying && !isPaused && ttsOrchestratorRef.current) {
      try {
        setIsLoading(true);
        await ttsOrchestratorRef.current.playText(paragraph, {});
        setIsLoading(false);
      } catch (err) {
        console.error('TTS段落播放错误:', err);
        setError(err instanceof Error ? err.message : '段落播放失败');
        setIsLoading(false);
      }
    }
  }, [isPlaying, isPaused]);

  // 打字机不显示进度条，保留段落完成回调

  // 播放/暂停切换
  const handlePlayPause = async () => {
    if (!isTTSAvailable || !ttsOrchestratorRef.current) {
      setError('TTS服务不可用');
      return;
    }

    try {
      setError(null);

      if (isPlaying && !isPaused) {
        // 暂停播放
        ttsOrchestratorRef.current.pause();
        setIsPaused(true);
      } else if (isPaused) {
        // 恢复播放
        ttsOrchestratorRef.current.resume();
        setIsPaused(false);
      } else {
        // 开始播放
        setIsPlaying(true);
        setIsPaused(false);
        
        // 播放整个文本
        setIsLoading(true);
        await ttsOrchestratorRef.current.playText(text, {});
        setIsLoading(false);
      }
    } catch (err) {
      console.error('TTS播放错误:', err);
      setError(err instanceof Error ? err.message : '播放失败');
      setIsLoading(false);
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  // 停止播放
  const handleStop = () => {
    if (ttsOrchestratorRef.current) {
      ttsOrchestratorRef.current.stop();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setTtsProgress(0);
    setCurrentParagraph(undefined);
  };

  // 如果TTS不可用，只显示普通文本，不高亮，不调用段落完成回调
  // 高亮功能与TTS功能绑定，只有在TTS可用时才显示高亮
  if (!isTTSAvailable) {
    return (
      <div className={className}>
        <HighlightRenderer
          text={text}
          currentPlayingParagraph={undefined} // 不传递高亮段落，确保不高亮
          isDarkMode={isDarkMode}
          typewriterSpeed={30}
          onParagraphComplete={undefined} // 不传递段落完成回调，避免不必要的调用
        />
      </div>
    );
  }

  const buttonStyle = {
    background: 'none',
    border: 'none',
    padding: '6px',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    opacity: 0.7
  };

  const buttonHoverStyle = {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    opacity: 1
  };

  return (
    <div className={className}>
      {/* 错误提示 */}
      {error && (
        <div style={{
          color: '#ef4444',
          fontSize: '12px',
          marginBottom: '8px',
          padding: '4px 8px',
          backgroundColor: '#fef2f2',
          borderRadius: '4px',
          border: '1px solid #fecaca'
        }}>
          {error}
        </div>
      )}

      {/* 高亮渲染器 */}
      <div style={{ marginBottom: '12px' }}>
        <HighlightRenderer
          text={text}
          currentPlayingParagraph={currentParagraph}
          isDarkMode={isDarkMode}
          typewriterSpeed={30}
          onParagraphComplete={handleParagraphComplete}
        />
      </div>

      {/* 播放控制按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <button
          style={buttonStyle}
          onClick={handlePlayPause}
          disabled={isLoading}
          onMouseEnter={(e) => {
            if (!isLoading) {
              Object.assign(e.currentTarget.style, buttonHoverStyle);
            }
          }}
          onMouseLeave={(e) => {
            Object.assign(e.currentTarget.style, buttonStyle);
          }}
          title={isLoading ? t('ui.generating') : (isPlaying && !isPaused ? t('ui.pause') : t('ui.play'))}
        >
          {isLoading ? (
            <Volume2 size={14} style={{ animation: 'pulse 1s infinite' }} />
          ) : isPlaying && !isPaused ? (
            <Pause size={14} />
          ) : (
            <Play size={14} />
          )}
        </button>

        {isPlaying && (
          <button
            style={buttonStyle}
            onClick={handleStop}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, buttonHoverStyle);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, buttonStyle);
            }}
            title={t('ui.stop')}
          >
            <Square size={14} />
          </button>
        )}

        {/* TTS播放进度 */}
        <div style={{
          flex: 1,
          height: '4px',
          backgroundColor: '#e5e7eb',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div
            style={{
              width: `${ttsProgress * 100}%`,
              height: '100%',
              backgroundColor: '#3b82f6',
              transition: 'width 0.3s ease'
            }}
            title={`TTS播放进度: ${Math.round(ttsProgress * 100)}%`}
          />
        </div>
      </div>

    </div>
  );
};

export default SyncTTS;
