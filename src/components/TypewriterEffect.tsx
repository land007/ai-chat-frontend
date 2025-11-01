import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { TypewriterEffectProps } from '@/types';
import 'highlight.js/styles/github.css';

// 动态导入mermaid，避免SSR问题
let mermaid: any = null;
if (typeof window !== 'undefined') {
  // @ts-ignore - mermaid类型声明在安装后会自动识别
  import('mermaid').then((mod) => {
    mermaid = mod.default;
    // 初始化mermaid配置
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    });
  }).catch((err) => {
    console.warn('[Mermaid] 模块加载失败，Mermaid图表功能将不可用:', err);
  });
}

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
  const targetTextRef = useRef('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // enabled=false：直接渲染完整内容（历史消息）
  // enabled=true：启动打字机（当前流式消息）
  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text);
      setCurrentIndex(text.length);
      return;
    }

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

  // Mermaid图表组件
  const MermaidChart: React.FC<{ code: string; isDarkMode: boolean }> = ({ code, isDarkMode }) => {
    const mermaidRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const lastCodeRef = useRef<string>('');

    useEffect(() => {
      if (!mermaid || !mermaidRef.current || !code.trim()) return;

      const trimmedCode = code.trim();
      
      // 如果代码没有变化，不重新渲染
      if (trimmedCode === lastCodeRef.current) return;
      
      // 更新最后处理的代码
      lastCodeRef.current = trimmedCode;
      
      // 检查是否是完整的Mermaid代码块（避免流式渲染时的中间状态）
      // 如果代码包含换行符，说明可能是完整的代码块
      if (trimmedCode && (trimmedCode.includes('\n') || trimmedCode.length > 10)) {
        const renderChart = async () => {
          try {
            // 生成唯一的图表ID
            const chartId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // 更新主题
            if (mermaid) {
              mermaid.initialize({
                startOnLoad: false,
                theme: isDarkMode ? 'dark' : 'default',
                securityLevel: 'loose',
              });
            }

            // 清理之前的内容
            if (mermaidRef.current) {
              mermaidRef.current.innerHTML = '';
            }

            // 渲染图表 - mermaid 10.x返回{svg: string}对象
            const result = await mermaid.render(chartId, trimmedCode);
            const svgContent = typeof result === 'string' ? result : result?.svg || '';
            
            if (mermaidRef.current && svgContent) {
              mermaidRef.current.innerHTML = svgContent;
              setError(null);
              console.log('[Mermaid] 图表渲染成功', chartId);
            } else {
              throw new Error('渲染结果为空');
            }
          } catch (err: any) {
            console.error('[Mermaid] 渲染失败:', err);
            setError(err.message || '渲染失败');
            if (mermaidRef.current) {
              mermaidRef.current.innerHTML = `<pre style="color: ${isDarkMode ? '#ef4444' : '#dc2626'}; padding: 8px; background-color: ${isDarkMode ? '#2d1f1f' : '#fee'}; border-radius: 4px;">Mermaid渲染错误: ${err.message || '未知错误'}</pre>`;
            }
          }
        };

        renderChart();
      }
    }, [code, isDarkMode]);

    return (
      <div
        ref={mermaidRef}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '16px 0',
          padding: '16px',
          backgroundColor: isDarkMode ? '#1e1e1e' : '#f8f9fa',
          borderRadius: '8px',
          overflow: 'auto',
          minHeight: '100px',
        }}
      />
    );
  };

  // 渲染Markdown内容
  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code: ({ className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          const isInline = !match;
          const codeString = String(children).replace(/\n$/, '');
          
          // 如果是Mermaid代码块，使用Mermaid组件渲染
          if (!isInline && language === 'mermaid') {
            return (
              <div style={{ margin: '16px 0' }}>
                <MermaidChart code={codeString} isDarkMode={isDarkMode} />
              </div>
            );
          }
          
          // 普通代码块
          return !isInline ? (
            <pre style={{ 
              backgroundColor: isDarkMode ? '#2d3748' : '#f6f8fa', 
              padding: '12px', 
              borderRadius: '6px', 
              overflow: 'auto',
              margin: '8px 0'
            }}>
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
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
        li: ({ children }) => <li style={{ margin: '0', lineHeight: '1.4' }}>{children}</li>,
        strong: ({ children }) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
        em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
        h1: ({ children }) => <h1 style={{ fontSize: '1.5em', margin: '8px 0 2px 0', fontWeight: 'bold' }}>{children}</h1>,
        h2: ({ children }) => <h2 style={{ fontSize: '1.3em', margin: '6px 0 1px 0', fontWeight: 'bold' }}>{children}</h2>,
        h3: ({ children }) => <h3 style={{ fontSize: '1.1em', margin: '4px 0 0px 0', fontWeight: 'bold' }}>{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote style={{ 
            borderLeft: `4px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`, 
            paddingLeft: '16px', 
            margin: '0',
            fontStyle: 'italic',
            color: isDarkMode ? '#9ca3af' : '#6b7280'
          }}>
            {children}
          </blockquote>
        ),
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
        )
      }}
    >
      {displayedText}
    </ReactMarkdown>
  );

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
        `}
      </style>
      <div className="markdown-content">
        {renderMarkdown(displayedText)}
      </div>
    </div>
  );
};

export default TypewriterEffect;
