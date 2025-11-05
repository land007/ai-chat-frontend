import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check, Code, Eye, AlertTriangle } from 'lucide-react';
import { copyToClipboard } from '@/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

// 支持编辑的语言类型列表
const EDITABLE_LANGUAGES = [
  'map', 'chart', 'mermaid', 'diff', 'merge', 'tree',
  'audio', 'video', 'file', 'pdf', '3d'
];

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
  /** 内容变化回调（可选） */
  onContentChange?: (newContent: string) => void;
}

const CodeBlockWrapper: React.FC<CodeBlockWrapperProps> = ({
  language,
  codeContent,
  renderView,
  isDarkMode = false,
  showViewToggle = true,
  onContentChange
}) => {
  const [viewMode, setViewMode] = useState<'view' | 'source'>('view');
  const [copied, setCopied] = useState(false);
  const [editedContent, setEditedContent] = useState(codeContent);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const codeBlockIdRef = useRef(`code-block-${Date.now()}-${Math.random()}`);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editableDivRef = useRef<HTMLDivElement>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cursorPositionRef = useRef<number>(0);
  
  // 判断当前语言是否支持编辑
  const isEditable = EDITABLE_LANGUAGES.includes(language);
  const isJsonType = language === 'map' || language === 'chart';
  
  // 当 codeContent 变化时，同步更新 editedContent
  useEffect(() => {
    setEditedContent(codeContent);
    setValidationError(null);
  }, [codeContent]);
  
  // 保存和恢复光标位置
  const saveCursorPosition = () => {
    if (!editableDivRef.current) return;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editableDivRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    cursorPositionRef.current = preCaretRange.toString().length;
  };
  
  const restoreCursorPosition = (position: number) => {
    if (!editableDivRef.current) return;
    
    const selection = window.getSelection();
    if (!selection) return;
    
    const range = document.createRange();
    const walker = document.createTreeWalker(
      editableDivRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let currentPos = 0;
    let node: Node | null = null;
    
    while ((node = walker.nextNode())) {
      const nodeLength = node.textContent?.length || 0;
      if (currentPos + nodeLength >= position) {
        range.setStart(node, position - currentPos);
        range.setEnd(node, position - currentPos);
        break;
      }
      currentPos += nodeLength;
    }
    
    if (range.startContainer) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };
  
  // 实时高亮JSON内容
  const applyHighlight = (content: string, preserveCursor: boolean = false) => {
    if (!isJsonType || !editableDivRef.current) return;
    
    if (preserveCursor) {
      saveCursorPosition();
    }
    
    try {
      const highlighted = hljs.highlight(content, { language: 'json' });
      editableDivRef.current.innerHTML = highlighted.value;
      
      if (preserveCursor) {
        // 恢复光标位置
        setTimeout(() => {
          restoreCursorPosition(cursorPositionRef.current);
        }, 0);
      }
    } catch (error) {
      // 如果高亮失败，使用纯文本
      editableDivRef.current.textContent = content;
      if (preserveCursor) {
        setTimeout(() => {
          restoreCursorPosition(cursorPositionRef.current);
        }, 0);
      }
    }
  };
  
  // 对于JSON类型，在视图切换到源码视图时初始化内容
  useEffect(() => {
    if (isJsonType && editableDivRef.current && viewMode === 'source' && !isEditing) {
      const currentText = editableDivRef.current.textContent || '';
      const currentInnerHTML = editableDivRef.current.innerHTML || '';
      
      // 如果内容为空或者不匹配，设置内容并应用高亮
      if (!currentText.trim() || (currentText !== editedContent && currentText.trim())) {
        if (editedContent) {
          applyHighlight(editedContent, false);
        } else {
          editableDivRef.current.textContent = '';
        }
      } else if (currentText === editedContent && editedContent && !currentInnerHTML.includes('<span')) {
        // 如果内容匹配但还没有高亮，应用高亮
        applyHighlight(editedContent, false);
      }
    }
  }, [viewMode, editedContent, isJsonType, isEditing]);

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

  // 复制源码内容
  const handleCopyCode = async () => {
    const contentToCopy = isEditable && viewMode === 'source' ? editedContent : codeContent;
    try {
      const success = await copyToClipboard(contentToCopy);
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
  
  // 验证内容格式
  const validateContent = (content: string): { valid: boolean; error?: string } => {
    if (!content.trim()) {
      return { valid: false, error: '内容不能为空' };
    }
    
    try {
      switch (language) {
        case 'map':
        case 'chart':
          // JSON类型验证
          JSON.parse(content);
          return { valid: true };
          
        case 'audio':
        case 'video':
        case 'pdf':
        case '3d':
          // URL类型验证
          const url = content.trim().split('\n')[0].trim();
          if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
            return { valid: false, error: '请输入有效的URL（必须以 http:// 或 https:// 开头）' };
          }
          return { valid: true };
          
        case 'file':
          // 文件类型验证（简单检查）
          const lines = content.trim().split('\n');
          if (lines.length < 2) {
            return { valid: false, error: '文件格式不正确，需要文件名和URL' };
          }
          const fileUrl = lines[1]?.trim();
          if (!fileUrl || (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://'))) {
            return { valid: false, error: '请输入有效的文件URL（必须以 http:// 或 https:// 开头）' };
          }
          return { valid: true };
          
        case 'mermaid':
          // Mermaid语法验证（基础检查）
          if (!content.trim().startsWith('graph') && 
              !content.trim().startsWith('flowchart') &&
              !content.trim().startsWith('sequenceDiagram') &&
              !content.trim().startsWith('classDiagram') &&
              !content.trim().startsWith('stateDiagram') &&
              !content.trim().startsWith('erDiagram') &&
              !content.trim().startsWith('gantt') &&
              !content.trim().startsWith('pie') &&
              !content.trim().startsWith('journey')) {
            return { valid: false, error: 'Mermaid语法格式不正确，请检查语法' };
          }
          return { valid: true };
          
        case 'diff':
        case 'merge':
        case 'tree':
          // 文本类型验证（简单非空检查）
          return { valid: true };
          
        default:
          return { valid: true };
      }
    } catch (error: any) {
      if (language === 'map' || language === 'chart') {
        return { 
          valid: false, 
          error: `JSON格式错误: ${error.message || '请检查JSON格式是否正确'}` 
        };
      }
      return { valid: false, error: error.message || '内容格式错误' };
    }
  };
  
  // 处理渲染按钮点击
  const handleRender = () => {
    const validation = validateContent(editedContent);
    if (!validation.valid) {
      setValidationError(validation.error || '内容验证失败');
      console.error('[编辑渲染] 内容验证失败:', validation.error);
      return;
    }
    
    // 清除错误
    setValidationError(null);
    
    // 调用回调更新内容
    if (onContentChange) {
      onContentChange(editedContent);
      console.log('[编辑渲染] 内容已更新', codeBlockIdRef.current);
    }
    
    // 切换到视图模式
    setViewMode('view');
  };

  const toolbarBgColor = isDarkMode ? '#374151' : '#f3f4f6';
  const toolbarBorderColor = isDarkMode ? '#4b5563' : '#e5e7eb';
  const codeBgColor = isDarkMode ? '#1e293b' : '#f6f8fa';
  const codeTextColor = isDarkMode ? '#f1f5f9' : '#111827';

  // 渲染高亮后的代码（用于JSON类型）
  const renderHighlightedCode = (content: string): string => {
    if (!isJsonType) return content;
    try {
      // 尝试高亮JSON
      const highlighted = hljs.highlight(content, { language: 'json' });
      return highlighted.value;
    } catch (error) {
      // 如果高亮失败，返回原始内容
      return content;
    }
  };
  
  // 处理contenteditable的粘贴事件（移除格式）
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // 更新内容
    const newContent = e.currentTarget.textContent || '';
    setEditedContent(newContent);
    setValidationError(null);
  };
  
  // 渲染源码视图
  const renderSourceView = () => {
    // 如果是可编辑的语言类型，显示可编辑的编辑器
    if (isEditable) {
      const errorBgColor = isDarkMode ? '#2d1f1f' : '#fee2e2';
      const errorBorderColor = isDarkMode ? '#ef4444' : '#dc2626';
      const errorTextColor = isDarkMode ? '#ef4444' : '#dc2626';
      
      // 如果是JSON类型，使用contenteditable div配合高亮
      if (isJsonType) {
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
            <div
              ref={editableDivRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                const text = e.currentTarget.textContent || '';
                setEditedContent(text);
                setValidationError(null);
                setIsEditing(true);
                
                // 实时应用高亮（使用防抖避免频繁更新）
                if (highlightTimerRef.current) {
                  clearTimeout(highlightTimerRef.current);
                }
                highlightTimerRef.current = setTimeout(() => {
                  applyHighlight(text, true);
                }, 100); // 100ms防抖
              }}
              onPaste={handlePaste}
              onFocus={() => {
                setIsEditing(true);
                // 获得焦点时，确保内容已加载
                if (editableDivRef.current) {
                  const text = editableDivRef.current.textContent || editedContent || '';
                  if (text && text !== editedContent) {
                    setEditedContent(text);
                  }
                  // 如果内容是纯文本（没有高亮），应用高亮
                  const currentInnerHTML = editableDivRef.current.innerHTML || '';
                  if (text && !currentInnerHTML.includes('<span')) {
                    applyHighlight(text, false);
                  }
                }
              }}
              onBlur={(e) => {
                setIsEditing(false);
                // 清除防抖定时器
                if (highlightTimerRef.current) {
                  clearTimeout(highlightTimerRef.current);
                  highlightTimerRef.current = null;
                }
                // 失去焦点时确保高亮已应用
                const text = e.currentTarget.textContent || '';
                setEditedContent(text);
                if (text) {
                  applyHighlight(text, false);
                }
              }}
              style={{
                width: '100%',
                minHeight: '200px',
                padding: '12px',
                backgroundColor: validationError ? errorBgColor : (isDarkMode ? '#1e293b' : '#ffffff'),
                border: `1px solid ${validationError ? errorBorderColor : (isDarkMode ? '#4b5563' : '#e5e7eb')}`,
                borderRadius: '6px',
                color: codeTextColor,
                fontSize: '14px',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                lineHeight: '1.5',
                outline: 'none',
                boxSizing: 'border-box',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
              }}
              // 不使用 dangerouslySetInnerHTML，而是通过 useEffect 来设置内容
              // 这样可以避免 React 的警告，并且更好地控制内容更新
              onKeyDown={(e) => {
                // 支持 Tab 键缩进
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const selection = window.getSelection();
                  if (!selection || !selection.rangeCount) return;
                  
                  const range = selection.getRangeAt(0);
                  const tabNode = document.createTextNode('  ');
                  range.insertNode(tabNode);
                  range.setStartAfter(tabNode);
                  range.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(range);
                  
                  // 更新内容
                  const newContent = e.currentTarget.textContent || '';
                  setEditedContent(newContent);
                }
              }}
              data-placeholder="在此编辑JSON配置内容..."
            />
            {validationError && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  backgroundColor: errorBgColor,
                  border: `1px solid ${errorBorderColor}`,
                  borderRadius: '6px',
                  color: errorTextColor,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <AlertTriangle size={16} />
                <span>{validationError}</span>
              </div>
            )}
            <style>{`
              [contenteditable][data-placeholder]:empty:before,
              [contenteditable][data-placeholder]:not(:focus):empty:before {
                content: attr(data-placeholder);
                color: ${isDarkMode ? '#6b7280' : '#9ca3af'};
                pointer-events: none;
              }
            `}</style>
          </div>
        );
      }
      
      // 非JSON类型，使用普通textarea
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
          <textarea
            ref={textareaRef}
            value={editedContent}
            onChange={(e) => {
              setEditedContent(e.target.value);
              setValidationError(null);
            }}
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '12px',
              backgroundColor: validationError ? errorBgColor : (isDarkMode ? '#1e293b' : '#ffffff'),
              border: `1px solid ${validationError ? errorBorderColor : (isDarkMode ? '#4b5563' : '#e5e7eb')}`,
              borderRadius: '6px',
              color: codeTextColor,
              fontSize: '14px',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
              lineHeight: '1.5',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box'
            }}
            onKeyDown={(e) => {
              // 支持 Tab 键缩进
              if (e.key === 'Tab') {
                e.preventDefault();
                const textarea = e.currentTarget;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const value = textarea.value;
                const newValue = value.substring(0, start) + '  ' + value.substring(end);
                setEditedContent(newValue);
                // 恢复光标位置
                setTimeout(() => {
                  textarea.selectionStart = textarea.selectionEnd = start + 2;
                }, 0);
              }
            }}
            placeholder="在此编辑配置内容..."
          />
          {validationError && (
            <div
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                backgroundColor: errorBgColor,
                border: `1px solid ${errorBorderColor}`,
                borderRadius: '6px',
                color: errorTextColor,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <AlertTriangle size={16} />
              <span>{validationError}</span>
            </div>
          )}
        </div>
      );
    }
    
    // 非可编辑类型，使用原有的代码显示方式
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
                  // 如果是可编辑类型，先验证并应用更改，然后切换到视图
                  if (isEditable) {
                    handleRender();
                  } else {
                    // 非可编辑类型，直接切换到视图
                    setViewMode('view');
                  }
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
                title={isEditable ? "应用更改并渲染" : "显示渲染视图"}
              >
                <Eye size={16} />
                <span>视图</span>
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

