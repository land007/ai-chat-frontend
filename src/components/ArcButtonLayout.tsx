import React, { useState, useRef } from 'react';
import { Send } from 'lucide-react';
import { 
  ArcButtonLayoutProps, 
  Point, 
  ArcButtonArea,
  ArcButtonConfig,
  ArcCenterButtonConfig,
  ArcLayoutConfig,
  ArcStyleConfig
} from '@/types';

const ArcButtonLayout: React.FC<ArcButtonLayoutProps> = ({
  onCancel,
  onEdit,
  onSend,
  onInitialButtonPress,
  leftButton,
  rightButton,
  centerButton,
  initialButton,
  layoutConfig,
  styleConfig,
  debug = false,
  containerStyle,
  disabled = false,
  persistOnPress = false, // 默认不保持显示，手指离开后消失
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [touchPosition, setTouchPosition] = useState<Point | null>(null);
  const [highlightedArea, setHighlightedArea] = useState<ArcButtonArea>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // 默认布局配置（缩小尺寸）
  const defaultLayoutConfig: Required<ArcLayoutConfig> = {
    containerHeight: 160, // 从 220 减小到 160
    arcRadius: 140, // 从 200 减小到 140
    buttonDistance: 172, // arcRadius + 32，让按钮离圆圈 2px 距离（buttonInnerRadius = 172 - 30 = 142，arcRadius = 140，距离 = 2px）
    buttonWidth: 50, // 从 60 减小到 50，让按钮更薄
    arcCenterOffset: 50, // 从 70 减小到 50
    sendAreaWidth: 0.4, // 0.3 to 0.7
  };

  // 默认样式配置（统一样式）
  const defaultStyleConfig: Required<ArcStyleConfig> = {
    containerBackground: 'rgba(255, 255, 255, 0.95)', // 统一背景色，带透明度
    containerZIndex: 1000,
    arcColor: 'rgba(59, 130, 246, 0.3)',
    cornerRadius: 8,
  };

  // 默认左侧按钮（取消）
  const defaultLeftButton: ArcButtonConfig = {
    text: '取消',
    startAngle: -45,
    endAngle: -10,
    color: {
      normal: 'rgba(239, 68, 68, 0.08)',
      highlighted: 'rgba(239, 68, 68, 0.25)',
      border: 'rgba(239, 68, 68, 0.25)',
      borderHighlighted: '#ef4444',
    },
  };

  // 默认右侧按钮（编辑）
  const defaultRightButton: ArcButtonConfig = {
    text: '编辑',
    startAngle: 10,
    endAngle: 45,
    color: {
      normal: 'rgba(59, 130, 246, 0.08)',
      highlighted: 'rgba(59, 130, 246, 0.25)',
      border: 'rgba(59, 130, 246, 0.25)',
      borderHighlighted: '#3b82f6',
    },
  };

  // 默认中心按钮（使用绿色系，表示确认/成功操作）
  const defaultCenterButton: ArcCenterButtonConfig = {
    text: '松开发送',
    icon: <Send />,
    color: {
      normal: '#64748b', // 灰色，未高亮时保持中性
      highlighted: '#10b981', // 绿色，高亮时表示确认/成功操作
    },
  };

  // 合并配置
  const layout: Required<ArcLayoutConfig> = { ...defaultLayoutConfig, ...layoutConfig };
  const style: Required<ArcStyleConfig> = { ...defaultStyleConfig, ...styleConfig };
  const leftBtn: ArcButtonConfig = { ...defaultLeftButton, ...leftButton };
  const rightBtn: ArcButtonConfig = { ...defaultRightButton, ...rightButton };
  const centerBtn: ArcCenterButtonConfig = { ...defaultCenterButton, ...centerButton };

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
  const detectArea = (x: number, y: number, screenWidth: number): ArcButtonArea => {
    // 将触摸坐标从视口坐标转换为容器内坐标
    // 容器是 position: fixed, bottom: 0，高度为 containerHeight
    // 容器顶部在视口中的Y坐标 = window.innerHeight - containerHeight
    const containerTopInViewport = window.innerHeight - layout.containerHeight;
    const yInContainer = y - containerTopInViewport;
    
    // 容器有左右边距 16px，实际容器宽度需要考虑这个
    const containerPadding = 16;
    const containerWidth = screenWidth - containerPadding * 2;
    const centerX = containerPadding + containerWidth / 2; // 屏幕上的绝对坐标（用于触摸检测）
    // 圆弧是半圆，圆心在底部边缘
    const centerY = layout.containerHeight + layout.arcCenterOffset;
    
    const innerRadius = layout.buttonDistance - layout.buttonWidth / 2;
    const outerRadius = layout.buttonDistance + layout.buttonWidth / 2;
    
    // 检测是否在左侧按钮内（使用容器内坐标）
    if (isPointInSector(x, yInContainer, centerX, centerY, innerRadius, outerRadius, leftBtn.startAngle, leftBtn.endAngle)) {
      return 'cancel';
    }
    
    // 检测是否在右侧按钮内（使用容器内坐标）
    if (isPointInSector(x, yInContainer, centerX, centerY, innerRadius, outerRadius, rightBtn.startAngle, rightBtn.endAngle)) {
      return 'edit';
    }
    
    // 检测是否在发送区域（中央区域，不在按钮内）
    // 发送区域也需要使用容器内坐标进行检测
    const sendAreaStart = screenWidth * (0.5 - layout.sendAreaWidth / 2);
    const sendAreaEnd = screenWidth * (0.5 + layout.sendAreaWidth / 2);
    if (yInContainer >= 0 && yInContainer <= layout.containerHeight && x >= sendAreaStart && x <= sendAreaEnd) {
      return 'send';
    }
    
    return null;
  };

  // 处理按下
  const handlePointerDown = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    const point = getTouchPoint(e);
    
    // 如果当前未按下且按下了初始按钮区域，调用 onInitialButtonPress
    if (!isPressed && onInitialButtonPress) {
      onInitialButtonPress();
    }
    
    setIsPressed(true);
    setTouchPosition(point);
    setHighlightedArea(null);
  };

  // 处理移动
  const handlePointerMove = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (!isPressed || disabled) return;
    
    const point = getTouchPoint(e);
    setTouchPosition(point);
    
    // 检测触摸点所在区域
    const screenWidth = containerRef.current?.clientWidth || window.innerWidth;
    const area = detectArea(point.x, point.y, screenWidth);
    setHighlightedArea(area);
  };

  // 处理松开
  const handlePointerUp = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (!isPressed || disabled) return;
    
    const point = getTouchPoint(e);
    const screenWidth = containerRef.current?.clientWidth || window.innerWidth;
    const area = detectArea(point.x, point.y, screenWidth);
    
    // 调用相应的回调函数
    if (area === 'cancel' && onCancel) {
      onCancel();
    } else if (area === 'edit' && onEdit) {
      onEdit();
    } else if (area === 'send' && onSend) {
      onSend();
    }
    
    setIsPressed(false);
    setTouchPosition(null);
    setHighlightedArea(null);
  };

  // 处理离开（防止卡住）
  const handlePointerLeave = () => {
    if (isPressed && !disabled) {
      // 如果设置了 persistOnPress，不清除 isPressed，只清除高亮状态
      if (persistOnPress) {
        setTouchPosition(null);
        setHighlightedArea(null);
      } else {
        setIsPressed(false);
        setTimeout(() => {
          setTouchPosition(null);
          setHighlightedArea(null);
        }, 100);
      }
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
    const cornerRadius = style.cornerRadius;
    
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
    const dx1 = x1Outer - x1Inner;
    const dy1 = y1Outer - y1Inner;
    const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const unitX1 = dx1 / dist1;
    const unitY1 = dy1 / dist1;
    const corner1StartX = x1Inner + unitX1 * cornerRadius;
    const corner1StartY = y1Inner + unitY1 * cornerRadius;
    const corner1EndX = x1Outer - unitX1 * cornerRadius;
    const corner1EndY = y1Outer - unitY1 * cornerRadius;
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
    const innerCornerAngle = (cornerRadius / innerRadius) * (180 / Math.PI);
    const innerStartAdjust = startRad + (innerCornerAngle * Math.PI / 180);
    const innerEndAdjust = endRad - (innerCornerAngle * Math.PI / 180);
    const innerStartX = centerX + innerRadius * Math.sin(innerStartAdjust);
    const innerStartY = centerY - innerRadius * Math.cos(innerStartAdjust);
    const innerEndX = centerX + innerRadius * Math.sin(innerEndAdjust);
    const innerEndY = centerY - innerRadius * Math.cos(innerEndAdjust);
    
    const outerCornerAngle = (cornerRadius / outerRadius) * (180 / Math.PI);
    const outerStartAdjust = startRad + (outerCornerAngle * Math.PI / 180);
    const outerEndAdjust = endRad - (outerCornerAngle * Math.PI / 180);
    const outerStartX = centerX + outerRadius * Math.sin(outerStartAdjust);
    const outerStartY = centerY - outerRadius * Math.cos(outerStartAdjust);
    const outerEndX = centerX + outerRadius * Math.sin(outerEndAdjust);
    const outerEndY = centerY - outerRadius * Math.cos(outerEndAdjust);
    
    // 构建路径
    const path = `M ${innerStartX} ${innerStartY} L ${corner1StartX} ${corner1StartY} Q ${corner1ControlX} ${corner1ControlY} ${corner1EndX} ${corner1EndY} L ${outerStartX} ${outerStartY} A ${outerRadius} ${outerRadius} 0 0 1 ${outerEndX} ${outerEndY} L ${corner2StartX} ${corner2StartY} Q ${corner2ControlX} ${corner2ControlY} ${corner2EndX} ${corner2EndY} L ${innerEndX} ${innerEndY} A ${innerRadius} ${innerRadius} 0 0 0 ${innerStartX} ${innerStartY} Z`;
    return path;
  };

  // 计算按钮中心位置（用于放置图标和文字）
  const calculateButtonCenter = (
    startAngle: number, 
    endAngle: number, 
    distance: number, 
    containerCenterX: number // 使用容器中心X坐标
  ): { x: number; y: number } => {
    const centerY = layout.containerHeight + layout.arcCenterOffset;
    
    // 计算按钮中心角度
    const centerAngle = (startAngle + endAngle) / 2;
    const angleRad = (centerAngle * Math.PI) / 180;
    
    // 基于统一圆心计算按钮中心位置
    const x = containerCenterX + distance * Math.sin(angleRad);
    const y = centerY - distance * Math.cos(angleRad);
    
    return { x, y };
  };

  const screenWidth = containerRef.current?.clientWidth || window.innerWidth;
  
  // 容器有左右边距 16px，实际容器宽度需要考虑这个
  const containerPadding = 16; // 左右各 16px
  const containerWidth = screenWidth - containerPadding * 2;
  
  // 计算大圆圆心位置
  // 注意：按钮的 clip-path 和图标文字是相对于容器的，所以使用容器内的相对坐标
  const arcCenterXRelative = containerWidth / 2; // 容器内的相对坐标（相对于容器左边缘）
  const arcCenterXAbsolute = containerPadding + containerWidth / 2; // 屏幕上的绝对坐标（用于触摸检测）
  const arcCenterY = layout.containerHeight + layout.arcCenterOffset;
  
  // 计算按钮参数
  const buttonInnerRadius = layout.buttonDistance - layout.buttonWidth / 2;
  const buttonOuterRadius = layout.buttonDistance + layout.buttonWidth / 2;
  
  // 计算扇形状按钮的clip-path（使用容器内的相对坐标）
  const leftButtonClipPath = calculateSectorClipPath(
    arcCenterXRelative, // 使用容器内的相对坐标
    arcCenterY,
    buttonInnerRadius,
    buttonOuterRadius,
    leftBtn.startAngle,
    leftBtn.endAngle
  );
  
  const rightButtonClipPath = calculateSectorClipPath(
    arcCenterXRelative, // 使用容器内的相对坐标
    arcCenterY,
    buttonInnerRadius,
    buttonOuterRadius,
    rightBtn.startAngle,
    rightBtn.endAngle
  );
  
  // 计算按钮中心位置（用于放置图标和文字，使用容器内的相对坐标）
  const leftButtonCenter = calculateButtonCenter(
    leftBtn.startAngle, 
    leftBtn.endAngle, 
    layout.buttonDistance, 
    arcCenterXRelative // 使用容器内的相对坐标
  );
  const rightButtonCenter = calculateButtonCenter(
    rightBtn.startAngle, 
    rightBtn.endAngle, 
    layout.buttonDistance, 
    arcCenterXRelative // 使用容器内的相对坐标
  );
  
  // 中心按钮文字位置：在圆弧内部（向下移动）
  const centerButtonY = arcCenterY - (layout.arcRadius - 40); // 从 30 改为 40，向下移动约 10px

  // 从 rgba 颜色中提取对应的实色（用于图标和文字）
  const getSolidColor = (rgbaColor: string, isHighlighted: boolean): string => {
    // 提取 RGB 值
    const match = rgbaColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return rgbaColor;
    
    const [, r, g, b] = match;
    const rNum = parseInt(r, 10);
    const gNum = parseInt(g, 10);
    const bNum = parseInt(b, 10);
    
    // 根据颜色值判断是红色系还是蓝色系
    if (rNum > 200 && gNum < 100 && bNum < 100) {
      // 红色系（取消按钮）
      return isHighlighted ? '#dc2626' : '#991b1b';
    } else if (rNum < 100 && gNum > 100 && bNum > 200) {
      // 蓝色系（编辑按钮）
      return isHighlighted ? '#2563eb' : '#1e40af';
    }
    
    // 默认返回 rgb 格式
    return `rgb(${r}, ${g}, ${b})`;
  };

  // 渲染按钮内容（图标和文字）
  const renderButtonContent = (button: ArcButtonConfig, isHighlighted: boolean) => {
    const bgColor = isHighlighted 
      ? (button.color?.highlighted || 'rgba(59, 130, 246, 0.25)')
      : (button.color?.normal || 'rgba(59, 130, 246, 0.08)');
    
    const textColor = getSolidColor(bgColor, isHighlighted);
    
    // 判断是否是编辑按钮（蓝色系），编辑按钮的图标要小一点
    const isEditButton = button.text === '编辑' || 
      (button.color?.normal && button.color.normal.includes('59, 130, 246'));
    const iconSize = isEditButton ? 20 : 24; // 编辑按钮图标 20px，其他按钮 24px

    return (
      <>
        {button.icon && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {React.isValidElement(button.icon) 
              ? React.cloneElement(button.icon as React.ReactElement<any>, {
                  size: iconSize, // 编辑按钮图标更小
                  color: textColor,
                  strokeWidth: isHighlighted ? 2.5 : 2,
                })
              : button.icon
            }
          </div>
        )}
        <span
          style={{
            fontSize: '12px', // 保持字体大小不变，不高亮时放大
            fontWeight: isHighlighted ? '700' : '500',
            color: textColor,
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            letterSpacing: '0.2px',
            textShadow: isHighlighted 
              ? `0 1px 3px ${button.color?.highlighted?.replace('0.25', '0.3') || 'rgba(37, 99, 235, 0.3)'}` 
              : 'none',
            lineHeight: '1.2',
            whiteSpace: 'nowrap'
          }}
        >
          {button.text}
        </span>
      </>
    );
  };

  const isLeftHighlighted = highlightedArea === 'cancel';
  const isRightHighlighted = highlightedArea === 'edit';
  const isCenterHighlighted = highlightedArea === 'send';

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        touchAction: disabled ? 'auto' : 'none',
        userSelect: 'none',
        ...containerStyle,
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
      {/* 按下后显示的弧形按钮容器（整体设计的最底层，包含统一阴影） */}
      {/* 如果设置了 persistOnPress，则一直显示；否则只在 isPressed 时显示 */}
      {(isPressed || persistOnPress) && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: '16px',
            right: '16px',
            height: `${layout.containerHeight}px`,
            backgroundColor: style.containerBackground,
            backdropFilter: 'blur(10px)',
            borderRadius: '0 0 12px 12px', // 底部圆角，作为整体设计的底部
            // 统一的整体阴影，让三个组件看起来像一个整体
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
            zIndex: style.containerZIndex,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: '16px',
            overflow: 'hidden'
          }}
        >
          {/* 圆弧装饰 */}
          <div
            style={{
              position: 'absolute',
              top: `${layout.containerHeight - layout.arcRadius + layout.arcCenterOffset}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              width: `${layout.arcRadius * 2}px`,
              height: `${layout.arcRadius}px`,
              borderRadius: `${layout.arcRadius}px ${layout.arcRadius}px 0 0`,
              backgroundColor: 'transparent',
              borderTop: `2px solid ${style.arcColor}`,
              overflow: 'hidden',
              pointerEvents: 'none'
            }}
          >
            {/* 圆弧遮罩（发送区域背景） */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: `${layout.arcRadius * 2 * Math.sin(22.5 * Math.PI / 180)}px`,
                height: '100%',
                // 发送区域使用绿色背景（默认和高亮都是绿色，高亮时更明显）
                backgroundColor: isCenterHighlighted 
                  ? 'rgba(16, 185, 129, 0.08)' // 绿色背景，高亮时更明显
                  : 'rgba(16, 185, 129, 0.05)', // 绿色背景，默认状态（淡绿色）
                clipPath: `polygon(
                  0% 0%,
                  50% ${layout.arcRadius * (1 - Math.cos(22.5 * Math.PI / 180))}px,
                  100% 0%,
                  100% 100%,
                  0% 100%
                )`,
                transition: 'background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>

          {/* 中心按钮（文字和图标） */}
          <div
            style={{
              position: 'absolute',
              top: `${centerButtonY}px`,
              left: '50%',
              transform: 'translate(-50%, -50%)', // 移除 scale 效果，字体大小不变
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              pointerEvents: 'none',
              zIndex: style.containerZIndex + 2,
            }}
          >
            {/* 文字 */}
            <span
              style={{
                fontSize: '15px', // 保持字体大小不变，不高亮时放大
                fontWeight: isCenterHighlighted ? '700' : '500',
                color: isCenterHighlighted 
                  ? centerBtn.color?.highlighted 
                  : centerBtn.color?.normal,
                textShadow: isCenterHighlighted 
                  ? '0 2px 8px rgba(16, 185, 129, 0.3)' // 绿色阴影，与文字颜色匹配
                  : '0 1px 3px rgba(255, 255, 255, 0.9)',
                letterSpacing: '0.5px',
                lineHeight: '1.2',
                whiteSpace: 'nowrap'
              }}
            >
              {centerBtn.text}
            </span>
            {/* 图标 */}
            {centerBtn.icon && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {React.isValidElement(centerBtn.icon) 
                  ? React.cloneElement(centerBtn.icon as React.ReactElement<any>, {
                      size: 18, // 保持图标大小不变，不高亮时放大
                      color: isCenterHighlighted 
                        ? centerBtn.color?.highlighted 
                        : centerBtn.color?.normal,
                      strokeWidth: isCenterHighlighted ? 2.5 : 2,
                    })
                  : centerBtn.icon
                }
              </div>
            )}
          </div>

          {/* 左侧按钮（扇形） */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              clipPath: `path("${leftButtonClipPath}")`,
              backgroundColor: isLeftHighlighted 
                ? leftBtn.color?.highlighted 
                : leftBtn.color?.normal,
              border: `2px solid ${isLeftHighlighted 
                ? leftBtn.color?.borderHighlighted 
                : leftBtn.color?.border}`,
              boxShadow: isLeftHighlighted 
                ? `0 4px 12px ${leftBtn.color?.highlighted?.replace('0.25', '0.3')}` 
                : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              zIndex: style.containerZIndex + 1,
              pointerEvents: 'auto'
            }}
          />
          {/* 左侧按钮图标和文字 */}
          <div
            style={{
              position: 'absolute',
              left: `${leftButtonCenter.x}px`,
              top: `${leftButtonCenter.y}px`,
              transform: 'translate(-50%, -50%)', // 移除 scale 效果，字体大小不变
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              pointerEvents: 'none',
              zIndex: style.containerZIndex + 2,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              width: '60px',
              height: '60px',
              overflow: 'hidden'
            }}
          >
            {renderButtonContent(leftBtn, isLeftHighlighted)}
          </div>

          {/* 右侧按钮（扇形） */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              clipPath: `path("${rightButtonClipPath}")`,
              backgroundColor: isRightHighlighted 
                ? rightBtn.color?.highlighted 
                : rightBtn.color?.normal,
              border: `2px solid ${isRightHighlighted 
                ? rightBtn.color?.borderHighlighted 
                : rightBtn.color?.border}`,
              boxShadow: isRightHighlighted 
                ? `0 4px 12px ${rightBtn.color?.highlighted?.replace('0.25', '0.3')}` 
                : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              zIndex: style.containerZIndex + 1,
              pointerEvents: 'auto'
            }}
          />
          {/* 右侧按钮图标和文字 */}
          <div
            style={{
              position: 'absolute',
              left: `${rightButtonCenter.x}px`,
              top: `${rightButtonCenter.y}px`,
              transform: 'translate(-50%, -50%)', // 移除 scale 效果，字体大小不变
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              pointerEvents: 'none',
              zIndex: style.containerZIndex + 2,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              width: '60px',
              height: '60px',
              overflow: 'hidden'
            }}
          >
            {renderButtonContent(rightBtn, isRightHighlighted)}
          </div>
        </div>
      )}

      {/* 初始按钮（未按下时显示） */}
      {!isPressed && initialButton?.show !== false && (
        <div
          style={{
            position: 'fixed',
            bottom: `${initialButton?.position?.bottom ?? 20}px`, // 从 80 降低到 20，更靠近底部
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
            cursor: disabled ? 'not-allowed' : 'pointer',
            userSelect: 'none',
            zIndex: 1001,
            transition: 'all 0.2s ease',
            opacity: disabled ? 0.5 : 1,
            ...initialButton?.style,
          }}
          onMouseDown={(e) => {
            if (disabled) return;
            e.preventDefault();
            e.stopPropagation();
            handlePointerDown(e);
          }}
          onTouchStart={(e) => {
            if (disabled) return;
            e.preventDefault();
            e.stopPropagation();
            handlePointerDown(e);
          }}
        >
          {initialButton?.icon || null}
          <span style={{ fontSize: '15px', fontWeight: '500' }}>
            {initialButton?.text || '点击说话'}
          </span>
        </div>
      )}

      {/* 调试信息 */}
      {debug && isPressed && touchPosition && (
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
    </div>
  );
};

export default ArcButtonLayout;
