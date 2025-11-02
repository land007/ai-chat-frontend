import React, { useRef } from 'react';

interface VideoPlayerProps {
  url: string;
  isDarkMode?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, isDarkMode = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('[视频] 加载失败:', url, e);
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
          视频URL不能为空
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
      <video
        ref={videoRef}
        controls
        style={{
          width: '100%',
          maxHeight: '600px',
          borderRadius: '4px',
          outline: 'none'
        }}
        onError={handleError}
      >
        <source src={url.trim()} />
        您的浏览器不支持视频播放
      </video>
    </div>
  );
};

export default VideoPlayer;

