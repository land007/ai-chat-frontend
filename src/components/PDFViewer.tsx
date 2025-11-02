import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
// react-pdf v10 的 CSS 已内置，无需手动导入
// 如果需要自定义样式，可以通过 className 覆盖

// 配置 PDF.js worker - 使用本地文件（支持 http 和 https）
// 注意：react-pdf v10 需要正确配置 worker 才能发起网络请求
if (typeof window !== 'undefined') {
  // 使用本地 worker 文件（public 目录）
  const localWorkerUrl = '/pdf.worker.min.mjs';
  pdfjs.GlobalWorkerOptions.workerSrc = localWorkerUrl;
  
  console.log('[PDF查看器] Worker 配置完成:', {
    version: pdfjs.version,
    workerSrc: localWorkerUrl
  });
}

interface PDFViewerProps {
  url: string;
  isDarkMode?: boolean;
  useProxy?: boolean; // 是否使用代理（默认true，避免CORS）
}

interface DocumentViewProps {
  fileUrl: string;
  pageNumber: number;
  isDarkMode: boolean;
  options: {
    cMapUrl: string;
    cMapPacked: boolean;
    standardFontDataUrl: string;
  };
  onLoadSuccess: ({ numPages }: { numPages: number }) => void;
  onLoadError: (error: Error) => void;
  onSourceError: (error: Error) => void;
}

const DocumentView: React.FC<DocumentViewProps> = ({
  fileUrl,
  pageNumber,
  isDarkMode,
  options,
  onLoadSuccess,
  onLoadError,
  onSourceError,
}) => (
  <Document
    file={fileUrl}
    onLoadSuccess={onLoadSuccess}
    onLoadError={onLoadError}
    loading={
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px',
          color: isDarkMode ? '#9ca3af' : '#6b7280',
        }}
      >
        <div>加载 PDF...</div>
        <div
          style={{
            marginTop: '10px',
            fontSize: '12px',
            opacity: 0.7,
            wordBreak: 'break-all',
            maxWidth: '80%',
            textAlign: 'center',
          }}
        >
          {fileUrl}
        </div>
      </div>
    }
    options={options}
    externalLinkTarget="_blank"
    onSourceError={onSourceError}
  >
    <Page
      pageNumber={pageNumber}
      scale={1}
      renderTextLayer={true}
      renderAnnotationLayer={true}
      className="pdf-page"
    />
  </Document>
);

const MemoizedDocumentView = React.memo(
  DocumentView,
  (prev, next) =>
    prev.fileUrl === next.fileUrl &&
    prev.pageNumber === next.pageNumber &&
    prev.isDarkMode === next.isDarkMode
);

const PDFViewer: React.FC<PDFViewerProps> = ({ url, isDarkMode = false, useProxy = true }) => {
  console.log('[PDF查看器] 组件渲染, url:', url);
  
  // 所有 hooks 必须在条件检查之前调用
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // 使用 ref 避免拖拽时频繁触发渲染
  const positionRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [pdfFileUrl, setPdfFileUrl] = useState<string>('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ distance: number; center: { x: number; y: number } } | null>(null);
  const touchLastDistanceRef = useRef<number>(0);

  // 响应式检测
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // PDF 加载成功回调
  const onDocumentLoadSuccess = React.useCallback(
    ({ numPages }: { numPages: number }) => {
      console.log('[PDF查看器] 加载成功, 总页数:', numPages, '原始URL:', url, '使用URL:', pdfFileUrl);
      setNumPages(numPages);
      setError(null);
    },
    [url, pdfFileUrl]
  );

  // PDF 加载失败回调
  const onDocumentLoadError = React.useCallback(
    (error: Error) => {
      console.error('[PDF查看器] 加载失败:', error, '原始URL:', url, '使用URL:', pdfFileUrl);
      setError(`PDF加载失败: ${error.message || '未知错误'}`);
    },
    [url, pdfFileUrl]
  );

  const documentOptions = React.useMemo(() => ({
    cMapUrl: '/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/standard_fonts/',
  }), []);

  const handleSourceError = React.useCallback((error: Error) => {
    console.error('[PDF查看器] Source错误:', error);
    setError(`PDF源错误: ${error.message || '未知错误'}`);
  }, []);

  // 监听 URL 变化，重置状态并构建代理URL
  useEffect(() => {
    // 清理 URL（去除空格、换行等）
    const cleanUrl = url?.trim() || '';
    console.log('[PDF查看器] URL 变化:', cleanUrl, 'useProxy:', useProxy);
    
    // 如果使用代理，构建代理URL
    if (useProxy && cleanUrl && (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://'))) {
      const proxyUrl = `/api/pdf/proxy?url=${encodeURIComponent(cleanUrl)}`;
      console.log('[PDF查看器] 使用代理URL:', proxyUrl);
      setPdfFileUrl(proxyUrl);
    } else if (cleanUrl) {
      console.log('[PDF查看器] 使用直接URL:', cleanUrl);
      setPdfFileUrl(cleanUrl);
    } else {
      console.warn('[PDF查看器] URL 为空');
      setPdfFileUrl('');
    }
    
    // 重置状态（不再控制 loading，由 Document 组件自己处理）
    setError(null);
    setNumPages(null);
    setPageNumber(1);
    setScale(1.0);
    positionRef.current = { x: 0, y: 0 };
    setPosition({ x: 0, y: 0 });
  }, [url, useProxy]);

  // 监听 pdfFileUrl 变化，记录实际使用的URL
  useEffect(() => {
    if (pdfFileUrl) {
      console.log('[PDF查看器] PDF文件URL已设置:', pdfFileUrl);
    }
  }, [pdfFileUrl]);

  // 缩放功能
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1.0);
    positionRef.current = { x: 0, y: 0 };
    setPosition({ x: 0, y: 0 });
  };

  // 页面导航
  const handlePrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages || 1));
  };

  // 鼠标拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只处理左键
    isDraggingRef.current = true;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y
    });
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const newPosition = {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    };
    positionRef.current = newPosition;
    
    // 使用 requestAnimationFrame 优化渲染
    requestAnimationFrame(() => {
      setPosition(newPosition);
    });
    e.preventDefault();
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(prev => Math.max(0.5, Math.min(3.0, prev + delta)));
    }
  };

  // 触摸手势处理
  const getDistance = (touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (touch1: React.Touch, touch2: React.Touch): { x: number; y: number } => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 双指手势：缩放
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = getDistance(touch1, touch2);
      const center = getCenter(touch1, touch2);
      touchStartRef.current = { distance, center };
      touchLastDistanceRef.current = distance;
    } else if (e.touches.length === 1) {
      // 单指手势：平移
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current) {
      // 双指缩放
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = getDistance(touch1, touch2);
      const delta = distance - touchLastDistanceRef.current;
      touchLastDistanceRef.current = distance;
      
      setScale(prev => {
        const newScale = prev + (delta / 100);
        return Math.max(0.5, Math.min(3.0, newScale));
      });
      e.preventDefault();
    } else if (e.touches.length === 1 && isDragging) {
      // 单指平移
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartRef.current = null;
    touchLastDistanceRef.current = 0;
  };

  // 清理事件监听器
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const newPosition = {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        };
        positionRef.current = newPosition;
        
        // 使用 requestAnimationFrame 优化渲染
        requestAnimationFrame(() => {
          setPosition(newPosition);
        });
      }
    };

    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart]);

  // 验证 URL - 在所有 hooks 之后进行
  useEffect(() => {
    console.log('[PDF查看器] 初始化, workerSrc:', pdfjs.GlobalWorkerOptions.workerSrc);
    console.log('[PDF查看器] pdfjs.version:', pdfjs.version);
    console.log('[PDF查看器] GlobalWorkerOptions:', {
      workerSrc: pdfjs.GlobalWorkerOptions.workerSrc
    });
  }, []);

  // 验证 URL - 在所有 hooks 之后进行
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    console.warn('[PDF查看器] URL 格式无效:', url);
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
          PDF URL格式无效，必须是有效的HTTP或HTTPS链接
        </p>
      </div>
    );
  }

  return (
    <div style={{
      margin: '16px 0',
      backgroundColor: isDarkMode ? '#2d3748' : '#f6f8fa',
      border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* 控制栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '8px 12px' : '12px 16px',
        backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
        borderBottom: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
        flexWrap: 'wrap',
        gap: isMobile ? '8px' : '12px'
      }}>
        {/* 页面导航 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handlePrevPage}
            disabled={pageNumber <= 1}
            style={{
              padding: isMobile ? '6px 10px' : '8px 12px',
              backgroundColor: pageNumber <= 1 
                ? (isDarkMode ? '#4b5563' : '#e5e7eb')
                : (isDarkMode ? '#4b5563' : '#fff'),
              color: pageNumber <= 1 
                ? (isDarkMode ? '#6b7280' : '#9ca3af')
                : (isDarkMode ? '#e5e7eb' : '#111827'),
              border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
              borderRadius: '4px',
              cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer',
              fontSize: isMobile ? '12px' : '14px',
              transition: 'all 0.2s'
            }}
          >
            上一页
          </button>
          <span style={{
            color: isDarkMode ? '#e5e7eb' : '#111827',
            fontSize: isMobile ? '12px' : '14px',
            minWidth: isMobile ? '60px' : '80px',
            textAlign: 'center'
          }}>
            {pageNumber} / {numPages || '...'}
          </span>
          <button
            onClick={handleNextPage}
            disabled={!numPages || pageNumber >= numPages}
            style={{
              padding: isMobile ? '6px 10px' : '8px 12px',
              backgroundColor: (!numPages || pageNumber >= numPages)
                ? (isDarkMode ? '#4b5563' : '#e5e7eb')
                : (isDarkMode ? '#4b5563' : '#fff'),
              color: (!numPages || pageNumber >= numPages)
                ? (isDarkMode ? '#6b7280' : '#9ca3af')
                : (isDarkMode ? '#e5e7eb' : '#111827'),
              border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
              borderRadius: '4px',
              cursor: (!numPages || pageNumber >= numPages) ? 'not-allowed' : 'pointer',
              fontSize: isMobile ? '12px' : '14px',
              transition: 'all 0.2s'
            }}
          >
            下一页
          </button>
        </div>

        {/* 缩放控制 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            style={{
              padding: isMobile ? '6px 8px' : '8px 10px',
              backgroundColor: scale <= 0.5
                ? (isDarkMode ? '#4b5563' : '#e5e7eb')
                : (isDarkMode ? '#4b5563' : '#fff'),
              color: scale <= 0.5
                ? (isDarkMode ? '#6b7280' : '#9ca3af')
                : (isDarkMode ? '#e5e7eb' : '#111827'),
              border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
              borderRadius: '4px',
              cursor: scale <= 0.5 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s'
            }}
            title="缩小 (Ctrl + 滚轮)"
          >
            <ZoomOut size={isMobile ? 16 : 18} />
          </button>
          <span style={{
            color: isDarkMode ? '#e5e7eb' : '#111827',
            fontSize: isMobile ? '12px' : '14px',
            minWidth: isMobile ? '45px' : '55px',
            textAlign: 'center'
          }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={scale >= 3.0}
            style={{
              padding: isMobile ? '6px 8px' : '8px 10px',
              backgroundColor: scale >= 3.0
                ? (isDarkMode ? '#4b5563' : '#e5e7eb')
                : (isDarkMode ? '#4b5563' : '#fff'),
              color: scale >= 3.0
                ? (isDarkMode ? '#6b7280' : '#9ca3af')
                : (isDarkMode ? '#e5e7eb' : '#111827'),
              border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
              borderRadius: '4px',
              cursor: scale >= 3.0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s'
            }}
            title="放大 (Ctrl + 滚轮)"
          >
            <ZoomIn size={isMobile ? 16 : 18} />
          </button>
          <button
            onClick={handleResetZoom}
            style={{
              padding: isMobile ? '6px 8px' : '8px 10px',
              backgroundColor: isDarkMode ? '#4b5563' : '#fff',
              color: isDarkMode ? '#e5e7eb' : '#111827',
              border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s'
            }}
            title="重置缩放"
          >
            <RotateCcw size={isMobile ? 16 : 18} />
          </button>
        </div>
      </div>

      {/* PDF 显示区域 */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          overflow: 'auto',
          maxHeight: isMobile ? '60vh' : '70vh',
          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {error && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: isDarkMode ? '#ef4444' : '#dc2626'
          }}>
            {error}
          </div>
        )}

        {pdfFileUrl && !error && (
          <div
            ref={pageRef}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'top left',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              padding: isMobile ? '12px' : '20px',
              display: 'flex',
              justifyContent: 'center',
              minHeight: isMobile ? '300px' : '400px'
            }}
          >
            <div style={{
              boxShadow: isDarkMode 
                ? '0 4px 6px rgba(0, 0, 0, 0.3)' 
                : '0 4px 6px rgba(0, 0, 0, 0.1)',
              maxWidth: '100%',
              height: 'auto'
            }}>
              <MemoizedDocumentView
                key={url}
                fileUrl={pdfFileUrl}
                pageNumber={pageNumber}
                isDarkMode={isDarkMode}
                options={documentOptions}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                onSourceError={handleSourceError}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;

