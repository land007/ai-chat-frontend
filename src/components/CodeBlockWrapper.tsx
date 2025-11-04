import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check, Code, Eye } from 'lucide-react';
import { copyToClipboard } from '@/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

interface CodeBlockWrapperProps {
  /** 语言类型（必填） */
  language: string;
  /** 源码内容（必填） */
  codeContent: string;
  /** 渲染的视图内容（必填） */
  renderView: React.ReactNode;
  /** 是否暗色模式（可选） */
  isDarkMode?: boolean;
  /** 是否显示视图切换按钮（可选，默认true） */
  showViewToggle?: boolean;
}

const CodeBlockWrapper: React.FC<CodeBlockWrapperProps> = ({
  language,
  codeContent,
  renderView,
  isDarkMode = false,
  showViewToggle = true
}) => {
  const [viewMode, setViewMode] = useState<'view' | 'source'>('view');
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const codeBlockIdRef = useRef(`code-block-${Date.now()}-${Math.random()}`);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  // 复制源码内容
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
        console.log('[复制代码] 代码已复制到剪贴板', codeBlockIdRef.current);
        // 2秒后自动恢复
        copyTimerRef.current = setTimeout(() => {
          setCopied(false);
          copyTimerRef.current = null;
        }, 2000);
      } else {
        console.error('[复制代码] 复制失败', codeBlockIdRef.current);
      }
    } catch (error) {
      console.error('[复制代码] 复制错误:', error, codeBlockIdRef.current);
    }
  };

  const toolbarBgColor = isDarkMode ? '#374151' : '#f3f4f6';
  const toolbarBorderColor = isDarkMode ? '#4b5563' : '#e5e7eb';
  const codeBgColor = isDarkMode ? '#1e293b' : '#f6f8fa';
  const codeTextColor = isDarkMode ? '#f1f5f9' : '#111827';

  // 渲染源码视图
  const renderSourceView = () => {
    // 构造 markdown 代码块
    const markdownCode = `\`\`\`${language}\n${codeContent}\n\`\`\``;
    
    return (
      <div
        style={{
          margin: 0,
          borderRadius: 0,
          border: 'none',
          borderTop: 'none',
          backgroundColor: codeBgColor,
          padding: '12px'
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            code: ({ className, children, ...props }: any) => {
              return (
                <pre style={{
                  margin: 0,
                  padding: 0,
                  backgroundColor: 'transparent',
                  color: codeTextColor,
                  fontSize: '14px',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                  lineHeight: '1.5'
                }}>
                  <code
                    className={className}
                    style={{
                      color: codeTextColor,
                      backgroundColor: 'transparent'
                    }}
                    {...props}
                  >
                    {children}
                  </code>
                </pre>
              );
            }
          }}
        >
          {markdownCode}
        </ReactMarkdown>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'relative',
        margin: '8px 0',
        borderRadius: '6px',
        overflow: 'hidden',
        border: `1px solid ${toolbarBorderColor}`,
        backgroundColor: codeBgColor
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
          zIndex: 100,
          gap: '8px'
        }}
      >
        {/* 左侧：语言标签 */}
        <div style={{ flex: 0 }}>
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
        </div>

        {/* 右侧：操作区（复制 + 切换） */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {/* 复制按钮 */}
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
              opacity: viewMode === 'source' ? 1 : 0,
              transition: 'opacity 0.2s ease, background-color 0.2s ease',
              color: copied
                ? (isDarkMode ? '#10b981' : '#059669')
                : (isDarkMode ? '#d1d5db' : '#6b7280'),
              boxShadow: isDarkMode
                ? '0 2px 4px rgba(0, 0, 0, 0.3)'
                : '0 2px 4px rgba(0, 0, 0, 0.1)',
              pointerEvents: viewMode === 'source' ? 'auto' : 'none'
            }}
            onMouseEnter={(e) => {
              e.stopPropagation();
              if (viewMode === 'source' && !copied) {
                e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              e.stopPropagation();
              if (viewMode === 'source' && !copied) {
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

          {showViewToggle && (
            viewMode === 'source' ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setViewMode('view');
                }}
                style={{
                  padding: '6px 8px',
                  backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                  border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  color: isDarkMode ? '#d1d5db' : '#6b7280',
                  transition: 'background-color 0.2s ease',
                  boxShadow: isDarkMode
                    ? '0 2px 4px rgba(0, 0, 0, 0.3)'
                    : '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#ffffff';
                }}
                title="显示渲染视图"
              >
                <Eye size={16} />
                <span>渲染</span>
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setViewMode('source');
                }}
                style={{
                  padding: '6px 8px',
                  backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                  border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  color: isDarkMode ? '#d1d5db' : '#6b7280',
                  transition: 'background-color 0.2s ease',
                  boxShadow: isDarkMode
                    ? '0 2px 4px rgba(0, 0, 0, 0.3)'
                    : '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#ffffff';
                }}
                title="显示源码"
              >
                <Code size={16} />
                <span>源码</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* 内容区域：根据视图模式显示渲染视图或源码 */}
      <div style={{
        display: viewMode === 'view' ? 'block' : 'none'
      }}>
        {renderView}
      </div>
      {viewMode === 'source' && (
        <div style={{
          display: 'block'
        }}>
          {renderSourceView()}
        </div>
      )}
    </div>
  );
};

export default CodeBlockWrapper;

