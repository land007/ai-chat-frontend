import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { TypewriterEffectProps } from '@/types';
import 'highlight.js/styles/github.css';

const TypewriterEffect: React.FC<TypewriterEffectProps> = ({
  text,
  speed = 30,
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
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 重置状态当文本改变时
  useEffect(() => {
    if (!enabled || isStreaming) {
      // 如果禁用打字机效果或正在流式传输，直接显示完整文本
      setDisplayedText(text);
      setCurrentIndex(text.length);
      setIsTyping(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    setDisplayedText('');
    setCurrentIndex(0);
    setIsTyping(true);

    // 清除之前的定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // 开始打字效果
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prevIndex => {
        if (prevIndex >= text.length) {
          setIsTyping(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          onComplete?.();
          return prevIndex;
        }
        return prevIndex + 1;
      });
    }, speed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text, speed, enabled, isStreaming, onComplete]);

  // 更新显示的文本
  useEffect(() => {
    if (enabled && !isStreaming) {
      setDisplayedText(text.slice(0, currentIndex));
    }
  }, [currentIndex, text, enabled, isStreaming]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // 渲染Markdown内容
  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code: ({ className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match;
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
        p: ({ children }) => <p style={{ margin: '4px 0', lineHeight: '1.5' }}>{children}</p>,
        ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</ol>,
        li: ({ children }) => <li style={{ margin: '2px 0', lineHeight: '1.4' }}>{children}</li>,
        strong: ({ children }) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
        em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
        h1: ({ children }) => <h1 style={{ fontSize: '1.5em', margin: '8px 0 4px 0', fontWeight: 'bold' }}>{children}</h1>,
        h2: ({ children }) => <h2 style={{ fontSize: '1.3em', margin: '6px 0 3px 0', fontWeight: 'bold' }}>{children}</h2>,
        h3: ({ children }) => <h3 style={{ fontSize: '1.1em', margin: '4px 0 2px 0', fontWeight: 'bold' }}>{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote style={{ 
            borderLeft: `4px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`, 
            paddingLeft: '16px', 
            margin: '4px 0',
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
            margin: '4px 0',
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
            margin: '8px 0' 
          }} />
        )
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className={className} style={style}>
      {renderMarkdown(displayedText)}
      {(isTyping || isStreaming) && !isThinking && (
        <span 
          style={{ 
            animation: 'blink 1s infinite',
            marginLeft: '2px',
            color: isDarkMode ? '#9ca3af' : '#6b7280'
          }}
        >
          |
        </span>
      )}
      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
      </style>
    </div>
  );
};

export default TypewriterEffect;