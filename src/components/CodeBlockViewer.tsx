import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
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
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 使用 ref 存储代码块的 ID 映射，确保同一代码块有相同的 ID
  const codeBlockIdMapRef = useRef<Map<string, string>>(new Map());
  
  // 判断是否为JSON类型（需要代码高亮）
  const isJsonType = language === 'map' || language === 'chart';
  
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

  // 生成稳定的ID键
  const idKey = `${codeContent}-${language || ''}`;
  // 如果已存在ID则复用，否则生成新的
  let codeId = codeBlockIdMapRef.current.get(idKey);
  if (!codeId) {
    codeId = generateCodeBlockId(codeContent, language);
    codeBlockIdMapRef.current.set(idKey, codeId);
  }

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
        console.log('[复制代码] 代码已复制到剪贴板', codeId);
        // 2秒后自动恢复
        copyTimerRef.current = setTimeout(() => {
          setCopied(false);
          onCopyChange?.(false);
          copyTimerRef.current = null;
        }, 2000);
      } else {
        console.error('[复制代码] 复制失败', codeId);
      }
    } catch (error) {
      console.error('[复制代码] 复制错误:', error, codeId);
    }
  };

  const showLanguageLabel = language && language.trim().length > 0;
  const showCopyButton = codeComplete; // 只有在输出完毕后才显示复制按钮
  const toolbarBgColor = isDarkMode ? '#374151' : '#f3f4f6';
  const toolbarBorderColor = isDarkMode ? '#4b5563' : '#e5e7eb';
  const defaultBgColor = isDarkMode ? '#1e293b' : '#f6f8fa';

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

      {/* 代码内容区域 */}
      <pre style={{
        ...preStyle,
        margin: 0,
        borderRadius: 0,
        border: 'none',
        borderTop: 'none',
        padding: preStyle.padding || '12px',
        paddingTop: '12px'
      }}>
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
    </div>
  );
};

export default CodeBlockViewer;

