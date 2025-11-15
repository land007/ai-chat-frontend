import React from 'react';
import FourDotWaveform from './FourDotWaveform';
import ArcButtonLayout from './ArcButtonLayout';
import {
  ArcButtonLayoutProps,
  ArcButtonConfig,
  ArcCenterButtonConfig,
  ArcInitialButtonConfig,
  ArcLayoutConfig,
  ArcStyleConfig,
} from '@/types';

export interface VoiceRecognitionArcLayoutProps {
  // 识别结果
  finalText?: string;           // 已确定的文本
  currentSegment?: string;      // 正在识别的段落
  // 波形相关
  analyserNode?: AnalyserNode | null;
  isRecording?: boolean;
  sampleRate?: number;
  recordingDuration?: number;   // 录音时长（秒）
  // 回调函数
  onCancel?: () => void;
  onEdit?: () => void;
  onSend?: () => void;
  onInitialButtonPress?: () => void; // 初始按钮按下时的回调
  // 样式配置
  isDarkMode?: boolean;
  layoutConfig?: ArcLayoutConfig;
  styleConfig?: ArcStyleConfig;
  // 按钮配置
  leftButton?: ArcButtonConfig;
  rightButton?: ArcButtonConfig;
  centerButton?: ArcCenterButtonConfig;
  initialButton?: ArcInitialButtonConfig;
  // 其他
  debug?: boolean;
  disabled?: boolean;
}

const VoiceRecognitionArcLayout: React.FC<VoiceRecognitionArcLayoutProps> = ({
  finalText = '',
  currentSegment = '',
  analyserNode = null,
  isRecording = false,
  sampleRate = 16000,
  recordingDuration = 0,
  onCancel,
  onEdit,
  onSend,
  onInitialButtonPress,
  isDarkMode = false,
  layoutConfig,
  styleConfig,
  leftButton,
  rightButton,
  centerButton,
  initialButton,
  debug = false,
  disabled = false,
}) => {
  // 样式定义
  const surfaceColor = isDarkMode ? '#1f2937' : '#ffffff';
  const textColor = isDarkMode ? '#f9fafb' : '#111827';
  const mutedColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const borderColor = isDarkMode ? '#4b5563' : '#e5e7eb';

  // 获取圆弧按钮容器高度（默认160px，已缩小）
  const arcContainerHeight = layoutConfig?.containerHeight || 160;
  
  // 统一的样式变量（整体设计）
  const commonBackground = isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)'; // 统一背景色，带透明度
  const commonBorderRadius = '12px'; // 统一圆角
  // 只在最外层（圆弧按钮容器）添加阴影，内部组件不添加阴影
  const commonBorder = `1px solid ${borderColor}`;
  const commonPadding = '12px 16px'; // 统一内边距
  
  const styles = {
    container: {
      width: '100%',
      height: '100%',
      position: 'relative' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
    },
    // 识别结果显示区域 - 固定在圆弧按钮上方（整体设计的一部分）
    transcriptArea: {
      position: 'fixed' as const,
      bottom: `${arcContainerHeight + (isRecording ? 80 : 0)}px`, // 圆弧按钮高度 + 波形区域高度（如果显示）
      left: '16px',
      right: '16px',
      minHeight: '40px',
      maxHeight: '80px',
      padding: commonPadding,
      backgroundColor: commonBackground,
      borderRadius: `${commonBorderRadius} ${commonBorderRadius} 0 0`, // 只在顶部有圆角
      border: commonBorder,
      borderBottom: 'none', // 底部无边框，与波形区域无缝连接
      overflow: 'hidden' as const,
      display: 'flex',
      alignItems: 'flex-start' as const,
      justifyContent: 'flex-start' as const,
      zIndex: 1001, // 在圆弧按钮之上
      // 移除独立阴影，使用整体阴影
      backdropFilter: 'blur(10px)',
      transition: 'bottom 0.3s ease',
    },
    transcriptText: {
      fontSize: '14px',
      lineHeight: '1.5',
      color: textColor,
      wordBreak: 'break-word' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
      display: '-webkit-box' as const,
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical' as const,
    },
    // 波形区域 - 固定在圆弧按钮上方（整体设计的一部分）
    waveformArea: {
      position: 'fixed' as const,
      bottom: `${arcContainerHeight}px`, // 圆弧按钮高度
      left: '16px',
      right: '16px',
      backgroundColor: commonBackground,
      padding: commonPadding,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '12px',
      zIndex: 1001, // 在圆弧按钮之上
      borderRadius: 0, // 无圆角，作为中间连接部分
      border: commonBorder,
      borderTop: 'none', // 顶部无边框，与识别结果区域无缝连接
      borderBottom: 'none', // 底部无边框，与圆弧按钮连接
      // 移除独立阴影，使用整体阴影
      backdropFilter: 'blur(10px)',
      transition: 'bottom 0.3s ease',
    },
    waveformContainer: {
      // 波形和时间显示容器（使用相对定位，让子元素绝对定位）
      position: 'relative' as const,
      height: '56px',
      width: '100%',
    },
    waveformWrapper: {
      // 波形区域：绝对定位居中，不受右侧时间影响
      position: 'absolute' as const,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: '100%',
      maxWidth: 'calc(100% - 80px)', // 为右侧时间留出空间
    },
    recordingDuration: {
      // 时间显示：绝对定位在右侧，不影响波形居中
      position: 'absolute' as const,
      right: '16px',
      top: '50%',
      transform: 'translateY(-50%)',
      fontSize: '14px',
      color: mutedColor,
      whiteSpace: 'nowrap' as const,
    },
    // 圆弧按钮容器 - 固定在底部
    arcButtonContainer: {
      position: 'fixed' as const,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
    },
  };

  // 格式化录音时长
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 判断是否有识别内容需要显示
  const hasTranscript = finalText || currentSegment;

  return (
    <div style={styles.container}>
      {/* 识别结果显示区域 - 固定在圆弧按钮上方 */}
      {hasTranscript && (
        <div style={styles.transcriptArea}>
          <div style={styles.transcriptText}>
            {/* 已确定文本：正常显示 */}
            {finalText && <span>{finalText}</span>}
            {/* 正在识别的文本：淡色显示 */}
            {currentSegment && (
              <span style={{ 
                opacity: 0.7, 
                color: isDarkMode ? '#9ca3af' : '#6b7280' 
              }}>
                {currentSegment}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 波形和时间显示容器 - 固定在圆弧按钮上方（仅在录音时显示） */}
      {isRecording && (
        <div style={styles.waveformArea}>
          <div style={styles.waveformContainer}>
            <div style={styles.waveformWrapper}>
              <FourDotWaveform
                analyserNode={analyserNode}
                isRecording={isRecording}
                isDarkMode={isDarkMode}
                minRadius={8}
                maxRadius={24}
                spacing={24}
                sampleRate={sampleRate}
              />
            </div>
            <div style={styles.recordingDuration}>
              {formatDuration(recordingDuration)}
            </div>
          </div>
        </div>
      )}

      {/* 圆弧按钮布局区域 - 固定在底部 */}
      <div style={styles.arcButtonContainer}>
        <ArcButtonLayout
          onCancel={onCancel}
          onEdit={onEdit}
          onSend={onSend}
          onInitialButtonPress={onInitialButtonPress}
          leftButton={leftButton}
          rightButton={rightButton}
          centerButton={centerButton}
          initialButton={initialButton}
          layoutConfig={layoutConfig}
          styleConfig={styleConfig}
          debug={debug}
          disabled={disabled}
          persistOnPress={isRecording} // 录音时保持显示，手指离开也不消失
          containerStyle={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    </div>
  );
};

export default VoiceRecognitionArcLayout;

