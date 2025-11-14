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
  // 计算合适的容器高度：按钮外半径265px，圆心在containerHeight+70，按钮最高点需要一些padding
  // 按钮最高点相对于容器顶部 = (containerHeight + 70) - 265 - (screenHeight - containerHeight)
  // 简化：按钮最高点需要约20-30px的padding，所以容器高度可以设置为约220px
  const containerHeight = 220; // 减少容器高度，减少上方空白空间（从280px减少到220px）
  const arcRadius = 200; // 圆弧半径（大圆的半径）
  // 按钮应该落在大圆外侧，所以按钮的内半径应该大于圆弧半径
  // 增加buttonDistance，确保按钮内半径大于圆弧半径，避免压在大圆边线上
  const buttonDistance = arcRadius + 40; // 按钮中心距离圆心的距离（240px，落在大圆外侧）
  const buttonWidth = 70; // 按钮宽度（内外半径差，增加到70px，提供更多空间给图标和文字）
  const buttonAngleRange = 50; // 按钮覆盖角度（从30度增加到50度，覆盖面积变大）
  
  // 按钮角度范围（向中间靠拢，减少中间空档）
  const cancelButtonStartAngle = -45; // 取消按钮起始角度（进一步向中间靠拢）
  const cancelButtonEndAngle = -10; // 取消按钮结束角度（进一步向中间靠拢）
  const editButtonStartAngle = 10; // 编辑按钮起始角度（进一步向中间靠拢）
  const editButtonEndAngle = 45; // 编辑按钮结束角度（进一步向中间靠拢）

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

  // 检测触摸点是否在扇形状按钮内（基于按钮实际形状）
  const isPointInSector = (
    pointX: number, 
    pointY: number, 
    centerX: number, 
    centerY: number, 
    innerRadius: number, 
    outerRadius: number, 
    startAngle: number, 
    endAngle: number
  ): boolean => {
    const dx = pointX - centerX;
    const dy = centerY - pointY; // 屏幕坐标系Y向下为正，向上需要减去
    
    // 计算距离
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 检查距离是否在内外半径之间
    if (distance < innerRadius || distance > outerRadius) {
      return false;
    }
    
    // 计算角度（向上为0°，左侧为负，右侧为正）
    const angle = Math.atan2(dx, dy) * 180 / Math.PI;
    
    // 检查角度是否在范围内
    if (startAngle < 0 && endAngle < 0) {
      // 负角度范围（取消按钮）
      return angle >= startAngle && angle <= endAngle;
    } else {
      // 正角度范围（编辑按钮）
      return angle >= startAngle && angle <= endAngle;
    }
  };

  // 检测触摸点所在区域（基于按钮实际形状）
  const detectArea = (x: number, y: number, screenWidth: number): 'cancel' | 'edit' | 'send' | null => {
    // 将触摸坐标从视口坐标转换为容器内坐标
    // 容器是 position: fixed, bottom: 0，高度为 containerHeight
    // 容器顶部在视口中的Y坐标 = window.innerHeight - containerHeight
    const containerTopInViewport = window.innerHeight - containerHeight;
    const yInContainer = y - containerTopInViewport;
    
    const centerX = screenWidth / 2;
    // 圆弧是半圆，圆心在底部边缘：top + height = containerHeight - arcRadius + 70 + arcRadius = containerHeight + 70
    const centerY = containerHeight + 70; // 大圆圆心Y坐标（圆弧底部边缘，相对于容器顶部）
    
    const innerRadius = buttonDistance - buttonWidth / 2;
    const outerRadius = buttonDistance + buttonWidth / 2;
    
    // 检测是否在取消按钮内（使用容器内坐标）
    if (isPointInSector(x, yInContainer, centerX, centerY, innerRadius, outerRadius, cancelButtonStartAngle, cancelButtonEndAngle)) {
      return 'cancel';
    }
    
    // 检测是否在编辑按钮内（使用容器内坐标）
    if (isPointInSector(x, yInContainer, centerX, centerY, innerRadius, outerRadius, editButtonStartAngle, editButtonEndAngle)) {
      return 'edit';
    }
    
    // 检测是否在发送区域（中央区域，不在按钮内）
    // 发送区域也需要使用容器内坐标进行检测
    if (yInContainer >= 0 && yInContainer <= containerHeight && x >= screenWidth * 0.3 && x <= screenWidth * 0.7) {
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

  // 计算扇形状按钮的clip-path路径（带圆角）
  const calculateSectorClipPath = (
    centerX: number,
    centerY: number,
    innerRadius: number,
    outerRadius: number,
    startAngle: number,
    endAngle: number
  ): string => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const cornerRadius = 8; // 圆角半径（轻微圆角）
    
    // 计算内外圆弧的四个点
    const x1Inner = centerX + innerRadius * Math.sin(startRad);
    const y1Inner = centerY - innerRadius * Math.cos(startRad);
    const x2Inner = centerX + innerRadius * Math.sin(endRad);
    const y2Inner = centerY - innerRadius * Math.cos(endRad);
    const x1Outer = centerX + outerRadius * Math.sin(startRad);
    const y1Outer = centerY - outerRadius * Math.cos(startRad);
    const x2Outer = centerX + outerRadius * Math.sin(endRad);
    const y2Outer = centerY - outerRadius * Math.cos(endRad);
    
    // 计算圆角：在四个连接点处添加圆角过渡
    // 1. 左侧连接（内弧起点 → 外弧起点）
    // 计算从内弧起点到外弧起点的方向向量
    const dx1 = x1Outer - x1Inner;
    const dy1 = y1Outer - y1Inner;
    const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const unitX1 = dx1 / dist1;
    const unitY1 = dy1 / dist1;
    // 圆角起点和终点（在直线上，距离连接点cornerRadius）
    const corner1StartX = x1Inner + unitX1 * cornerRadius;
    const corner1StartY = y1Inner + unitY1 * cornerRadius;
    const corner1EndX = x1Outer - unitX1 * cornerRadius;
    const corner1EndY = y1Outer - unitY1 * cornerRadius;
    // 圆角控制点（在连接点处）
    const corner1ControlX = x1Inner;
    const corner1ControlY = y1Inner;
    
    // 2. 右侧连接（外弧终点 → 内弧终点）
    const dx2 = x2Inner - x2Outer;
    const dy2 = y2Inner - y2Outer;
    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    const unitX2 = dx2 / dist2;
    const unitY2 = dy2 / dist2;
    const corner2StartX = x2Outer + unitX2 * cornerRadius;
    const corner2StartY = y2Outer + unitY2 * cornerRadius;
    const corner2EndX = x2Inner - unitX2 * cornerRadius;
    const corner2EndY = y2Inner - unitY2 * cornerRadius;
    const corner2ControlX = x2Outer;
    const corner2ControlY = y2Outer;
    
    // 3. 调整圆弧起点和终点，为圆角留出空间
    // 内弧：稍微调整起点和终点角度
    const innerCornerAngle = (cornerRadius / innerRadius) * (180 / Math.PI); // 转换为角度
    const innerStartAdjust = startRad + (innerCornerAngle * Math.PI / 180);
    const innerEndAdjust = endRad - (innerCornerAngle * Math.PI / 180);
    const innerStartX = centerX + innerRadius * Math.sin(innerStartAdjust);
    const innerStartY = centerY - innerRadius * Math.cos(innerStartAdjust);
    const innerEndX = centerX + innerRadius * Math.sin(innerEndAdjust);
    const innerEndY = centerY - innerRadius * Math.cos(innerEndAdjust);
    
    // 外弧：稍微调整起点和终点角度
    const outerCornerAngle = (cornerRadius / outerRadius) * (180 / Math.PI);
    const outerStartAdjust = startRad + (outerCornerAngle * Math.PI / 180);
    const outerEndAdjust = endRad - (outerCornerAngle * Math.PI / 180);
    const outerStartX = centerX + outerRadius * Math.sin(outerStartAdjust);
    const outerStartY = centerY - outerRadius * Math.cos(outerStartAdjust);
    const outerEndX = centerX + outerRadius * Math.sin(outerEndAdjust);
    const outerEndY = centerY - outerRadius * Math.cos(outerEndAdjust);
    
    // 构建路径：从内弧起点（调整后） -> 左侧圆角 -> 外弧起点（调整后） -> 外弧 -> 右侧圆角 -> 内弧终点（调整后） -> 内弧 -> 闭合
    // 使用二次贝塞尔曲线（Q命令）创建圆角
    const path = `M ${innerStartX} ${innerStartY} L ${corner1StartX} ${corner1StartY} Q ${corner1ControlX} ${corner1ControlY} ${corner1EndX} ${corner1EndY} L ${outerStartX} ${outerStartY} A ${outerRadius} ${outerRadius} 0 0 1 ${outerEndX} ${outerEndY} L ${corner2StartX} ${corner2StartY} Q ${corner2ControlX} ${corner2ControlY} ${corner2EndX} ${corner2EndY} L ${innerEndX} ${innerEndY} A ${innerRadius} ${innerRadius} 0 0 0 ${innerStartX} ${innerStartY} Z`;
    return path;
  };

  // 计算按钮中心位置（用于放置图标和文字）
  // 使用统一的圆心，按钮文字应该在按钮内部
  const calculateButtonCenter = (startAngle: number, endAngle: number, distance: number, screenWidth: number): { x: number; y: number } => {
    const centerX = screenWidth / 2;
    // 圆弧是半圆，圆心在底部边缘：top + height = containerHeight - arcRadius + 70 + arcRadius = containerHeight + 70
    const centerY = containerHeight + 70; // 大圆圆心Y坐标（圆弧底部边缘）
    
    // 计算按钮中心角度
    const centerAngle = (startAngle + endAngle) / 2;
    const angleRad = (centerAngle * Math.PI) / 180;
    
    // 基于统一圆心计算按钮中心位置（不使用额外偏移）
    const x = centerX + distance * Math.sin(angleRad);
    const y = centerY - distance * Math.cos(angleRad);
    
    return { x, y };
  };

  const screenWidth = containerRef.current?.clientWidth || window.innerWidth;
  
  // 计算大圆圆心位置（统一的圆心）
  // 圆弧是半圆，圆心在底部边缘：top + height = containerHeight - arcRadius + 70 + arcRadius = containerHeight + 70
  const arcCenterX = screenWidth / 2;
  const arcCenterY = containerHeight + 70; // 大圆圆心Y坐标（圆弧底部边缘）
  
  // 计算按钮参数
  const buttonInnerRadius = buttonDistance - buttonWidth / 2;
  const buttonOuterRadius = buttonDistance + buttonWidth / 2;
  
  // 计算扇形状按钮的clip-path
  const cancelButtonClipPath = calculateSectorClipPath(
    arcCenterX,
    arcCenterY,
    buttonInnerRadius,
    buttonOuterRadius,
    cancelButtonStartAngle,
    cancelButtonEndAngle
  );
  
  const editButtonClipPath = calculateSectorClipPath(
    arcCenterX,
    arcCenterY,
    buttonInnerRadius,
    buttonOuterRadius,
    editButtonStartAngle,
    editButtonEndAngle
  );
  
  // 计算按钮中心位置（用于放置图标和文字）
  const cancelButtonCenter = calculateButtonCenter(cancelButtonStartAngle, cancelButtonEndAngle, buttonDistance, screenWidth);
  const editButtonCenter = calculateButtonCenter(editButtonStartAngle, editButtonEndAngle, buttonDistance, screenWidth);
  
  // 松开发送文字位置：在圆弧内部
  // 圆心Y坐标是 containerHeight + 70，文字应该在圆心上方，距离圆心约 arcRadius - 50 的位置
  const sendButtonY = (containerHeight + 70) - (arcRadius - 50); // 在圆弧内部

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
              transform: highlightedArea === 'send' ? 'translateX(-50%) scale(1.1)' : 'translateX(-50%) scale(1)',
              fontSize: highlightedArea === 'send' ? '20px' : '17px',
              fontWeight: highlightedArea === 'send' ? '700' : '500',
              color: highlightedArea === 'send' ? '#2563eb' : '#64748b',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              pointerEvents: 'none',
              zIndex: 1002,
              textShadow: highlightedArea === 'send' 
                ? '0 2px 8px rgba(37, 99, 235, 0.3)' 
                : '0 1px 3px rgba(255, 255, 255, 0.9)',
              letterSpacing: '0.5px'
            }}
          >
            松开发送
          </div>

          {/* 取消按钮（扇形状，-60°到-30°） */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              clipPath: `path("${cancelButtonClipPath}")`,
              backgroundColor: highlightedArea === 'cancel' 
                ? 'rgba(239, 68, 68, 0.25)' 
                : 'rgba(239, 68, 68, 0.08)',
              border: `2px solid ${highlightedArea === 'cancel' ? '#ef4444' : 'rgba(239, 68, 68, 0.25)'}`,
              boxShadow: highlightedArea === 'cancel' 
                ? '0 4px 12px rgba(239, 68, 68, 0.3)' 
                : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              zIndex: 1001,
              pointerEvents: 'auto'
            }}
          />
          {/* 取消按钮图标和文字（位于按钮中心） */}
          <div
            style={{
              position: 'absolute',
              left: `${cancelButtonCenter.x}px`,
              top: `${cancelButtonCenter.y}px`,
              transform: highlightedArea === 'cancel' 
                ? 'translate(-50%, -50%) scale(1.1)' 
                : 'translate(-50%, -50%) scale(1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              pointerEvents: 'none',
              zIndex: 1002,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              // 确保内容不超出按钮边界
              width: '60px',
              height: '60px',
              overflow: 'hidden'
            }}
          >
            <X 
              size={highlightedArea === 'cancel' ? 26 : 24} 
              color={highlightedArea === 'cancel' ? '#dc2626' : '#991b1b'} 
              strokeWidth={highlightedArea === 'cancel' ? 2.5 : 2}
            />
            <span
              style={{
                fontSize: highlightedArea === 'cancel' ? '14px' : '13px',
                fontWeight: highlightedArea === 'cancel' ? '700' : '500',
                color: highlightedArea === 'cancel' ? '#dc2626' : '#991b1b',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                letterSpacing: '0.2px',
                textShadow: highlightedArea === 'cancel' 
                  ? '0 1px 3px rgba(220, 38, 38, 0.3)' 
                  : 'none',
                lineHeight: '1.2',
                whiteSpace: 'nowrap'
              }}
            >
              取消
            </span>
          </div>

          {/* 编辑按钮（扇形状，+30°到+60°） */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              clipPath: `path("${editButtonClipPath}")`,
              backgroundColor: highlightedArea === 'edit' 
                ? 'rgba(59, 130, 246, 0.25)' 
                : 'rgba(59, 130, 246, 0.08)',
              border: `2px solid ${highlightedArea === 'edit' ? '#3b82f6' : 'rgba(59, 130, 246, 0.25)'}`,
              boxShadow: highlightedArea === 'edit' 
                ? '0 4px 12px rgba(59, 130, 246, 0.3)' 
                : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              zIndex: 1001,
              pointerEvents: 'auto'
            }}
          />
          {/* 编辑按钮图标和文字（位于按钮中心） */}
          <div
            style={{
              position: 'absolute',
              left: `${editButtonCenter.x}px`,
              top: `${editButtonCenter.y}px`,
              transform: highlightedArea === 'edit' 
                ? 'translate(-50%, -50%) scale(1.1)' 
                : 'translate(-50%, -50%) scale(1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              pointerEvents: 'none',
              zIndex: 1002,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              // 确保内容不超出按钮边界
              width: '60px',
              height: '60px',
              overflow: 'hidden'
            }}
          >
            <Edit2 
              size={highlightedArea === 'edit' ? 26 : 24} 
              color={highlightedArea === 'edit' ? '#2563eb' : '#1e40af'} 
              strokeWidth={highlightedArea === 'edit' ? 2.5 : 2}
            />
            <span
              style={{
                fontSize: highlightedArea === 'edit' ? '14px' : '13px',
                fontWeight: highlightedArea === 'edit' ? '700' : '500',
                color: highlightedArea === 'edit' ? '#2563eb' : '#1e40af',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                letterSpacing: '0.2px',
                textShadow: highlightedArea === 'edit' 
                  ? '0 1px 3px rgba(37, 99, 235, 0.3)' 
                  : 'none',
                lineHeight: '1.2',
                whiteSpace: 'nowrap'
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
