import React from 'react';
import { Download, File } from 'lucide-react';

interface FileDownloaderProps {
  url: string;
  fileName?: string;
  isDarkMode?: boolean;
}

const FileDownloader: React.FC<FileDownloaderProps> = ({ 
  url, 
  fileName: providedFileName, 
  isDarkMode = false 
}) => {
  // 如果没有提供文件名，从 URL 中提取
  const getFileName = (): string => {
    if (providedFileName) {
      return providedFileName;
    }
    
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/');
      const lastSegment = segments[segments.length - 1];
      
      if (lastSegment && lastSegment.includes('.')) {
        return decodeURIComponent(lastSegment);
      }
    } catch (error) {
      console.error('[文件下载] URL解析失败:', error);
    }
    
    return '下载文件';
  };

  const fileName = getFileName();

  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
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
          文件URL格式无效，必须是有效的HTTP或HTTPS链接
        </p>
      </div>
    );
  }

  return (
    <div>
      <a
        href={url}
        download={fileName}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
          borderRadius: '8px',
          textDecoration: 'none',
          color: isDarkMode ? '#f9fafb' : '#111827',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#e5e7eb';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#f3f4f6';
        }}
      >
        <File size={20} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontWeight: '500' }}>{fileName}</span>
        <Download size={18} style={{ flexShrink: 0, opacity: 0.7 }} />
      </a>
    </div>
  );
};

export default FileDownloader;

