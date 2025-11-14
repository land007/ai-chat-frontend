import React, { useState, useRef } from 'react';
import { X, Edit2, Mic } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

const ArcButtonLayoutTest: React.FC = () => {
  const [isPressed, setIsPressed] = useState(false);
  const [touchPosition, setTouchPosition] = useState<Point | null>(null);
  const [highlightedArea, setHighlightedArea] = useState<'cancel' | 'edit' | 'send' | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // 布局参数
  const containerHeight = 280; // 大元素高度（从350px减少到280px，整体下移70px）
  const arcRadius = 200; // 圆弧半径（保持不变）
  const buttonDistance = 120; // 按钮距离圆弧中心的距离（保持不变）

  // 获取触摸位置
  const getTouchPoint = (e: React.TouchEvent | React.MouseEvent): Point => {
    if ('touches' in e && e.touches.length > 0) {
      const touch = e.touches[0];
      return {
        x: touch.clientX,
        y: touch.clientY
      };
    } else if ('clientX' in e) {
      return {
        x: e.clientX,
        y: e.clientY
      };
    }
    return { x: 0, y: 0 };
  };

  // 检测触摸点所在区域（基于屏幕区域）
  const detectArea = (x: number, y: number, screenWidth: number): 'cancel' | 'edit' | 'send' | null => {
    // 检测是否在取消区域（左侧30%）
    if (x < screenWidth * 0.3) {
      return 'cancel';
    }
    // 检测是否在编辑区域（右侧30%）
    if (x > screenWidth * 0.7) {
      return 'edit';
    }
    // 检测是否在发送区域（中央40%）
    if (x >= screenWidth * 0.3 && x <= screenWidth * 0.7) {
      return 'send';
    }
    return null;
  };

  // 处理按下
  const handlePointerDown = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const point = getTouchPoint(e);
    setIsPressed(true);
    setTouchPosition(point);
    setHighlightedArea(null);
    setSelectedAction(null);
  };

  // 处理移动
  const handlePointerMove = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (!isPressed) return;
    
    const point = getTouchPoint(e);
    setTouchPosition(point);
    
    // 检测触摸点所在区域
    const screenWidth = containerRef.current?.clientWidth || window.innerWidth;
    const area = detectArea(point.x, point.y, screenWidth);
    setHighlightedArea(area);
  };

  // 处理松开
  const handlePointerUp = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (!isPressed) return;
    
    const point = getTouchPoint(e);
    const screenWidth = containerRef.current?.clientWidth || window.innerWidth;
    const area = detectArea(point.x, point.y, screenWidth);
    
    // 记录操作结果（不显示弹窗，仅用于内部处理）
    if (area === 'cancel') {
      setSelectedAction('取消');
    } else if (area === 'edit') {
      setSelectedAction('编辑');
    } else {
      setSelectedAction('松开发送');
    }
    
    setIsPressed(false);
    setTouchPosition(null);
    setHighlightedArea(null);
    
    // 立即清除操作结果，恢复初始状态
    setTimeout(() => {
      setSelectedAction(null);
    }, 100);
  };

  // 处理离开（防止卡住）
  const handlePointerLeave = () => {
    if (isPressed) {
      setIsPressed(false);
      setTimeout(() => {
        setTouchPosition(null);
        setHighlightedArea(null);
      }, 100);
    }
  };

  // 计算按钮位置（基于角度和距离）
  const calculateButtonPosition = (angle: number, distance: number, screenWidth: number): { x: number; y: number } => {
    const centerX = screenWidth / 2;
    // 圆弧中心Y坐标：随圆心下移，从 containerHeight - arcRadius 下移70px
    const centerY = containerHeight - arcRadius + 70; // 从80px调整到150px
    // 按钮额外下移：让按钮更靠近底部，更容易触达
    const buttonAdditionalOffset = 60; // 按钮额外下移60px
    
    const angleRad = (angle * Math.PI) / 180;
    const x = centerX + distance * Math.sin(angleRad);
    // 按钮Y坐标：基于圆心计算后，再额外下移
    const y = centerY - distance * Math.cos(angleRad) + buttonAdditionalOffset;
    
    return { x, y };
  };

  const screenWidth = containerRef.current?.clientWidth || window.innerWidth;
  
  // 计算按钮位置
  const cancelButtonPos = calculateButtonPosition(-45, buttonDistance, screenWidth);
  const editButtonPos = calculateButtonPosition(45, buttonDistance, screenWidth);
  // 松开发送文字位置：在圆弧内部
  // 圆弧顶部：containerHeight - arcRadius + 70 = 280 - 200 + 70 = 150px
  // 圆弧中心（垂直方向）：containerHeight - arcRadius + 70 - arcRadius / 2 = 280 - 200 + 70 - 100 = 50px
  // 文字位置在圆弧内部，随圆心下移70px
  const sendButtonY = containerHeight - arcRadius + 70 + 50; // 在圆弧内部（150 + 50 = 200px）

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100vh',
        position: 'relative',
        backgroundColor: '#f9fafb',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none'
      }}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      onTouchCancel={handlePointerLeave}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerLeave}
    >
      {/* 大元素容器（按下后显示） */}
      {isPressed && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${containerHeight}px`,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: '20px',
            overflow: 'hidden'
          }}
        >
          {/* 圆弧装饰（创建1/6圆弧效果，45度） */}
          {/* 圆心下移：从 containerHeight - arcRadius (280-200=80px) 调整到下移后的位置 */}
          <div
            style={{
              position: 'absolute',
              top: `${containerHeight - arcRadius + 70}px`, // 下移70px，从80px调整到150px
              left: '50%',
              transform: 'translateX(-50%)',
              width: `${arcRadius * 2}px`,
              height: `${arcRadius}px`,
              // 使用border-radius创建上半圆
              borderRadius: `${arcRadius}px ${arcRadius}px 0 0`,
              backgroundColor: 'transparent',
              borderTop: '2px solid rgba(59, 130, 246, 0.3)',
              // 使用overflow和mask创建1/6圆弧效果
              overflow: 'hidden',
              pointerEvents: 'none'
            }}
          >
            {/* 使用伪元素创建圆弧遮罩 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: `${arcRadius * 2 * Math.sin(22.5 * Math.PI / 180)}px`,
                height: '100%',
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                clipPath: `polygon(
                  0% 0%,
                  50% ${arcRadius * (1 - Math.cos(22.5 * Math.PI / 180))}px,
                  100% 0%,
                  100% 100%,
                  0% 100%
                )`
              }}
            />
          </div>
          {/* 松开发送文字（圆弧内部，中央） */}
          <div
            style={{
              position: 'absolute',
              top: `${sendButtonY}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: highlightedArea === 'send' ? '20px' : '18px',
              fontWeight: highlightedArea === 'send' ? 'bold' : '600',
              color: highlightedArea === 'send' ? '#3b82f6' : '#2563eb',
              transition: 'all 0.2s ease',
              pointerEvents: 'none',
              zIndex: 1002,
              // 确保文字在圆弧内部可见
              textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
            }}
          >
            松开发送
          </div>

          {/* 取消按钮（左侧，-45°位置） */}
          <div
            style={{
              position: 'absolute',
              left: `${cancelButtonPos.x}px`,
              top: `${cancelButtonPos.y}px`,
              transform: 'translate(-50%, -50%)',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: highlightedArea === 'cancel' 
                ? 'rgba(239, 68, 68, 0.3)' 
                : 'rgba(239, 68, 68, 0.1)',
              border: `2px solid ${highlightedArea === 'cancel' ? '#ef4444' : 'rgba(239, 68, 68, 0.3)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              zIndex: 1001
            }}
          >
            <X 
              size={24} 
              color={highlightedArea === 'cancel' ? '#ef4444' : '#dc2626'} 
            />
            <span
              style={{
                fontSize: '12px',
                fontWeight: highlightedArea === 'cancel' ? 'bold' : 'normal',
                color: highlightedArea === 'cancel' ? '#ef4444' : '#dc2626',
                marginTop: '2px',
                transition: 'all 0.2s ease'
              }}
            >
              取消
            </span>
          </div>

          {/* 编辑按钮（右侧，+45°位置） */}
          <div
            style={{
              position: 'absolute',
              left: `${editButtonPos.x}px`,
              top: `${editButtonPos.y}px`,
              transform: 'translate(-50%, -50%)',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: highlightedArea === 'edit' 
                ? 'rgba(34, 197, 94, 0.3)' 
                : 'rgba(34, 197, 94, 0.1)',
              border: `2px solid ${highlightedArea === 'edit' ? '#22c55e' : 'rgba(34, 197, 94, 0.3)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              zIndex: 1001
            }}
          >
            <Edit2 
              size={24} 
              color={highlightedArea === 'edit' ? '#22c55e' : '#16a34a'} 
            />
            <span
              style={{
                fontSize: '12px',
                fontWeight: highlightedArea === 'edit' ? 'bold' : 'normal',
                color: highlightedArea === 'edit' ? '#22c55e' : '#16a34a',
                marginTop: '2px',
                transition: 'all 0.2s ease'
              }}
            >
              编辑
            </span>
          </div>
        </div>
      )}

      {/* 底部按钮（初始状态和松开后都显示） */}
      {!isPressed && (
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: '120px',
            height: '50px',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '25px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '0 20px',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            cursor: 'pointer',
            userSelect: 'none',
            zIndex: 100,
            transition: 'all 0.2s ease'
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePointerDown(e);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePointerDown(e);
          }}
        >
          <Mic size={20} />
          <span style={{ fontSize: '16px', fontWeight: '500' }}>点击说话</span>
        </div>
      )}

      {/* 调试信息 */}
      {isPressed && touchPosition && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            padding: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 1500,
            pointerEvents: 'none',
            maxWidth: '300px'
          }}
        >
          <div>触摸位置: ({Math.round(touchPosition.x)}, {Math.round(touchPosition.y)})</div>
          <div>高亮区域: {highlightedArea || '无'}</div>
          <div>屏幕宽度: {screenWidth}px</div>
        </div>
      )}

      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.9);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
          }
        `}
      </style>
    </div>
  );
};

export default ArcButtonLayoutTest;
