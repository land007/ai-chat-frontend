import React, { useState, useEffect } from 'react';
import { Volume2, Play, Pause, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ttsService } from '../services/tts';
import TypewriterEffect from './TypewriterEffect';

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
  
  // 进度状态
  const [ttsProgress, setTtsProgress] = useState(0);
  const [currentParagraph, setCurrentParagraph] = useState<string | undefined>(undefined);
  
  // 段落状态
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const [completedParagraphs, setCompletedParagraphs] = useState<Set<number>>(new Set());

  // 检查TTS是否可用
  const isTTSAvailable = ttsService.isAvailable();

  useEffect(() => {
    // 设置TTS进度回调
    ttsService.setProgressCallback((progress) => {
      setTtsProgress(progress);
    });

    // 设置TTS完成回调
    ttsService.setCompleteCallback(() => {
      setIsPlaying(false);
      setIsPaused(false);
      setTtsProgress(0);
      setCurrentParagraph(undefined);
    });

    return () => {
      ttsService.stop();
    };
  }, []);

  // 处理段落完成
  const handleParagraphComplete = async (paragraph: string, index: number) => {
    console.log(`[SyncTTS] 段落${index + 1}完成:`, paragraph);
    
    setCompletedParagraphs(prev => new Set([...Array.from(prev), index]));
    setCurrentParagraphIndex(index);
    setCurrentParagraph(paragraph);

    // 如果TTS正在播放，播放这个段落
    if (isPlaying && !isPaused) {
      try {
        setIsLoading(true);
        await ttsService.playText(paragraph, {});
        setIsLoading(false);
      } catch (err) {
        console.error('TTS段落播放错误:', err);
        setError(err instanceof Error ? err.message : '段落播放失败');
        setIsLoading(false);
      }
    }
  };

  // 打字机不显示进度条，保留段落完成回调

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
        await ttsService.resume();
        setIsPaused(false);
      } else {
        // 开始播放
        setIsPlaying(true);
        setIsPaused(false);
        
        // 播放当前段落（如果有）
        if (currentParagraph) {
          setIsLoading(true);
          await ttsService.playText(currentParagraph, {});
          setIsLoading(false);
        }
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
    setTtsProgress(0);
    setCurrentParagraph(undefined);
  };

  // 如果TTS不可用，不显示控件
  if (!isTTSAvailable) {
    return (
      <div className={className}>
        <TypewriterEffect
          text={text}
          speed={30}
          onParagraphComplete={handleParagraphComplete}
          isDarkMode={isDarkMode}
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

      {/* 打字机效果 */}
      <div style={{ marginBottom: '12px' }}>
        <TypewriterEffect
          text={text}
          speed={30}
          onParagraphComplete={handleParagraphComplete}
          isDarkMode={isDarkMode}
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

      {/* 当前播放段落显示 */}
      {currentParagraph && (
        <div style={{
          padding: '8px',
          backgroundColor: '#f0f8ff',
          borderRadius: '6px',
          border: '2px solid #3b82f6',
          fontSize: '14px',
          lineHeight: '1.5',
          marginTop: '8px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#3b82f6' }}>
            正在播放段落 {currentParagraphIndex + 1}:
          </div>
          {currentParagraph}
        </div>
      )}
    </div>
  );
};

export default SyncTTS;
