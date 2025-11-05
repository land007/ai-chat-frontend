import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { copyToClipboard } from '@/utils';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

interface CodeBlockViewerProps {
  /** 代码内容（必填） */
  codeContent: string;
  /** 语言类型（可选） */
  language?: string;
  /** CSS类名（可选） */
  className?: string;
  /** React子元素（代码高亮后的内容） */
  children: React.ReactNode;
  /** 代码元素的props（可选） */
  codeProps?: any;
  /** pre元素的样式（可选） */
  preStyle?: React.CSSProperties;
  /** code元素的样式（可选） */
  codeStyle?: React.CSSProperties;
  /** 是否暗色模式（可选，默认false） */
  isDarkMode?: boolean;
  /** 代码是否输出完毕（可选，默认true） */
  codeComplete?: boolean;
  /** 复制状态变化回调（可选） */
  onCopyChange?: (copied: boolean) => void;
}

// 生成简单的哈希函数，用于基于代码内容生成稳定的ID
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

// 生成代码块ID（基于代码内容，确保同一代码块有相同ID）
const generateCodeBlockId = (codeContent: string, language?: string): string => {
  // 使用代码内容的哈希和长度生成稳定的ID
  const contentHash = simpleHash(codeContent);
  const lengthHash = codeContent.length.toString(36);
  const languagePart = language ? `-${language}` : '';
  return `code-block-${contentHash}-${lengthHash}${languagePart}`;
};

const CodeBlockViewer: React.FC<CodeBlockViewerProps> = ({
  codeContent,
  language,
  className = '',
  children,
  codeProps,
  preStyle = {},
  codeStyle = {},
  isDarkMode = false,
  codeComplete = true,
  onCopyChange
}) => {
  const [copied, setCopied] = useState(false);
  const [highlightedContent, setHighlightedContent] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const [isLongCode, setIsLongCode] = useState(false);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  // 使用 ref 存储代码块的 ID 映射，确保同一代码块有相同的 ID
  const codeBlockIdMapRef = useRef<Map<string, string>>(new Map());
  // 跟踪每个代码块的自动折叠状态（基于 codeId）
  const autoCollapsedMapRef = useRef<Map<string, boolean>>(new Map());
  // 跟踪每个代码块的用户交互状态（基于 codeId）
  const userInteractedMapRef = useRef<Map<string, boolean>>(new Map());
  // 跟踪上一次 codeComplete 的值，用于检测变化
  const prevCodeCompleteRef = useRef(codeComplete);
  
  // 判断是否为JSON类型（需要代码高亮）
  const isJsonType = language === 'map' || language === 'chart';
  
  // 生成稳定的ID键
  const idKey = `${codeContent}-${language || ''}`;
  // 如果已存在ID则复用，否则生成新的
  let codeId = codeBlockIdMapRef.current.get(idKey);
  if (!codeId) {
    codeId = generateCodeBlockId(codeContent, language);
    codeBlockIdMapRef.current.set(idKey, codeId);
  }
  // 确保 codeId 不为 undefined（类型安全）
  const safeCodeId = codeId || `code-block-${Date.now()}-${Math.random()}`;

  // 计算代码行数和判断是否为长代码块
  useEffect(() => {
    if (codeContent && safeCodeId) {
      const lines = codeContent.split('\n');
      const count = lines.length;
      setLineCount(count);
      const longCode = count > 30;
      setIsLongCode(longCode);
      // 默认展开，所以如果代码块变短了，重置折叠状态
      if (!longCode) {
        setIsCollapsed(false);
        // 清除自动折叠标记（如果代码块变短了）
        if (autoCollapsedMapRef.current.has(safeCodeId)) {
          autoCollapsedMapRef.current.delete(safeCodeId);
        }
      }
    }
  }, [codeContent, safeCodeId]);
  
  // 打字机完成后的自动折叠逻辑
  useEffect(() => {
    // 检测 codeComplete 从 false 变为 true（打字机完成）
    const codeCompleteChanged = prevCodeCompleteRef.current === false && codeComplete === true;
    prevCodeCompleteRef.current = codeComplete;
    
    // 获取当前代码块的自动折叠和用户交互状态（使用当前的 safeCodeId）
    const hasAutoCollapsed = autoCollapsedMapRef.current.get(safeCodeId) || false;
    const userHasInteracted = userInteractedMapRef.current.get(safeCodeId) || false;
    
    // 如果打字机刚完成，且代码超过30行，且还未自动折叠过，且用户未手动操作过
    if (codeCompleteChanged && isLongCode && !hasAutoCollapsed && !userHasInteracted) {
      // 自动折叠长代码块
      setIsCollapsed(true);
      autoCollapsedMapRef.current.set(safeCodeId, true);
      console.log('[代码块折叠] 打字机完成，自动折叠长代码块', { lineCount, codeId: safeCodeId });
    }
  }, [codeComplete, isLongCode, lineCount, safeCodeId]);
  
  // 实时高亮JSON内容（流式输出时）- 在useEffect中异步更新状态
  useEffect(() => {
    if (isJsonType && codeContent) {
      const highlightNow = () => {
        try {
          const highlighted = hljs.highlight(codeContent, { language: 'json' });
          // 使用函数式更新确保状态正确更新
          setHighlightedContent(prev => {
            // 如果内容相同，不更新（避免不必要的重新渲染）
            if (prev === highlighted.value) {
              return prev;
            }
            return highlighted.value;
          });
        } catch (error) {
          // 如果高亮失败（可能是JSON格式不完整），使用原始内容
          setHighlightedContent(null);
        }
      };
      
      // 清除之前的防抖定时器
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      
      // 立即执行一次高亮（不等待防抖），确保实时显示
      highlightNow();
      
      // 然后设置防抖更新（用于后续优化）
      highlightTimerRef.current = setTimeout(() => {
        highlightNow();
      }, 100);
    } else {
      setHighlightedContent(null);
    }
    
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, [codeContent, isJsonType, language]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, []);

  // 复制代码块内容
  const handleCopyCode = async () => {
    try {
      const success = await copyToClipboard(codeContent);
      if (success) {
        // 清除之前的定时器（如果有）
        if (copyTimerRef.current) {
          clearTimeout(copyTimerRef.current);
        }
        // 设置复制成功状态
        setCopied(true);
        onCopyChange?.(true);
        console.log('[复制代码] 代码已复制到剪贴板', safeCodeId);
        // 2秒后自动恢复
        copyTimerRef.current = setTimeout(() => {
          setCopied(false);
          onCopyChange?.(false);
          copyTimerRef.current = null;
        }, 2000);
      } else {
        console.error('[复制代码] 复制失败', safeCodeId);
      }
    } catch (error) {
      console.error('[复制代码] 复制错误:', error, safeCodeId);
    }
  };

  // 切换折叠/展开状态
  const handleToggleCollapse = () => {
    // 标记用户已手动操作，之后不再自动折叠（基于当前代码块ID）
    userInteractedMapRef.current.set(safeCodeId, true);
    setIsCollapsed(prev => {
      const newState = !prev;
      console.log('[代码块折叠] 用户手动切换折叠状态', { isCollapsed: newState, codeId: safeCodeId });
      return newState;
    });
  };

  const showLanguageLabel = language && language.trim().length > 0;
  const showCopyButton = codeComplete; // 只有在输出完毕后才显示复制按钮
  const showCollapseButton = codeComplete && isLongCode; // 只在代码输出完毕且超过30行时显示折叠按钮
  const toolbarBgColor = isDarkMode ? '#374151' : '#f3f4f6';
  const toolbarBorderColor = isDarkMode ? '#4b5563' : '#e5e7eb';
  const defaultBgColor = isDarkMode ? '#1e293b' : '#f6f8fa';
  
  // 计算折叠时的高度（约15行，每行约22px，加上padding）
  const collapsedHeight = 15 * 22 + 24; // 15行 * 22px + 上下padding 24px
  const preMaxHeight = isCollapsed ? collapsedHeight : '9999px'; // 使用足够大的值而不是 'none'，确保动画效果

  return (
    <div
      style={{
        position: 'relative',
        margin: '8px 0',
        borderRadius: '6px',
        overflow: 'hidden',
        border: `1px solid ${toolbarBorderColor}`,
        backgroundColor: preStyle.backgroundColor || defaultBgColor
      }}
      className="code-block-wrapper"
    >
      {/* 顶部工具栏 */}
      <div
        className="code-toolbar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: toolbarBgColor,
          borderBottom: `1px solid ${toolbarBorderColor}`,
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}
      >
        {/* 语言标签 */}
        <div style={{ flex: showLanguageLabel ? 0 : 1 }}>
          {showLanguageLabel && (
            <span
              className="code-language-label"
              style={{
                padding: '4px 8px',
                backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                color: isDarkMode ? '#d1d5db' : '#374151',
                textTransform: 'lowercase',
                fontWeight: '500',
                display: 'inline-block'
              }}
            >
              {language}
            </span>
          )}
        </div>
        
        {/* 右侧按钮组 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* 折叠/展开按钮 - 只在代码输出完毕且超过30行时显示 */}
          {showCollapseButton && (
            <button
              className="code-collapse-button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleToggleCollapse();
              }}
              style={{
                padding: '6px 8px',
                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 1,
                transition: 'background-color 0.2s ease, color 0.2s ease',
                color: isDarkMode ? '#d1d5db' : '#6b7280',
                boxShadow: isDarkMode
                  ? '0 2px 4px rgba(0, 0, 0, 0.3)'
                  : '0 2px 4px rgba(0, 0, 0, 0.1)',
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#ffffff';
              }}
              title={isCollapsed ? '展开代码' : '折叠代码'}
            >
              {isCollapsed ? (
                <ChevronDown size={16} style={{ transition: 'all 0.2s ease' }} />
              ) : (
                <ChevronUp size={16} style={{ transition: 'all 0.2s ease' }} />
              )}
            </button>
          )}
          
          {/* 复制按钮 - 只在代码输出完毕后显示 */}
          {showCopyButton && (
            <button
              className="code-copy-button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleCopyCode();
              }}
              style={{
                padding: '6px 8px',
                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 1,
                transition: 'background-color 0.2s ease, color 0.2s ease',
                color: copied
                  ? (isDarkMode ? '#10b981' : '#059669')
                  : (isDarkMode ? '#d1d5db' : '#6b7280'),
                boxShadow: isDarkMode
                  ? '0 2px 4px rgba(0, 0, 0, 0.3)'
                  : '0 2px 4px rgba(0, 0, 0, 0.1)',
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                if (!copied) {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#f3f4f6';
                }
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                if (!copied) {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#ffffff';
                }
              }}
              title={copied ? '已复制' : '复制代码'}
            >
              {copied ? (
                <Check size={16} style={{ transition: 'all 0.2s ease' }} />
              ) : (
                <Copy size={16} style={{ transition: 'all 0.2s ease' }} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 代码内容区域 */}
      <div style={{ position: 'relative' }}>
        <pre 
          ref={preRef}
          style={{
            ...preStyle,
            margin: 0,
            borderRadius: 0,
            border: 'none',
            borderTop: 'none',
            padding: preStyle.padding || '12px',
            paddingTop: '12px',
            maxHeight: preMaxHeight,
            overflow: isCollapsed ? 'hidden' : 'auto',
            transition: 'max-height 0.3s ease-in-out',
            position: 'relative'
          }}
        >
          <code
            className={className}
            style={codeStyle}
            {...codeProps}
          >
            {(() => {
              // JSON类型，优先使用高亮内容
              if (isJsonType && codeContent) {
                // 如果高亮内容已准备好，使用高亮内容
                if (highlightedContent) {
                  return <span dangerouslySetInnerHTML={{ __html: highlightedContent }} />;
                }
                // 如果高亮内容还没准备好，尝试实时高亮（同步方式，避免异步延迟）
                // 注意：这里不更新状态，只是直接计算并渲染，避免在渲染中更新状态
                try {
                  const highlighted = hljs.highlight(codeContent, { language: 'json' });
                  return <span dangerouslySetInnerHTML={{ __html: highlighted.value }} />;
                } catch (error) {
                  // 如果高亮失败，显示原始内容
                  return <span>{codeContent}</span>;
                }
              }
              
              // 非JSON类型，使用children
              return children;
            })()}
          </code>
        </pre>
        
        {/* 折叠时的视觉提示遮罩 */}
        {isCollapsed && isLongCode && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '60px',
              background: `linear-gradient(to bottom, transparent, ${isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(246, 248, 250, 0.95)'})`,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: '8px',
              pointerEvents: 'none',
              borderRadius: '0 0 6px 6px'
            }}
          >
            <span
              style={{
                fontSize: '12px',
                color: isDarkMode ? '#9ca3af' : '#6b7280',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                padding: '4px 8px',
                backgroundColor: isDarkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(243, 244, 246, 0.8)',
                borderRadius: '4px',
                border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`
              }}
            >
              ...（共 {lineCount} 行）
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeBlockViewer;

