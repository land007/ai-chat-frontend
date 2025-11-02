import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ImageViewerProps {
  src: string;
  alt?: string;
  isDarkMode?: boolean;
}

type TouchPoint = {
  clientX: number;
  clientY: number;
};

const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt = '', isDarkMode = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // 缩放和平移状态
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // 触摸手势状态
  const touchStateRef = useRef<{
    isDragging: boolean;
    isPinching: boolean;
    lastTouch1: { x: number; y: number } | null;
    lastTouch2: { x: number; y: number } | null;
    lastDistance: number;
    lastScale: number;
    lastTranslateX: number;
    lastTranslateY: number;
    startX: number;
    startY: number;
  }>({
    isDragging: false,
    isPinching: false,
    lastTouch1: null,
    lastTouch2: null,
    lastDistance: 0,
    lastScale: 1,
    lastTranslateX: 0,
    lastTranslateY: 0,
    startX: 0,
    startY: 0,
  });

  // 计算两点之间的距离
  const getDistance = (touch1: TouchPoint, touch2: TouchPoint): number => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 限制缩放范围
  const clampScale = (value: number): number => {
    return Math.max(0.1, Math.min(5, value));
  };

  // 限制平移范围
  const clampTranslate = (x: number, y: number, currentScale: number) => {
    if (!containerRef.current || !imageRef.current || !imageLoaded) return { x: 0, y: 0 };
    
    const container = containerRef.current;
    const image = imageRef.current;
    
    const containerRect = container.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    
    const scaledWidth = imageRect.width * currentScale;
    const scaledHeight = imageRect.height * currentScale;
    
    const maxX = Math.max(0, (scaledWidth - containerRect.width) / 2);
    const maxY = Math.max(0, (scaledHeight - containerRect.height) / 2);
    
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  // 处理鼠标滚轮缩放
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = clampScale(scale * delta);
    
    setScale(newScale);
    
    // 重置平移位置以适应新的缩放级别
    const clamped = clampTranslate(translateX, translateY, newScale);
    setTranslateX(clamped.x);
    setTranslateY(clamped.y);
  }, [scale, translateX, translateY, imageLoaded]);

  // 触摸开始
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touches = e.touches;
    
    if (touches.length === 1) {
      // 单指：准备平移
      const touch = touches[0];
      touchStateRef.current.isDragging = true;
      touchStateRef.current.lastTouch1 = { x: touch.clientX, y: touch.clientY };
      touchStateRef.current.startX = touch.clientX;
      touchStateRef.current.startY = touch.clientY;
      touchStateRef.current.lastTranslateX = translateX;
      touchStateRef.current.lastTranslateY = translateY;
    } else if (touches.length === 2) {
      // 双指：准备缩放
      touchStateRef.current.isPinching = true;
      touchStateRef.current.isDragging = false;
      touchStateRef.current.lastTouch1 = { x: touches[0].clientX, y: touches[0].clientY };
      touchStateRef.current.lastTouch2 = { x: touches[1].clientX, y: touches[1].clientY };
      touchStateRef.current.lastDistance = getDistance(touches[0], touches[1]);
      touchStateRef.current.lastScale = scale;
    }
  }, [translateX, translateY, scale]);

  // 触摸移动
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touches = e.touches;
    const state = touchStateRef.current;

    if (touches.length === 1 && state.isDragging && state.lastTouch1) {
      // 单指平移
      const touch = touches[0];
      const deltaX = touch.clientX - state.lastTouch1.x;
      const deltaY = touch.clientY - state.lastTouch1.y;
      
      const newX = state.lastTranslateX + deltaX;
      const newY = state.lastTranslateY + deltaY;
      
      const clamped = clampTranslate(newX, newY, scale);
      setTranslateX(clamped.x);
      setTranslateY(clamped.y);
    } else if (touches.length === 2 && state.isPinching && state.lastTouch1 && state.lastTouch2) {
      // 双指缩放
      const touch1 = touches[0];
      const touch2 = touches[1];
      const currentDistance = getDistance(touch1, touch2);
      
      if (state.lastDistance > 0) {
        const distanceRatio = currentDistance / state.lastDistance;
        const newScale = clampScale(state.lastScale * distanceRatio);
        setScale(newScale);
        
        // 在缩放时保持中心点
        const clamped = clampTranslate(translateX, translateY, newScale);
        setTranslateX(clamped.x);
        setTranslateY(clamped.y);
      }
      
      state.lastTouch1 = { x: touch1.clientX, y: touch1.clientY };
      state.lastTouch2 = { x: touch2.clientX, y: touch2.clientY };
      state.lastDistance = currentDistance;
    }
  }, [scale, translateX, translateY, imageLoaded]);

  // 触摸结束
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    touchStateRef.current.isDragging = false;
    touchStateRef.current.isPinching = false;
    touchStateRef.current.lastTouch1 = null;
    touchStateRef.current.lastTouch2 = null;
    touchStateRef.current.lastDistance = 0;
  }, []);

  // 鼠标拖动平移
  const isMouseDraggingRef = useRef(false);
  const mouseStartPosRef = useRef({ x: 0, y: 0 });
  const mouseStartTranslateRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(scale);
  const translateXRef = useRef(translateX);
  const translateYRef = useRef(translateY);

  // 同步ref值
  useEffect(() => {
    scaleRef.current = scale;
    translateXRef.current = translateX;
    translateYRef.current = translateY;
  }, [scale, translateX, translateY]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只处理左键
    isMouseDraggingRef.current = true;
    setIsDragging(true);
    mouseStartPosRef.current = { x: e.clientX, y: e.clientY };
    mouseStartTranslateRef.current = { x: translateXRef.current, y: translateYRef.current };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!isMouseDraggingRef.current) return;
    const deltaX = e.clientX - mouseStartPosRef.current.x;
    const deltaY = e.clientY - mouseStartPosRef.current.y;
    
    const newX = mouseStartTranslateRef.current.x + deltaX;
    const newY = mouseStartTranslateRef.current.y + deltaY;
    
    const clamped = clampTranslate(newX, newY, scaleRef.current);
    setTranslateX(clamped.x);
    setTranslateY(clamped.y);
  }, [imageLoaded]);

  const handleMouseUp = useCallback(() => {
    isMouseDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  // 全屏功能
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('[ImageViewer] 全屏切换失败:', err);
    }
  }, [isFullscreen]);

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 缩放按钮处理
  const handleZoomIn = useCallback(() => {
    const newScale = clampScale(scale * 1.2);
    setScale(newScale);
    const clamped = clampTranslate(translateX, translateY, newScale);
    setTranslateX(clamped.x);
    setTranslateY(clamped.y);
  }, [scale, translateX, translateY, imageLoaded]);

  const handleZoomOut = useCallback(() => {
    const newScale = clampScale(scale * 0.8);
    setScale(newScale);
    const clamped = clampTranslate(translateX, translateY, newScale);
    setTranslateX(clamped.x);
    setTranslateY(clamped.y);
  }, [scale, translateX, translateY, imageLoaded]);

  const handleReset = useCallback(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  // 图片加载处理
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setError(null);
    // 重置缩放和平移
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  const handleImageError = useCallback(() => {
    setImageLoaded(false);
    setError('图片加载失败');
  }, []);

  // 绑定滚轮事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // 绑定全局鼠标事件
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        margin: '8px 0',
        padding: '16px',
        backgroundColor: isDarkMode ? '#1e1e1e' : '#f8f9fa',
        borderRadius: '8px',
        overflow: 'hidden',
        touchAction: 'none', // 禁用默认触摸行为
        cursor: isDragging ? 'grabbing' : 'grab',
        minHeight: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 控制工具栏 */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 10,
          display: 'flex',
          gap: '4px',
          backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.9)',
          padding: '4px',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }}
      >
        <button
          onClick={handleZoomIn}
          style={{
            padding: '6px 10px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#374151' : '#e5e7eb',
            color: isDarkMode ? '#f9fafb' : '#111827',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
          title="放大 (+)"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          style={{
            padding: '6px 10px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#374151' : '#e5e7eb',
            color: isDarkMode ? '#f9fafb' : '#111827',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
          title="缩小 (-)"
        >
          −
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: '6px 10px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#374151' : '#e5e7eb',
            color: isDarkMode ? '#f9fafb' : '#111827',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
          title="重置"
        >
          ⟲
        </button>
        <button
          onClick={toggleFullscreen}
          style={{
            padding: '6px 10px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#374151' : '#e5e7eb',
            color: isDarkMode ? '#f9fafb' : '#111827',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
          title={isFullscreen ? '退出全屏' : '全屏'}
        >
          {isFullscreen ? '⤓' : '⤢'}
        </button>
      </div>

      {/* 缩放比例显示 */}
      {scale !== 1 && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            zIndex: 10,
            padding: '4px 8px',
            backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.9)',
            borderRadius: '4px',
            fontSize: '12px',
            color: isDarkMode ? '#f9fafb' : '#111827',
          }}
        >
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div
          style={{
            color: isDarkMode ? '#ef4444' : '#dc2626',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {/* 图片内容容器 */}
      <div
        ref={contentRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: scale !== 1 ? 'none' : 'transform 0.2s ease',
        }}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            height: 'auto',
            width: 'auto',
            display: 'block',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          draggable={false}
        />
      </div>
    </div>
  );
};

export default ImageViewer;

