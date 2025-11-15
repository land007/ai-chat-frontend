import React, { useState, useRef, useEffect } from 'react';
import { Send, Keyboard, Mic } from 'lucide-react';
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
  // 输入模式相关（新增）
  inputMode?: 'voice' | 'keyboard'; // 输入模式（可选，用于从外部控制）
  onInputModeChange?: (mode: 'voice' | 'keyboard') => void; // 输入模式变化回调
  onTextChange?: (text: string) => void; // 编辑模式下文本变化回调
  onSendText?: (text: string) => void; // 发送文本回调
  enableKeyboardInput?: boolean; // 是否启用键盘输入
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
  inputMode: externalInputMode,
  onInputModeChange,
  onTextChange,
  onSendText,
  enableKeyboardInput = true,
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
  // 内部状态管理
  const [internalInputMode, setInternalInputMode] = useState<'voice' | 'keyboard'>('voice');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 输入模式：优先使用外部传入的，否则使用内部状态
  const inputMode = externalInputMode !== undefined ? externalInputMode : internalInputMode;
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

  // 处理输入模式切换
  const handleInputModeChange = (mode: 'voice' | 'keyboard') => {
    if (externalInputMode === undefined) {
      setInternalInputMode(mode);
    }
    onInputModeChange?.(mode);
  };

  // 处理编辑模式进入
  const handleEnterEditMode = () => {
    const fullText = finalText + currentSegment;
    setEditText(fullText);
    setIsEditMode(true);
    // 调用外部 onEdit 回调（用于兼容）
    onEdit?.();
  };

  // 处理编辑模式退出（发送）
  const handleSendEditText = () => {
    if (editText.trim() && onSendText) {
      onSendText(editText);
      // 发送后回到语音模式初始状态
      setIsEditMode(false);
      setEditText('');
      handleInputModeChange('voice');
    }
  };

  // 处理编辑模式退出（取消）
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditText('');
    // 保持在语音模式
    handleInputModeChange('voice');
  };

  // 处理取消操作（根据当前状态）
  const handleCancel = () => {
    if (isEditMode) {
      // 编辑模式：取消编辑，恢复识别结果，退出编辑模式
      handleCancelEdit();
    } else if (isRecording) {
      // 录音中：停止录音并丢弃，清空文本，回到初始状态
      onCancel?.();
    } else {
      // 识别结果展示：清空识别结果，回到初始状态
      onCancel?.();
    }
  };

  // 处理发送（非编辑模式）
  const handleSend = () => {
    if (onSend) {
      onSend();
    }
  };

  // 处理键盘输入模式发送
  const handleKeyboardSend = () => {
    if (editText.trim() && onSendText) {
      onSendText(editText);
      // 文字模式：清空输入框，保持在文字模式
      setEditText('');
    }
  };

  // 自动聚焦输入框
  useEffect(() => {
    if ((isEditMode || inputMode === 'keyboard') && inputTextareaRef.current) {
      // 延迟聚焦，确保 DOM 更新完成
      setTimeout(() => {
        inputTextareaRef.current?.focus();
      }, 100);
    }
  }, [isEditMode, inputMode]);

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isEditMode) {
        handleSendEditText();
      } else if (inputMode === 'keyboard') {
        handleKeyboardSend();
      }
    } else if (e.key === 'Escape' && isEditMode) {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // 判断是否显示输入框面板
  const shouldShowInputPanel = isEditMode || inputMode === 'keyboard';
  
  // 判断是否显示发送按钮
  // 编辑模式：有文本内容时显示
  // 文字输入模式：有文本内容时显示
  const shouldShowSendButton = (isEditMode && editText.trim()) || 
                                (inputMode === 'keyboard' && editText.trim());
  
  // 判断是否显示输入框面板中的切换按钮（切换到语音输入）
  // 文字输入模式且没有内容时：显示切换按钮（与发送按钮互斥）
  // 编辑模式：不显示
  const shouldShowToggleInInputPanel = inputMode === 'keyboard' && !isEditMode && !editText.trim();

  // 判断是否显示识别结果区域（不显示输入框面板时才显示）
  const shouldShowTranscript = !shouldShowInputPanel && (finalText || currentSegment);
  
  // 判断是否显示初始按钮（按住说话按钮 + 键盘切换按钮）
  // 语音模式且不在编辑模式且不在录音时显示
  // 注意：编辑模式下，如果输入框没有内容，也应该显示初始按钮（语音模式）
  const shouldShowInitialButton = inputMode === 'voice' && !isRecording && 
                                   (initialButton?.show !== false) &&
                                   (!isEditMode || !editText.trim());
  
  // 计算输入框面板的底部位置
  // 编辑模式或文字模式：输入框面板应该直接贴住屏幕底部（bottom: 0）
  // 语音模式且有识别结果：显示在圆弧按钮容器上方
  // 这里简化：输入框面板在编辑模式/文字模式时直接贴底
  const inputPanelBottom = shouldShowInputPanel ? 0 : arcContainerHeight;
  
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
    // 输入框面板 - 替换识别结果区域
    // 注意：borderRadius 和 borderBottom 在渲染时动态设置
    inputPanelBase: {
      position: 'fixed' as const,
      left: '16px',
      right: '16px',
      minHeight: '56px',
      padding: commonPadding,
      backgroundColor: commonBackground,
      border: commonBorder,
      zIndex: 1002, // 在识别结果区域之上
      backdropFilter: 'blur(10px)',
      transition: 'bottom 0.3s ease',
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)', // 添加阴影，使其看起来浮在内容之上
    },
    inputContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    inputTextarea: {
      flex: 1,
      padding: '12px 16px',
      border: `1px solid ${borderColor}`,
      borderRadius: '16px',
      resize: 'none' as const,
      outline: 'none',
      fontSize: '16px',
      lineHeight: '1.5',
      fontFamily: 'inherit',
      backgroundColor: surfaceColor,
      color: textColor,
      boxSizing: 'border-box' as const,
      maxHeight: '120px', // 约 3-4 行
      overflowY: 'auto' as const,
    },
    sendButton: {
      width: '48px',
      height: '48px',
      backgroundColor: '#3b82f6',
      color: 'white',
      borderRadius: '16px',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      flexShrink: 0,
    },
    sendButtonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    toggleButton: {
      width: '48px',
      height: '48px',
      backgroundColor: '#3b82f6',
      color: 'white',
      borderRadius: '16px',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      opacity: 0.7,
      outline: 'none',
      WebkitTapHighlightColor: 'transparent',
      flexShrink: 0,
    },
    toggleButtonHover: {
      opacity: 1,
      backgroundColor: '#2563eb',
    },
    // 初始按钮容器（包含"按住说话"按钮和键盘切换按钮）
    initialButtonContainer: {
      position: 'fixed' as const,
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 1001,
    },
    // 按住说话按钮
    holdToSpeakButton: {
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
      userSelect: 'none' as const,
      transition: 'all 0.2s ease',
      opacity: disabled ? 0.5 : 1,
      border: 'none',
      fontSize: '15px',
      fontWeight: '500',
      touchAction: 'none' as const,
      WebkitTapHighlightColor: 'transparent',
    },
    // 键盘切换按钮（在初始按钮右侧）
    initialToggleButton: {
      width: '48px',
      height: '48px',
      backgroundColor: '#3b82f6',
      color: 'white',
      borderRadius: '16px',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      opacity: 0.7,
      outline: 'none',
      WebkitTapHighlightColor: 'transparent',
      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
      flexShrink: 0,
    },
  };

  // 格式化录音时长
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      {/* 输入框面板 - 编辑模式或文字输入模式时显示 */}
      {/* 文字输入模式：始终显示（即使没有内容，也需要显示输入框和切换按钮） */}
      {/* 编辑模式：只有有内容时才显示（没有内容时显示初始按钮） */}
      {shouldShowInputPanel && (inputMode === 'keyboard' || (isEditMode && editText.trim())) && (
        <div style={{
          ...styles.inputPanelBase,
          bottom: `${inputPanelBottom}px`,
          borderRadius: inputPanelBottom === 0 ? `${commonBorderRadius}` : `${commonBorderRadius} ${commonBorderRadius} 0 0`,
          borderBottom: inputPanelBottom === 0 ? commonBorder : 'none',
        }}>
          <div style={styles.inputContainer}>
            <textarea
              ref={inputTextareaRef}
              value={editText}
              onChange={(e) => {
                const newText = e.target.value;
                setEditText(newText);
                onTextChange?.(newText);
              }}
              onKeyDown={handleKeyDown}
              placeholder={isEditMode ? '编辑识别结果...' : '输入您的问题...'}
              style={styles.inputTextarea}
              rows={1}
              disabled={disabled}
            />
            {shouldShowSendButton && (
              <button
                onClick={isEditMode ? handleSendEditText : handleKeyboardSend}
                disabled={disabled || !editText.trim()}
                style={{
                  ...styles.sendButton,
                  ...(disabled || !editText.trim() ? styles.sendButtonDisabled : {}),
                }}
                onMouseEnter={(e) => {
                  if (!disabled && editText.trim()) {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!disabled && editText.trim()) {
                    e.currentTarget.style.backgroundColor = '#3b82f6';
                  }
                }}
                title="发送"
              >
                <Send size={20} />
              </button>
            )}
            {/* 切换到语音输入按钮：只在文字输入模式显示（即使没有内容也可以切换） */}
            {enableKeyboardInput && shouldShowToggleInInputPanel && (
              <button
                onClick={() => {
                  // 从文字模式切换回语音模式
                  setEditText('');
                  handleInputModeChange('voice');
                }}
                disabled={disabled}
                style={styles.toggleButton}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!disabled) {
                    e.currentTarget.style.opacity = '0.7';
                    e.currentTarget.style.backgroundColor = '#3b82f6';
                  }
                }}
                title="切换到语音输入"
              >
                <Mic size={20} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 识别结果显示区域 - 固定在圆弧按钮上方（不在编辑模式和文字模式时显示） */}
      {shouldShowTranscript && (
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

      {/* 初始按钮区域（按住说话按钮 + 键盘切换按钮） */}
      {shouldShowInitialButton && (
        <div style={styles.initialButtonContainer}>
          <button
            type="button"
            onMouseDown={(e) => {
              if (disabled) return;
              e.preventDefault();
              e.stopPropagation();
              onInitialButtonPress?.();
            }}
            onTouchStart={(e) => {
              if (disabled) return;
              e.preventDefault();
              e.stopPropagation();
              onInitialButtonPress?.();
            }}
            disabled={disabled}
            style={{
              ...styles.holdToSpeakButton,
              ...(initialButton?.style || {}),
            }}
          >
            {initialButton?.icon || <Mic size={20} />}
            <span>{initialButton?.text || '按住说话'}</span>
          </button>
          {enableKeyboardInput && (
            <button
              type="button"
              onClick={() => {
                // 切换到键盘输入模式时，退出编辑模式
                setIsEditMode(false);
                setEditText('');
                handleInputModeChange('keyboard');
              }}
              disabled={disabled}
              style={styles.initialToggleButton}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled) {
                  e.currentTarget.style.opacity = '0.7';
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                }
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = '';
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = '';
              }}
              title="切换到键盘输入"
            >
              <Keyboard size={20} />
            </button>
          )}
        </div>
      )}

      {/* 圆弧按钮布局区域 - 固定在底部（不在文字输入模式时显示） */}
      {inputMode !== 'keyboard' && (
        <div style={styles.arcButtonContainer}>
          <ArcButtonLayout
            onCancel={handleCancel}
            onEdit={handleEnterEditMode}
            onSend={handleSend}
            onInitialButtonPress={onInitialButtonPress}
            leftButton={leftButton}
            rightButton={rightButton}
            centerButton={centerButton}
            initialButton={{
              ...initialButton,
              // 隐藏 ArcButtonLayout 内部的初始按钮，使用自定义的初始按钮区域
              show: false,
            }}
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
      )}
    </div>
  );
};

export default VoiceRecognitionArcLayout;

