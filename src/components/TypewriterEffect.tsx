import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

interface TypewriterEffectProps {
  text: string;
  speed?: number; // 保留接口兼容性，但不再使用
  onParagraphComplete?: (paragraph: string, index: number) => void; // 段落完成回调
  className?: string;
  isDarkMode?: boolean; // 暗色模式
  currentPlayingParagraph?: string; // 当前正在播放的段落
}

const TypewriterEffect: React.FC<TypewriterEffectProps> = ({
  text,
  speed = 50, // 保留参数但不使用
  onParagraphComplete,
  className = '',
  isDarkMode = false,
  currentPlayingParagraph
}) => {
  // 直接显示接收到的文本，不添加任何打字效果

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode; className?: string }) => {
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
          p: ({ children }) => {
            const paragraphText = typeof children === 'string' ? children : '';
            const isPlaying = currentPlayingParagraph && paragraphText.includes(currentPlayingParagraph);
            return (
              <p style={{ 
                margin: '4px 0', 
                lineHeight: '1.5',
                backgroundColor: isPlaying ? (isDarkMode ? '#2d3748' : '#f0f8ff') : 'transparent',
                border: isPlaying ? `2px solid ${isDarkMode ? '#3b82f6' : '#3b82f6'}` : 'none',
                borderRadius: isPlaying ? '4px' : '0',
                padding: isPlaying ? '8px' : '0',
                transition: 'all 0.3s ease'
              }}>
                {children}
              </p>
            );
          },
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
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default TypewriterEffect;
