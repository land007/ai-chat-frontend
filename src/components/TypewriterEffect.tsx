import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import hljs from 'highlight.js';
import { Info, AlertTriangle, CheckCircle2, XCircle, Copy, Check } from 'lucide-react';
import { TypewriterEffectProps, MapConfig } from '@/types';
import MermaidChart from './MermaidChart';
import ImageViewer from './ImageViewer';
import MapViewer from './MapViewer';
import AudioPlayer from './AudioPlayer';
import VideoPlayer from './VideoPlayer';
import DiffViewer from './DiffViewer';
import FileDownloader from './FileDownloader';
import ChecklistItem from './ChecklistItem';
import TreeViewer from './TreeViewer';
import PDFViewer from './PDFViewer';
import ChartRenderer from './ChartRenderer';
import Model3DViewer from './Model3DViewer';
import CodeBlockWrapper from './CodeBlockWrapper';
import { copyToClipboard } from '@/utils';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';

const TypewriterEffect: React.FC<TypewriterEffectProps> = ({
  text,
  speed = 10,
  onComplete,
  className = '',
  style = {},
  enabled = true,
  isDarkMode = false,
  isStreaming = false,
  isThinking = false
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(!enabled); // 如果打字机被禁用，则认为已完成
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const targetTextRef = useRef('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const codeBlockCounterRef = useRef(0);

  // enabled=false：直接渲染完整内容（历史消息）
  // enabled=true：启动打字机（当前流式消息）
  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text);
      setCurrentIndex(text.length);
      setIsTypingComplete(true); // 打字机被禁用时，立即设置为完成
      return;
    }
    
    // 打字机启用时，重置完成状态
    setIsTypingComplete(false);

    // 更新目标文本
    targetTextRef.current = text;

    // 启动长效定时器（仅启动一次）
    if (!intervalRef.current) {
      console.log('[打字机] 启动定时器');
      
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          const target = targetTextRef.current.length;
          // 追赶目标，追上后空转
          return prev < target ? prev + 1 : prev;
        });
      }, speed);
    }
  }, [text, enabled, speed]);

  // 更新显示内容（仅打字机模式）
  useEffect(() => {
    if (enabled) {
      setDisplayedText(targetTextRef.current.slice(0, currentIndex));
    }
  }, [currentIndex, enabled]);

  // 打字机追上目标且SSE结束时停止定时器
  useEffect(() => {
    if (!enabled) return;

    // 关键：打字机遇到end = (追上目标 && SSE结束)
    const typewriterReachedEnd = currentIndex >= targetTextRef.current.length && currentIndex > 0;
    const sseEnded = !isStreaming;
    
    if (typewriterReachedEnd && sseEnded && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('[打字机] 打字机遇到end，定时器停止', {
        currentIndex,
        targetLength: targetTextRef.current.length
      });
      setIsTypingComplete(true); // 打字机完成，设置完成状态
      onComplete?.();
    }
  }, [isStreaming, currentIndex, enabled, onComplete]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('[打字机] 组件卸载，清理定时器');
      }
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  // 复制代码块内容
  const handleCopyCode = async (codeId: string, codeContent: string) => {
    try {
      const success = await copyToClipboard(codeContent);
      if (success) {
        // 清除之前的定时器（如果有）
        if (copyTimerRef.current) {
          clearTimeout(copyTimerRef.current);
        }
        // 设置复制成功状态
        setCopiedCodeId(codeId);
        console.log('[复制代码] 代码已复制到剪贴板', codeId);
        // 2秒后自动恢复
        copyTimerRef.current = setTimeout(() => {
          setCopiedCodeId(null);
          copyTimerRef.current = null;
        }, 2000);
      } else {
        console.error('[复制代码] 复制失败', codeId);
      }
    } catch (error) {
      console.error('[复制代码] 复制错误:', error, codeId);
    }
  };

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

  // 使用 ref 存储代码块的 ID 映射，确保同一代码块有相同的 ID
  const codeBlockIdMapRef = useRef<Map<string, string>>(new Map());

  // 渲染带有复制按钮的代码块
  const renderCodeBlockWithCopy = (
    codeContent: string,
    className: string,
    children: any,
    codeProps: any,
    preStyle: React.CSSProperties,
    codeStyle: React.CSSProperties,
    language?: string,
    codeComplete: boolean = true // 代码是否输出完毕，默认true（历史消息）
  ) => {
    // 生成稳定的ID键
    const idKey = `${codeContent}-${language || ''}`;
    // 如果已存在ID则复用，否则生成新的
    let codeId = codeBlockIdMapRef.current.get(idKey);
    if (!codeId) {
      codeId = generateCodeBlockId(codeContent, language);
      codeBlockIdMapRef.current.set(idKey, codeId);
    }
    const isCopied = copiedCodeId === codeId;
    const showLanguageLabel = language && language.trim().length > 0;
    const showCopyButton = codeComplete; // 只有在输出完毕后才显示复制按钮
    const toolbarBgColor = isDarkMode ? '#374151' : '#f3f4f6';
    const toolbarBorderColor = isDarkMode ? '#4b5563' : '#e5e7eb';

    return (
      <div
        style={{
          position: 'relative',
          margin: '8px 0',
          borderRadius: '6px',
          overflow: 'hidden',
          border: `1px solid ${toolbarBorderColor}`,
          backgroundColor: preStyle.backgroundColor || (isDarkMode ? '#1e293b' : '#f6f8fa')
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
            zIndex: 10
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
                handleCopyCode(codeId, codeContent);
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
                color: isCopied
                  ? (isDarkMode ? '#10b981' : '#059669')
                  : (isDarkMode ? '#d1d5db' : '#6b7280'),
                boxShadow: isDarkMode
                  ? '0 2px 4px rgba(0, 0, 0, 0.3)'
                  : '0 2px 4px rgba(0, 0, 0, 0.1)',
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                if (!isCopied) {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#f3f4f6';
                }
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                if (!isCopied) {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#ffffff';
                }
              }}
              title={isCopied ? '已复制' : '复制代码'}
            >
              {isCopied ? (
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
            {children}
          </code>
        </pre>
      </div>
    );
  };

  // 递归提取文本内容
  const extractTextContent = (node: any): string => {
    if (typeof node === 'string') {
      return node;
    }
    if (Array.isArray(node)) {
      return node.map(extractTextContent).join('');
    }
    if (node?.props?.children) {
      return extractTextContent(node.props.children);
    }
    return '';
  };

  // 解析警告框内容
  const parseAlertBlock = (children: any): { type: string; title: string; content: string | null } | null => {
    // 提取所有文本内容
    const textContent = extractTextContent(children);
    
    if (!textContent || typeof textContent !== 'string') {
      return null;
    }

    // 检查是否匹配警告框格式 [!TYPE] 标题
    // 支持格式：> [!info] 标题 或 > [!info]\n> 标题
    const alertMatch = textContent.match(/\[!(\w+)\]\s*(.*?)(?:\n|$)/m);
    
    if (alertMatch) {
      const type = alertMatch[1].toLowerCase();
      let title = alertMatch[2].trim();
      
      // 如果没有标题，使用类型作为标题
      if (!title) {
        title = type.charAt(0).toUpperCase() + type.slice(1);
      }
      
      // 获取剩余内容（移除 [!TYPE] 标题这一行）
      const contentStartIndex = alertMatch[0].length;
      let content = textContent.substring(contentStartIndex).trim();
      
      // 移除所有行首的 > 符号（markdown blockquote 符号）
      content = content.replace(/^>\s*/gm, '');
      
      // 如果内容为空，返回 null
      if (!content) {
        return { type, title, content: null };
      }
      
      return { type, title, content };
    }
    
    return null;
  };

  // 获取警告框样式
  const getAlertStyles = (type: string) => {
    const baseStyles = {
      margin: '16px 0',
      padding: '12px 16px',
      borderRadius: '8px',
      borderLeft: `4px solid`,
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start'
    };

    switch (type.toLowerCase()) {
      case 'info':
      case 'note':
      case 'tip':
        return {
          ...baseStyles,
          backgroundColor: isDarkMode ? '#1e3a5f' : '#e0f2fe',
          borderLeftColor: isDarkMode ? '#3b82f6' : '#0284c7',
          color: isDarkMode ? '#bfdbfe' : '#0c4a6e'
        };
      case 'warning':
      case 'caution':
        return {
          ...baseStyles,
          backgroundColor: isDarkMode ? '#78350f' : '#fef3c7',
          borderLeftColor: isDarkMode ? '#f59e0b' : '#d97706',
          color: isDarkMode ? '#fde68a' : '#92400e'
        };
      case 'success':
      case 'check':
        return {
          ...baseStyles,
          backgroundColor: isDarkMode ? '#064e3b' : '#d1fae5',
          borderLeftColor: isDarkMode ? '#10b981' : '#059669',
          color: isDarkMode ? '#6ee7b7' : '#065f46'
        };
      case 'error':
      case 'danger':
        return {
          ...baseStyles,
          backgroundColor: isDarkMode ? '#7f1d1d' : '#fee2e2',
          borderLeftColor: isDarkMode ? '#ef4444' : '#dc2626',
          color: isDarkMode ? '#fca5a5' : '#991b1b'
        };
      default:
        return {
          ...baseStyles,
          backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
          borderLeftColor: isDarkMode ? '#6b7280' : '#9ca3af',
          color: isDarkMode ? '#d1d5db' : '#4b5563'
        };
    }
  };

  // 获取警告框图标
  const getAlertIcon = (type: string) => {
    const iconSize = 20;
    const iconStyle = { flexShrink: 0, marginTop: '2px' };
    
    switch (type.toLowerCase()) {
      case 'info':
      case 'note':
      case 'tip':
        return <Info size={iconSize} style={iconStyle} />;
      case 'warning':
      case 'caution':
        return <AlertTriangle size={iconSize} style={iconStyle} />;
      case 'success':
      case 'check':
        return <CheckCircle2 size={iconSize} style={iconStyle} />;
      case 'error':
      case 'danger':
        return <XCircle size={iconSize} style={iconStyle} />;
      default:
        return <Info size={iconSize} style={iconStyle} />;
    }
  };

  // 解析文件下载信息
  const parseFileInfo = (content: string): { url: string; fileName?: string } | null => {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return null;
    
    const url = lines[0].trim();
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return null;
    }
    
    // 查找文件名行（格式：文件名：xxx）
    let fileName: string | undefined = undefined;
    const fileNameMatch = content.match(/文件名[：:]\s*(.+)/i);
    if (fileNameMatch) {
      fileName = fileNameMatch[1].trim();
    }
    
    return { url, fileName };
  };

  // 渲染Markdown内容
  const renderMarkdown = (content: string) => {
    // 确保当 copiedCodeId 变化时，ReactMarkdown 会重新渲染
    // 通过在 key 中包含 copiedCodeId 来强制重新渲染
    return (
    <ReactMarkdown
      key={`markdown-${copiedCodeId || 'none'}`}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeHighlight, rehypeKatex]}
      components={{
        code: ({ className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          const isInline = !match;
          // 使用 extractTextContent 正确提取代码字符串，避免 [object Object] 问题
          const codeString = extractTextContent(children).replace(/\n$/, '');
          
          // 如果是Mermaid代码块，使用Mermaid组件渲染
          if (!isInline && language === 'mermaid') {
            // 只有在打字机完成且流式结束后才渲染图表，否则显示普通代码块
            if (isStreaming || !isTypingComplete) {
              return renderCodeBlockWithCopy(
                codeString,
                className || '',
                children,
                props,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  margin: '0',
                  color: isDarkMode ? '#f1f5f9' : '#111827'
                },
                {
                  color: isDarkMode ? '#f1f5f9' : '#111827',
                  backgroundColor: 'transparent'
                },
                language,
                false // 流式传输期间，代码未输出完毕
              );
            }
            
            // 打字机完成且流式结束后，渲染图表
            return (
              <CodeBlockWrapper
                language={language}
                codeContent={codeString}
                renderView={
                  <div style={{ margin: '16px 0' }}>
                    <MermaidChart code={codeString} isDarkMode={isDarkMode} />
                  </div>
                }
                isDarkMode={isDarkMode}
                showViewToggle={true}
              />
            );
          }
          
          // 如果是Map代码块，使用MapViewer组件渲染
          if (!isInline && language === 'map') {
            // 只有在打字机完成且流式结束后才渲染地图，否则显示普通代码块
            if (isStreaming || !isTypingComplete) {
              return renderCodeBlockWithCopy(
                codeString,
                className || '',
                children,
                props,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  margin: '0',
                  color: isDarkMode ? '#f1f5f9' : '#111827'
                },
                {
                  color: isDarkMode ? '#f1f5f9' : '#111827',
                  backgroundColor: 'transparent'
                },
                language,
                false // 流式传输期间，代码未输出完毕
              );
            }
            
            // 打字机完成且流式结束后，解析并渲染地图
            try {
              // 解析JSON格式的地图配置
              const mapConfig: MapConfig = JSON.parse(codeString);
              return (
                <CodeBlockWrapper
                  language={language}
                  codeContent={codeString}
                  renderView={
                    <div style={{ margin: '16px 0' }}>
                      <MapViewer config={mapConfig} isDarkMode={isDarkMode} />
                    </div>
                  }
                  isDarkMode={isDarkMode}
                  showViewToggle={true}
                />
              );
            } catch (error) {
              // 解析失败时显示错误信息
              console.error('[地图] JSON解析失败:', error);
              return (
                <CodeBlockWrapper
                  language={language}
                  codeContent={codeString}
                  renderView={
                    <div style={{ 
                      margin: '16px 0',
                      padding: '12px',
                      backgroundColor: isDarkMode ? '#2d1f1f' : '#fee',
                      borderRadius: '6px',
                      border: `1px solid ${isDarkMode ? '#ef4444' : '#dc2626'}`
                    }}>
                      <p style={{ 
                        margin: 0, 
                        color: isDarkMode ? '#ef4444' : '#dc2626',
                        fontSize: '14px'
                      }}>
                        地图配置解析失败，请检查JSON格式是否正确
                      </p>
                    </div>
                  }
                  isDarkMode={isDarkMode}
                  showViewToggle={true}
                />
              );
            }
          }
          
          // 如果是Audio代码块，使用AudioPlayer组件渲染
          if (!isInline && language === 'audio') {
            // 只有在打字机完成且流式结束后才渲染播放器，否则显示普通代码块（不触发下载）
            if (isStreaming || !isTypingComplete) {
              return renderCodeBlockWithCopy(
                codeString,
                className || '',
                children,
                props,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  margin: '0',
                  color: isDarkMode ? '#f1f5f9' : '#111827'
                },
                {
                  color: isDarkMode ? '#f1f5f9' : '#111827',
                  backgroundColor: 'transparent'
                },
                language,
                false // 流式传输期间，代码未输出完毕
              );
            }
            
            // 打字机完成且流式结束后，渲染播放器
            return (
              <CodeBlockWrapper
                language={language}
                codeContent={codeString}
                renderView={
                  <div style={{ margin: '16px 0' }}>
                    <AudioPlayer url={codeString.trim()} isDarkMode={isDarkMode} />
                  </div>
                }
                isDarkMode={isDarkMode}
                showViewToggle={true}
              />
            );
          }
          
          // 如果是Video代码块，使用VideoPlayer组件渲染
          if (!isInline && language === 'video') {
            // 只有在打字机完成且流式结束后才渲染播放器，否则显示普通代码块（不触发下载）
            if (isStreaming || !isTypingComplete) {
              return renderCodeBlockWithCopy(
                codeString,
                className || '',
                children,
                props,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  margin: '0',
                  color: isDarkMode ? '#f1f5f9' : '#111827'
                },
                {
                  color: isDarkMode ? '#f1f5f9' : '#111827',
                  backgroundColor: 'transparent'
                },
                language,
                false // 流式传输期间，代码未输出完毕
              );
            }
            
            // 打字机完成且流式结束后，渲染播放器
            return (
              <CodeBlockWrapper
                language={language}
                codeContent={codeString}
                renderView={
                  <div style={{ margin: '16px 0' }}>
                    <VideoPlayer url={codeString.trim()} isDarkMode={isDarkMode} />
                  </div>
                }
                isDarkMode={isDarkMode}
                showViewToggle={true}
              />
            );
          }

          // 如果是File代码块，使用文件下载组件渲染
          if (!isInline && language === 'file') {
            // 只有在打字机完成且流式结束后才渲染下载链接，否则显示普通代码块（不触发下载）
            if (isStreaming || !isTypingComplete) {
              return renderCodeBlockWithCopy(
                codeString,
                className || '',
                children,
                props,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  margin: '0',
                  color: isDarkMode ? '#f1f5f9' : '#111827'
                },
                {
                  color: isDarkMode ? '#f1f5f9' : '#111827',
                  backgroundColor: 'transparent'
                },
                language,
                false // 流式传输期间，代码未输出完毕
              );
            }
            
            // 解析文件信息
            const fileInfo = parseFileInfo(codeString);
            if (!fileInfo) {
              return renderCodeBlockWithCopy(
                codeString,
                className || '',
                children,
                props,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  margin: '0',
                  color: isDarkMode ? '#f1f5f9' : '#111827'
                },
                {
                  color: isDarkMode ? '#f1f5f9' : '#111827',
                  backgroundColor: 'transparent'
                },
                language,
                true // 代码已输出完毕
              );
            }
            
            // 打字机完成且流式结束后，渲染下载链接
            return (
              <CodeBlockWrapper
                language={language}
                codeContent={codeString}
                renderView={
                  <FileDownloader
                    url={fileInfo.url}
                    fileName={fileInfo.fileName}
                    isDarkMode={isDarkMode}
                  />
                }
                isDarkMode={isDarkMode}
                showViewToggle={true}
              />
            );
          }

          // 如果是Diff代码块，使用DiffViewer组件渲染
          if (!isInline && language === 'diff') {
            return (
              <CodeBlockWrapper
                language={language}
                codeContent={codeString}
                renderView={
                  <DiffViewer code={codeString} isDarkMode={isDarkMode} />
                }
                isDarkMode={isDarkMode}
                showViewToggle={true}
              />
            );
          }

          // 如果是Merge代码块（合并冲突），使用DiffViewer组件渲染
          if (!isInline && language === 'merge') {
            return (
              <CodeBlockWrapper
                language={language}
                codeContent={codeString}
                renderView={
                  <DiffViewer code={codeString} isDarkMode={isDarkMode} />
                }
                isDarkMode={isDarkMode}
                showViewToggle={true}
              />
            );
          }

          // 如果是Tree代码块，使用TreeViewer组件渲染
          if (!isInline && language === 'tree') {
            return (
              <CodeBlockWrapper
                language={language}
                codeContent={codeString}
                renderView={
                  <TreeViewer code={codeString} isDarkMode={isDarkMode} />
                }
                isDarkMode={isDarkMode}
                showViewToggle={true}
              />
            );
          }

          // 如果是图表代码块，使用 ChartRenderer 渲染
          if (!isInline && language === 'chart') {
            if (isStreaming || !isTypingComplete) {
              return renderCodeBlockWithCopy(
                codeString,
                className || '',
                children,
                props,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  margin: '0',
                  color: isDarkMode ? '#f1f5f9' : '#111827'
                },
                {
                  color: isDarkMode ? '#f1f5f9' : '#111827',
                  backgroundColor: 'transparent'
                },
                language,
                false // 流式传输期间，代码未输出完毕
              );
            }

            return (
              <CodeBlockWrapper
                language={language}
                codeContent={codeString}
                renderView={
                  <ChartRenderer config={codeString} isDarkMode={isDarkMode} />
                }
                isDarkMode={isDarkMode}
                showViewToggle={true}
              />
            );
          }

          // 如果是PDF代码块，使用PDFViewer组件渲染
          if (!isInline && language === 'pdf') {
            // 只有在打字机完成且流式结束后才渲染PDF查看器，否则显示普通代码块（不触发加载）
            if (isStreaming || !isTypingComplete) {
              return renderCodeBlockWithCopy(
                codeString,
                className || '',
                children,
                props,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  margin: '0',
                  color: isDarkMode ? '#f1f5f9' : '#111827'
                },
                {
                  color: isDarkMode ? '#f1f5f9' : '#111827',
                  backgroundColor: 'transparent'
                },
                language,
                false // 流式传输期间，代码未输出完毕
              );
            }
            
            // 解析PDF信息（类似 FileDownloader）
            const pdfUrl = codeString.trim().split('\n')[0].trim();
            if (!pdfUrl || (!pdfUrl.startsWith('http://') && !pdfUrl.startsWith('https://'))) {
              return renderCodeBlockWithCopy(
                codeString,
                className || '',
                children,
                props,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  margin: '0',
                  color: isDarkMode ? '#f1f5f9' : '#111827'
                },
                {
                  color: isDarkMode ? '#f1f5f9' : '#111827',
                  backgroundColor: 'transparent'
                },
                language,
                true // 代码已输出完毕
              );
            }
            
            // 打字机完成且流式结束后，渲染PDF查看器
            return (
              <CodeBlockWrapper
                language={language}
                codeContent={codeString}
                renderView={
                  <PDFViewer url={pdfUrl} isDarkMode={isDarkMode} />
                }
                isDarkMode={isDarkMode}
                showViewToggle={true}
              />
            );
          }
          
          // 如果是3D模型代码块，使用Model3DViewer组件渲染
          if (!isInline && language === '3d') {
            // 只有在打字机完成且流式结束后才渲染模型，否则显示普通代码块（不触发加载）
            if (isStreaming || !isTypingComplete) {
              return renderCodeBlockWithCopy(
                codeString,
                className || '',
                children,
                props,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  margin: '0',
                  color: isDarkMode ? '#f1f5f9' : '#111827'
                },
                {
                  color: isDarkMode ? '#f1f5f9' : '#111827',
                  backgroundColor: 'transparent'
                },
                language,
                false // 流式传输期间，代码未输出完毕
              );
            }
            
            // 解析3D模型URL
            const modelUrl = codeString.trim().split('\n')[0].trim();
            if (!modelUrl || (!modelUrl.startsWith('http://') && !modelUrl.startsWith('https://'))) {
              return renderCodeBlockWithCopy(
                codeString,
                className || '',
                children,
                props,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  margin: '0',
                  color: isDarkMode ? '#f1f5f9' : '#111827'
                },
                {
                  color: isDarkMode ? '#f1f5f9' : '#111827',
                  backgroundColor: 'transparent'
                },
                language,
                true // 代码已输出完毕
              );
            }
            
            // 打字机完成且流式结束后，渲染3D模型
            return (
              <CodeBlockWrapper
                language={language}
                codeContent={codeString}
                renderView={
                  <Model3DViewer url={modelUrl} isDarkMode={isDarkMode} />
                }
                isDarkMode={isDarkMode}
                showViewToggle={true}
              />
            );
          }
          
          // 普通代码块
          return !isInline ? (
            renderCodeBlockWithCopy(
              codeString,
              className || '',
              children,
              props,
              {
                backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                padding: '12px',
                borderRadius: '6px',
                overflow: 'auto',
                margin: '0',
                color: isDarkMode ? '#f1f5f9' : '#111827'
              },
              {
                color: isDarkMode ? '#f1f5f9' : '#111827',
                backgroundColor: 'transparent'
              },
              language || undefined,
              !isStreaming && isTypingComplete // 代码输出完毕的判断
            )
          ) : (
            <code style={{ 
              backgroundColor: isDarkMode ? '#4b5563' : '#f1f3f4', 
              padding: '2px 4px', 
              borderRadius: '3px',
              fontSize: '0.9em',
              color: isDarkMode ? '#f9fafb' : '#111827'
            }} {...props}>
              {children}
            </code>
          );
        },
        p: ({ children }) => <p style={{ margin: '0', lineHeight: '1.5' }}>{children}</p>,
        ul: ({ children }) => <ul style={{ margin: '0', paddingLeft: '20px' }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: '0', paddingLeft: '20px' }}>{children}</ol>,
        li: ({ children, ...props }: any) => {
          // 检测是否是任务列表项（包含 checkbox）
          let hasCheckbox = false;
          let isChecked = false;
          let taskContent: React.ReactNode[] = [];
          
          // 递归查找 checkbox
          const findCheckbox = (node: any): boolean => {
            if (!node) return false;
            
            // 检查是否是 input checkbox
            if (node.type === 'input' && node.props?.type === 'checkbox') {
              hasCheckbox = true;
              isChecked = node.props.checked || false;
              return true;
            }
            
            // 检查数组
            if (Array.isArray(node)) {
              return node.some(findCheckbox);
            }
            
            // 检查对象（React 元素）
            if (typeof node === 'object' && node.props) {
              // 如果是 input checkbox，设置状态
              if (node.type === 'input' && node.props.type === 'checkbox') {
                hasCheckbox = true;
                isChecked = node.props.checked || false;
                return true;
              }
              // 递归检查子元素
              if (node.props.children) {
                return findCheckbox(node.props.children);
              }
            }
            
            return false;
          };
          
          // 尝试找到 checkbox
          findCheckbox(children);
          
          // 提取任务内容（排除 checkbox）
          const extractContent = (node: any): React.ReactNode[] => {
            if (!node) return [];
            
            // 字符串节点
            if (typeof node === 'string') {
              return [node];
            }
            
            // 数组节点
            if (Array.isArray(node)) {
              return node.flatMap(extractContent);
            }
            
            // React 元素节点
            if (typeof node === 'object' && node.type) {
              // 跳过 checkbox input
              if (node.type === 'input' && node.props?.type === 'checkbox') {
                return [];
              }
              
              // 保留其他元素
              return [node];
            }
            
            return [node];
          };
          
          // 提取任务内容
          taskContent = extractContent(children);
          
          // 如果是任务列表项，使用 ChecklistItem 组件
          if (hasCheckbox) {
            return (
              <li style={{ margin: '0', lineHeight: '1.4', listStyle: 'none', paddingLeft: '0' }} {...props}>
                <ChecklistItem checked={isChecked} isDarkMode={isDarkMode}>
                  {taskContent}
                </ChecklistItem>
              </li>
            );
          }
          
          // 普通列表项
          return <li style={{ margin: '0', lineHeight: '1.4' }} {...props}>{children}</li>;
        },
        strong: ({ children }) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
        em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
        h1: ({ children }) => <h1 style={{ fontSize: '1.5em', margin: '8px 0 2px 0', fontWeight: 'bold' }}>{children}</h1>,
        h2: ({ children }) => <h2 style={{ fontSize: '1.3em', margin: '6px 0 1px 0', fontWeight: 'bold' }}>{children}</h2>,
        h3: ({ children }) => <h3 style={{ fontSize: '1.1em', margin: '4px 0 0px 0', fontWeight: 'bold' }}>{children}</h3>,
        blockquote: ({ children, ...props }: any) => {
          // 尝试解析警告框
          const alertInfo = parseAlertBlock(children);
          
          if (alertInfo) {
            // 渲染为警告框
            const alertStyles = getAlertStyles(alertInfo.type);
            
            // 提取标题和内容部分
            const childrenArray = React.Children.toArray(children);
            let titleNode: React.ReactNode = null;
            let contentNodes: React.ReactNode[] = [];
            let foundTitle = false;
            
            // 查找标题（第一个段落，包含 [!TYPE] 标记）
            React.Children.forEach(children, (child: any) => {
              if (child?.type === 'p') {
                const text = extractTextContent(child);
                if (text.match(/\[!(\w+)\]/) && !foundTitle) {
                  // 这是标题段落，提取标题文本（移除 [!TYPE] 标记）
                  const titleText = text.replace(/\[!\w+\]\s*/, '').trim() || alertInfo.title;
                  titleNode = titleText;
                  foundTitle = true;
                } else {
                  contentNodes.push(child);
                }
              } else {
                contentNodes.push(child);
              }
            });
            
            // 如果没找到标题节点，使用解析的标题
            if (!titleNode) {
              titleNode = alertInfo.title;
            }
            
            return (
              <div style={alertStyles}>
                {getAlertIcon(alertInfo.type)}
                <div style={{ flex: 1 }}>
                  {titleNode && (
                    <div style={{ 
                      fontWeight: '600', 
                      marginBottom: contentNodes.length > 0 ? '4px' : '0',
                      fontSize: '15px'
                    }}>
                      {titleNode}
                    </div>
                  )}
                  {contentNodes.length > 0 && (
                    <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                      {contentNodes}
                    </div>
                  )}
                </div>
              </div>
            );
          }
          
          // 普通引用块
          return (
            <blockquote style={{ 
              borderLeft: `4px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`, 
              paddingLeft: '16px', 
              margin: '0',
              fontStyle: 'italic',
              color: isDarkMode ? '#9ca3af' : '#6b7280'
            }} {...props}>
              {children}
            </blockquote>
          );
        },
        table: ({ children }) => (
          <table style={{ 
            borderCollapse: 'collapse', 
            width: '100%', 
            margin: '0',
            border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`
          }}>
            {children}
          </table>
        ),
        th: ({ children }) => (
          <th style={{ 
            border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`, 
            padding: '8px', 
            backgroundColor: isDarkMode ? '#2d3748' : '#f6f8fa',
            fontWeight: 'bold'
          }}>
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td style={{ 
            border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`, 
            padding: '8px' 
          }}>
            {children}
          </td>
        ),
        a: ({ href, children }) => (
          <a 
            href={href} 
            style={{ 
              color: '#0366d6', 
              textDecoration: 'underline' 
            }}
            target="_blank" 
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        hr: () => (
          <hr style={{ 
            border: 'none', 
            borderTop: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`, 
            margin: '0' 
          }} />
        ),
        img: ({ src, alt, ...props }: any) => (
          <ImageViewer
            src={src || ''}
            alt={alt || ''}
            isDarkMode={isDarkMode}
          />
        )
      }}
    >
      {displayedText}
    </ReactMarkdown>
    );
  };

  return (
    <div className={className} style={style}>
      <style>
        {`
          .markdown-content li p {
            margin: 0 !important;
          }
          .markdown-content li ul,
          .markdown-content li ol {
            margin: 0 !important;
          }
          /* KaTeX 数学公式样式优化 */
          .markdown-content .katex {
            font-size: 1.1em;
          }
          .markdown-content .katex-display {
            margin: 16px 0;
            overflow-x: auto;
            overflow-y: hidden;
          }
          /* 深色模式下调整 KaTeX 颜色 */
          ${isDarkMode ? `
            .markdown-content .katex {
              color: #f9fafb;
            }
            .markdown-content .katex .base {
              color: #f9fafb;
            }
          ` : ''}
          /* 代码块工具栏样式 */
          .code-block-wrapper {
            position: relative;
          }
          .code-block-wrapper .code-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .code-block-wrapper .code-toolbar .code-language-label {
            display: inline-block;
          }
          .code-block-wrapper .code-toolbar .code-copy-button {
            display: flex;
            align-items: center;
            justify-content: center;
          }
        `}
      </style>
      <div className="markdown-content">
        {renderMarkdown(displayedText)}
      </div>
    </div>
  );
};

export default TypewriterEffect;
