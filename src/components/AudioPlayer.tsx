import React, { useRef } from 'react';

interface AudioPlayerProps {
  url: string;
  isDarkMode?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ url, isDarkMode = false }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    console.error('[音频] 加载失败:', url, e);
  };

  if (!url || !url.trim()) {
    return (
      <div style={{ 
        margin: '16px 0',
        padding: '12px',
        backgroundColor: isDarkMode ? '#2d1f1f' : '#fee',
        borderRadius: '6px',
        border: `1px solid ${isDarkMode ? '#ef4444' : '#dc2626'}`
      }}>
        <p style={{ 
          margin: 0, 
          color: isDarkMode ? '#ef4444' : '#dc2626',
          fontSize: '14px'
        }}>
          音频URL不能为空
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      margin: '16px 0',
      padding: '12px',
      backgroundColor: isDarkMode ? '#1e1e1e' : '#f8f9fa',
      borderRadius: '8px',
      border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`
    }}>
      <audio
        ref={audioRef}
        controls
        style={{
          width: '100%',
          outline: 'none'
        }}
        onError={handleError}
      >
        <source src={url.trim()} />
        您的浏览器不支持音频播放
      </audio>
    </div>
  );
};

export default AudioPlayer;

