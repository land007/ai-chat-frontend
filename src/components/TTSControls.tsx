import React, { useState, useEffect } from 'react';
import { Volume2, Play, Pause, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ttsService } from '../services/tts';
import TextHighlighter from './TextHighlighter';

interface TTSControlsProps {
  text: string;
  messageId: string;
  className?: string;
}

const TTSControls: React.FC<TTSControlsProps> = ({
  text,
  messageId,
  className = ''
}) => {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParagraph, setCurrentParagraph] = useState<string | undefined>(undefined);

  // 检查TTS是否可用
  const isTTSAvailable = ttsService.isAvailable();

  useEffect(() => {
    // 设置进度回调
    ttsService.setProgressCallback((progressValue) => {
      setProgress(progressValue);
    });

    // 设置完成回调
    ttsService.setCompleteCallback(() => {
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(0);
      setCurrentParagraph(undefined);
    });

    // 定时更新当前段落
    const interval = setInterval(() => {
      if (isPlaying) {
        const state = ttsService.getPlayingState();
        setCurrentParagraph(state.currentParagraph);
      }
    }, 100);

    return () => {
      // 组件卸载时停止播放
      ttsService.stop();
      clearInterval(interval);
    };
  }, [isPlaying]);

  // 从TTS API URL中解析参数
  const parseTTSParams = () => {
    try {
      const config = ttsService.getConfig();
      // 由于URL包含模板字符串{text}，无法直接解析
      // 直接返回空参数，让TTS服务自己处理URL
      return {};
    } catch (error) {
      console.warn('解析TTS URL参数失败:', error);
      return {};
    }
  };

  // 播放/暂停切换
  const handlePlayPause = async () => {
    if (!isTTSAvailable) {
      setError('TTS服务不可用');
      return;
    }

    try {
      setError(null);

      if (isPlaying && !isPaused) {
        // 暂停播放
        ttsService.pause();
        setIsPaused(true);
      } else if (isPaused) {
        // 恢复播放
        ttsService.resume();
        setIsPaused(false);
      } else {
        // 开始播放
        setIsLoading(true);
        
        // 从URL中解析参数
        const ttsParams = parseTTSParams();
        
        // 播放文本（段落方式）
        await ttsService.playText(text, ttsParams);
        
        setIsPlaying(true);
        setIsPaused(false);
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
    ttsService.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentParagraph(undefined);
  };

  // 如果TTS不可用，不显示控件
  if (!isTTSAvailable) {
    return null;
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
    <div className={className} style={{ marginTop: '4px', display: 'inline-block' }}>
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

      {/* 播放控制按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
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

        {/* 播放进度 */}
        {isPlaying && (
          <div style={{
            flex: 1,
            height: '4px',
            backgroundColor: '#e5e7eb',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div
              style={{
                width: `${progress * 100}%`,
                height: '100%',
                backgroundColor: '#3b82f6',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        )}
      </div>

      {/* 文本高亮显示 */}
      {isPlaying && (
        <div style={{
          padding: '8px',
          backgroundColor: '#f8fafc',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          <TextHighlighter
            text={text}
            progress={progress}
            highlightColor="#3b82f6"
            currentParagraph={currentParagraph}
          />
        </div>
      )}
    </div>
  );
};

export default TTSControls;
