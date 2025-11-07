import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import hljs from 'highlight.js';
import { Info, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { TypewriterEffectProps, MapConfig } from '@/types';
import ImageViewer from './ImageViewer';
import AudioPlayer from './AudioPlayer';
import VideoPlayer from './VideoPlayer';
import DiffViewer from './DiffViewer';
import FileDownloader from './FileDownloader';
import ChecklistItem from './ChecklistItem';
import TreeViewer from './TreeViewer';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';

// 懒加载大型组件
const MermaidChart = lazy(() => import('./MermaidChart'));
const MapViewer = lazy(() => import('./MapViewer'));
const PDFViewer = lazy(() => import('./PDFViewer'));
const ChartRenderer = lazy(() => import('./ChartRenderer'));
const Model3DViewer = lazy(() => import('./Model3DViewer'));
const CodeBlockWrapper = lazy(() => import('./CodeBlockWrapper'));
const CodeBlockViewer = lazy(() => import('./CodeBlockViewer'));

// 加载占位符组件
const LoadingPlaceholder: React.FC<{ message?: string }> = ({ message = '加载中...' }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    gap: '12px',
    color: '#6b7280',
    fontSize: '14px'
  }}>
    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
    <span>{message}</span>
    <style>{`
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

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
  const [codeBlockContents, setCodeBlockContents] = useState<Map<string, string>>(new Map());
  const targetTextRef = useRef('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
    };
  }, []);

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
  
  // 处理代码块内容变化
  const handleCodeBlockContentChange = (blockId: string, newContent: string) => {
    setCodeBlockContents(prev => {
      const newMap = new Map(prev);
      newMap.set(blockId, newContent);
      return newMap;
    });
    console.log('[代码块编辑] 内容已更新', blockId);
  };
  
  // 获取代码块内容（优先使用映射中的内容）
  const getCodeBlockContent = (blockId: string, originalContent: string): string => {
    return codeBlockContents.get(blockId) || originalContent;
  };
  
  // 生成代码块唯一ID（基于内容哈希，确保相同内容有相同ID）
  const generateCodeBlockId = (codeString: string, language: string, index: number): string => {
    // 使用语言、索引和内容的前50个字符生成一个稳定的ID
    // 这样可以确保相同位置的代码块有相同的ID
    const hash = codeString.substring(0, 50).replace(/\s/g, '');
    return `code-block-${language}-${index}-${hash.length}-${hash.substring(0, 10)}`;
  };
  
  // 代码块索引计数器（用于在渲染时跟踪代码块位置）
  const codeBlockIndexRef = useRef(0);

  // 渲染Markdown内容
  const renderMarkdown = (content: string) => {
    // 重置代码块计数器（每次渲染 markdown 时重置）
    codeBlockIndexRef.current = 0;
    
    return (
    <ReactMarkdown
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
              return (
                <Suspense fallback={<LoadingPlaceholder message="加载代码块..." />}>
                  <CodeBlockViewer
                    codeContent={codeString}
                    language={language}
                    className={className || ''}
                    codeProps={props}
                    preStyle={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      margin: '0',
                      color: isDarkMode ? '#f1f5f9' : '#111827'
                    }}
                    codeStyle={{
                      color: isDarkMode ? '#f1f5f9' : '#111827',
                      backgroundColor: 'transparent'
                    }}
                    isDarkMode={isDarkMode}
                    codeComplete={false}
                  >
                    {children}
                  </CodeBlockViewer>
                </Suspense>
              );
            }
            
            // 生成代码块ID并获取内容
            const blockId = generateCodeBlockId(codeString, language, codeBlockIndexRef.current++);
            const actualContent = getCodeBlockContent(blockId, codeString);
            
            // 打字机完成且流式结束后，渲染图表
            return (
              <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                <CodeBlockWrapper
                  key={blockId}
                  language={language}
                  codeContent={actualContent}
                  renderView={
                    <Suspense fallback={<LoadingPlaceholder message="加载Mermaid图表..." />}>
                      <MermaidChart code={actualContent} isDarkMode={isDarkMode} />
                    </Suspense>
                  }
                  isDarkMode={isDarkMode}
                  showViewToggle={true}
                  onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
                />
              </Suspense>
            );
          }
          
          // 如果是Map代码块，使用MapViewer组件渲染
          if (!isInline && language === 'map') {
            // 只有在打字机完成且流式结束后才渲染地图，否则显示普通代码块
            if (isStreaming || !isTypingComplete) {
              return (
                <Suspense fallback={<LoadingPlaceholder message="加载代码块..." />}>
                  <CodeBlockViewer
                    codeContent={codeString}
                    language={language}
                    className={className || ''}
                    codeProps={props}
                    preStyle={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      margin: '0',
                      color: isDarkMode ? '#f1f5f9' : '#111827'
                    }}
                    codeStyle={{
                      color: isDarkMode ? '#f1f5f9' : '#111827',
                      backgroundColor: 'transparent'
                    }}
                    isDarkMode={isDarkMode}
                    codeComplete={false}
                  >
                    {children}
                  </CodeBlockViewer>
                </Suspense>
              );
            }
            
            // 生成代码块ID并获取内容
            const blockId = generateCodeBlockId(codeString, language, codeBlockIndexRef.current++);
            const actualContent = getCodeBlockContent(blockId, codeString);
            
            // 打字机完成且流式结束后，解析并渲染地图
            try {
              // 解析JSON格式的地图配置
              const mapConfig: MapConfig = JSON.parse(actualContent);
              return (
                <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                  <CodeBlockWrapper
                    key={blockId}
                    language={language}
                    codeContent={actualContent}
                    renderView={
                      <Suspense fallback={<LoadingPlaceholder message="加载地图..." />}>
                        <MapViewer config={mapConfig} isDarkMode={isDarkMode} />
                      </Suspense>
                    }
                    isDarkMode={isDarkMode}
                    showViewToggle={true}
                    onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
                  />
                </Suspense>
              );
            } catch (error) {
              // 解析失败时显示错误信息
              console.error('[地图] JSON解析失败:', error);
              return (
                <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                  <CodeBlockWrapper
                    key={blockId}
                    language={language}
                    codeContent={actualContent}
                    renderView={
                      <div style={{ 
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
                  onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
                />
                </Suspense>
              );
            }
          }
          
          // 如果是Audio代码块，使用AudioPlayer组件渲染
          if (!isInline && language === 'audio') {
            // 只有在打字机完成且流式结束后才渲染播放器，否则显示普通代码块（不触发下载）
            if (isStreaming || !isTypingComplete) {
              return (
                <Suspense fallback={<LoadingPlaceholder message="加载代码块..." />}>
                  <CodeBlockViewer
                    codeContent={codeString}
                    language={language}
                    className={className || ''}
                    codeProps={props}
                    preStyle={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      margin: '0',
                      color: isDarkMode ? '#f1f5f9' : '#111827'
                    }}
                    codeStyle={{
                      color: isDarkMode ? '#f1f5f9' : '#111827',
                      backgroundColor: 'transparent'
                    }}
                    isDarkMode={isDarkMode}
                    codeComplete={false}
                  >
                    {children}
                  </CodeBlockViewer>
                </Suspense>
              );
            }
            
            // 生成代码块ID并获取内容
            const blockId = generateCodeBlockId(codeString, language, codeBlockIndexRef.current++);
            const actualContent = getCodeBlockContent(blockId, codeString);
            
            // 打字机完成且流式结束后，渲染播放器
            return (
              <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                <CodeBlockWrapper
                  key={blockId}
                  language={language}
                  codeContent={actualContent}
                  renderView={
                    <AudioPlayer url={actualContent.trim()} isDarkMode={isDarkMode} />
                  }
                  isDarkMode={isDarkMode}
                  showViewToggle={true}
                  onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
                />
              </Suspense>
            );
          }
          
          // 如果是Video代码块，使用VideoPlayer组件渲染
          if (!isInline && language === 'video') {
            // 只有在打字机完成且流式结束后才渲染播放器，否则显示普通代码块（不触发下载）
            if (isStreaming || !isTypingComplete) {
              return (
                <Suspense fallback={<LoadingPlaceholder message="加载代码块..." />}>
                  <CodeBlockViewer
                    codeContent={codeString}
                    language={language}
                    className={className || ''}
                    codeProps={props}
                    preStyle={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      margin: '0',
                      color: isDarkMode ? '#f1f5f9' : '#111827'
                    }}
                    codeStyle={{
                      color: isDarkMode ? '#f1f5f9' : '#111827',
                      backgroundColor: 'transparent'
                    }}
                    isDarkMode={isDarkMode}
                    codeComplete={false}
                  >
                    {children}
                  </CodeBlockViewer>
                </Suspense>
              );
            }
            
            // 生成代码块ID并获取内容
            const blockId = generateCodeBlockId(codeString, language, codeBlockIndexRef.current++);
            const actualContent = getCodeBlockContent(blockId, codeString);
            
            // 打字机完成且流式结束后，渲染播放器
            return (
              <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                <CodeBlockWrapper
                  key={blockId}
                  language={language}
                  codeContent={actualContent}
                  renderView={
                    <VideoPlayer url={actualContent.trim()} isDarkMode={isDarkMode} />
                  }
                  isDarkMode={isDarkMode}
                  showViewToggle={true}
                  onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
                />
              </Suspense>
            );
          }

          // 如果是File代码块，使用文件下载组件渲染
          if (!isInline && language === 'file') {
            // 只有在打字机完成且流式结束后才渲染下载链接，否则显示普通代码块（不触发下载）
            if (isStreaming || !isTypingComplete) {
              return (
                <Suspense fallback={<LoadingPlaceholder message="加载代码块..." />}>
                  <CodeBlockViewer
                    codeContent={codeString}
                    language={language}
                    className={className || ''}
                    codeProps={props}
                    preStyle={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      margin: '0',
                      color: isDarkMode ? '#f1f5f9' : '#111827'
                    }}
                    codeStyle={{
                      color: isDarkMode ? '#f1f5f9' : '#111827',
                      backgroundColor: 'transparent'
                    }}
                    isDarkMode={isDarkMode}
                    codeComplete={false}
                  >
                    {children}
                  </CodeBlockViewer>
                </Suspense>
              );
            }
            
            // 解析文件信息
            const fileInfo = parseFileInfo(codeString);
            if (!fileInfo) {
              return (
                <Suspense fallback={<LoadingPlaceholder message="加载代码块..." />}>
                  <CodeBlockViewer
                    codeContent={codeString}
                    language={language}
                    className={className || ''}
                    codeProps={props}
                    preStyle={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      margin: '0',
                      color: isDarkMode ? '#f1f5f9' : '#111827'
                    }}
                    codeStyle={{
                      color: isDarkMode ? '#f1f5f9' : '#111827',
                      backgroundColor: 'transparent'
                    }}
                    isDarkMode={isDarkMode}
                    codeComplete={true}
                  >
                    {children}
                  </CodeBlockViewer>
                </Suspense>
              );
            }
            
            // 生成代码块ID并获取内容
            const blockId = generateCodeBlockId(codeString, language, codeBlockIndexRef.current++);
            const actualContent = getCodeBlockContent(blockId, codeString);
            const updatedFileInfo = parseFileInfo(actualContent);
            
            // 打字机完成且流式结束后，渲染下载链接
            return (
              <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                <CodeBlockWrapper
                  key={blockId}
                  language={language}
                  codeContent={actualContent}
                  renderView={
                    updatedFileInfo ? (
                      <FileDownloader
                        url={updatedFileInfo.url}
                        fileName={updatedFileInfo.fileName}
                        isDarkMode={isDarkMode}
                      />
                    ) : (
                    <div style={{ 
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
                        文件格式解析失败，请检查格式是否正确
                      </p>
                    </div>
                  )
                }
                isDarkMode={isDarkMode}
                showViewToggle={true}
                onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
              />
              </Suspense>
            );
          }

          // 如果是Diff代码块，使用DiffViewer组件渲染
          if (!isInline && language === 'diff') {
            const blockId = generateCodeBlockId(codeString, language, codeBlockIndexRef.current++);
            const actualContent = getCodeBlockContent(blockId, codeString);
            return (
              <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                <CodeBlockWrapper
                  key={blockId}
                  language={language}
                  codeContent={actualContent}
                  renderView={
                    <DiffViewer code={actualContent} isDarkMode={isDarkMode} />
                  }
                  isDarkMode={isDarkMode}
                  showViewToggle={true}
                  onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
                />
              </Suspense>
            );
          }

          // 如果是Merge代码块（合并冲突），使用DiffViewer组件渲染
          if (!isInline && language === 'merge') {
            const blockId = generateCodeBlockId(codeString, language, codeBlockIndexRef.current++);
            const actualContent = getCodeBlockContent(blockId, codeString);
            return (
              <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                <CodeBlockWrapper
                  key={blockId}
                  language={language}
                  codeContent={actualContent}
                  renderView={
                    <DiffViewer code={actualContent} isDarkMode={isDarkMode} />
                  }
                  isDarkMode={isDarkMode}
                  showViewToggle={true}
                  onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
                />
              </Suspense>
            );
          }

          // 如果是Tree代码块，使用TreeViewer组件渲染
          if (!isInline && language === 'tree') {
            const blockId = generateCodeBlockId(codeString, language, codeBlockIndexRef.current++);
            const actualContent = getCodeBlockContent(blockId, codeString);
            return (
              <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                <CodeBlockWrapper
                  key={blockId}
                  language={language}
                  codeContent={actualContent}
                  renderView={
                    <TreeViewer code={actualContent} isDarkMode={isDarkMode} />
                  }
                  isDarkMode={isDarkMode}
                  showViewToggle={true}
                  onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
                />
              </Suspense>
            );
          }

          // 如果是图表代码块，使用 ChartRenderer 渲染
          if (!isInline && language === 'chart') {
            if (isStreaming || !isTypingComplete) {
              return (
                <Suspense fallback={<LoadingPlaceholder message="加载代码块..." />}>
                  <CodeBlockViewer
                    codeContent={codeString}
                    language={language}
                    className={className || ''}
                    codeProps={props}
                    preStyle={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      margin: '0',
                      color: isDarkMode ? '#f1f5f9' : '#111827'
                    }}
                    codeStyle={{
                      color: isDarkMode ? '#f1f5f9' : '#111827',
                      backgroundColor: 'transparent'
                    }}
                    isDarkMode={isDarkMode}
                    codeComplete={false}
                  >
                    {children}
                  </CodeBlockViewer>
                </Suspense>
              );
            }

            // 生成代码块ID并获取内容
            const blockId = generateCodeBlockId(codeString, language, codeBlockIndexRef.current++);
            const actualContent = getCodeBlockContent(blockId, codeString);
            
            return (
              <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                <CodeBlockWrapper
                  key={blockId}
                  language={language}
                  codeContent={actualContent}
                  renderView={
                    <Suspense fallback={<LoadingPlaceholder message="加载图表..." />}>
                      <ChartRenderer config={actualContent} isDarkMode={isDarkMode} />
                    </Suspense>
                  }
                  isDarkMode={isDarkMode}
                  showViewToggle={true}
                  onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
                />
              </Suspense>
            );
          }

          // 如果是PDF代码块，使用PDFViewer组件渲染
          if (!isInline && language === 'pdf') {
            // 只有在打字机完成且流式结束后才渲染PDF查看器，否则显示普通代码块（不触发加载）
            if (isStreaming || !isTypingComplete) {
              return (
                <Suspense fallback={<LoadingPlaceholder message="加载代码块..." />}>
                  <CodeBlockViewer
                    codeContent={codeString}
                    language={language}
                    className={className || ''}
                    codeProps={props}
                    preStyle={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      margin: '0',
                      color: isDarkMode ? '#f1f5f9' : '#111827'
                    }}
                    codeStyle={{
                      color: isDarkMode ? '#f1f5f9' : '#111827',
                      backgroundColor: 'transparent'
                    }}
                    isDarkMode={isDarkMode}
                    codeComplete={false}
                  >
                    {children}
                  </CodeBlockViewer>
                </Suspense>
              );
            }
            
            // 生成代码块ID并获取内容
            const blockId = generateCodeBlockId(codeString, language, codeBlockIndexRef.current++);
            const actualContent = getCodeBlockContent(blockId, codeString);
            
            // 解析PDF信息（类似 FileDownloader）
            const pdfUrl = actualContent.trim().split('\n')[0].trim();
            if (!pdfUrl || (!pdfUrl.startsWith('http://') && !pdfUrl.startsWith('https://'))) {
              return (
                <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                  <CodeBlockWrapper
                    key={blockId}
                    language={language}
                    codeContent={actualContent}
                    renderView={
                      <div style={{ 
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
                        PDF URL格式不正确，必须以 http:// 或 https:// 开头
                      </p>
                    </div>
                  }
                  isDarkMode={isDarkMode}
                  showViewToggle={true}
                  onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
                />
                </Suspense>
              );
            }
            
            // 打字机完成且流式结束后，渲染PDF查看器
            return (
              <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                <CodeBlockWrapper
                  key={blockId}
                  language={language}
                  codeContent={actualContent}
                  renderView={
                    <Suspense fallback={<LoadingPlaceholder message="加载PDF查看器..." />}>
                      <PDFViewer url={pdfUrl} isDarkMode={isDarkMode} />
                    </Suspense>
                  }
                  isDarkMode={isDarkMode}
                  showViewToggle={true}
                  onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
                />
              </Suspense>
            );
          }
          
          // 如果是3D模型代码块，使用Model3DViewer组件渲染
          if (!isInline && language === '3d') {
            // 只有在打字机完成且流式结束后才渲染模型，否则显示普通代码块（不触发加载）
            if (isStreaming || !isTypingComplete) {
              return (
                <Suspense fallback={<LoadingPlaceholder message="加载代码块..." />}>
                  <CodeBlockViewer
                    codeContent={codeString}
                    language={language}
                    className={className || ''}
                    codeProps={props}
                    preStyle={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                      padding: '12px',
                      borderRadius: '6px',
                      overflow: 'auto',
                      margin: '0',
                      color: isDarkMode ? '#f1f5f9' : '#111827'
                    }}
                    codeStyle={{
                      color: isDarkMode ? '#f1f5f9' : '#111827',
                      backgroundColor: 'transparent'
                    }}
                    isDarkMode={isDarkMode}
                    codeComplete={false}
                  >
                    {children}
                  </CodeBlockViewer>
                </Suspense>
              );
            }
            
            // 生成代码块ID并获取内容
            const blockId = generateCodeBlockId(codeString, language, codeBlockIndexRef.current++);
            const actualContent = getCodeBlockContent(blockId, codeString);
            
            // 解析3D模型URL
            const modelUrl = actualContent.trim().split('\n')[0].trim();
            if (!modelUrl || (!modelUrl.startsWith('http://') && !modelUrl.startsWith('https://'))) {
              return (
                <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                  <CodeBlockWrapper
                    key={blockId}
                    language={language}
                    codeContent={actualContent}
                    renderView={
                      <div style={{ 
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
                        3D模型URL格式不正确，必须以 http:// 或 https:// 开头
                      </p>
                    </div>
                  }
                  isDarkMode={isDarkMode}
                  showViewToggle={true}
                  onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
                />
                </Suspense>
              );
            }
            
            // 打字机完成且流式结束后，渲染3D模型
            return (
              <Suspense fallback={<LoadingPlaceholder message="加载代码块包装器..." />}>
                <CodeBlockWrapper
                  key={blockId}
                  language={language}
                  codeContent={actualContent}
                  renderView={
                    <Suspense fallback={<LoadingPlaceholder message="加载3D模型..." />}>
                      <Model3DViewer url={modelUrl} isDarkMode={isDarkMode} />
                    </Suspense>
                  }
                  isDarkMode={isDarkMode}
                  showViewToggle={true}
                  onContentChange={(newContent) => handleCodeBlockContentChange(blockId, newContent)}
                />
              </Suspense>
            );
          }
          
          // 普通代码块
          return !isInline ? (
            <Suspense fallback={<LoadingPlaceholder message="加载代码块..." />}>
              <CodeBlockViewer
                codeContent={codeString}
                language={language || undefined}
                className={className || ''}
                codeProps={props}
                preStyle={{
                  backgroundColor: isDarkMode ? '#1e293b' : '#f6f8fa',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  margin: '0',
                  color: isDarkMode ? '#f1f5f9' : '#111827'
                }}
                codeStyle={{
                  color: isDarkMode ? '#f1f5f9' : '#111827',
                  backgroundColor: 'transparent'
                }}
                isDarkMode={isDarkMode}
                codeComplete={!isStreaming && isTypingComplete}
              >
                {children}
              </CodeBlockViewer>
            </Suspense>
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
