import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

interface TypewriterEffectProps {
  text: string;
  speed?: number; // 打字速度（毫秒）
  onProgress?: (progress: number) => void; // 打字机进度回调
  onParagraphComplete?: (paragraph: string, index: number) => void; // 段落完成回调
  className?: string;
  isDarkMode?: boolean; // 暗色模式
}

const TypewriterEffect: React.FC<TypewriterEffectProps> = ({
  text,
  speed = 50,
  onProgress,
  onParagraphComplete,
  className = '',
  isDarkMode = false
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const paragraphsRef = useRef<string[]>([]);
  const currentParagraphIndexRef = useRef(0);

  // 分割文本为段落
  const splitIntoParagraphs = useCallback((text: string): string[] => {
    const paragraphs = text
      .split(/\n\s*\n/) // 按双换行符分割
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    // 如果段落太长，进一步分割
    const result: string[] = [];
    paragraphs.forEach(paragraph => {
      if (paragraph.length > 200) {
        // 长段落按句子分割
        const sentences = paragraph.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
        sentences.forEach(sentence => {
          if (sentence.trim().length > 0) {
            result.push(sentence.trim());
          }
        });
      } else {
        result.push(paragraph);
      }
    });
    
    return result;
  }, []);

  // 开始打字机效果
  const startTyping = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    paragraphsRef.current = splitIntoParagraphs(text);
    currentParagraphIndexRef.current = 0;
    setCurrentIndex(0);
    setDisplayedText('');
    setIsTyping(true);

    intervalRef.current = setInterval(() => {
      setCurrentIndex(prevIndex => {
        const newIndex = prevIndex + 1;
        
        // 更新显示文本
        setDisplayedText(text.slice(0, newIndex));
        
        // 计算进度
        const progress = newIndex / text.length;
        onProgress?.(progress);
        
        // 检查是否完成当前段落
        const currentText = text.slice(0, newIndex);
        const currentParagraph = paragraphsRef.current[currentParagraphIndexRef.current];
        
        if (currentParagraph && currentText.includes(currentParagraph)) {
          // 段落完成
          onParagraphComplete?.(currentParagraph, currentParagraphIndexRef.current);
          currentParagraphIndexRef.current++;
        }
        
        // 检查是否完成所有文本
        if (newIndex >= text.length) {
          setIsTyping(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
        
        return newIndex;
      });
    }, speed);
  }, [text, speed, onProgress, onParagraphComplete]);

  // 停止打字机效果
  const stopTyping = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTyping(false);
  }, []);

  // 重置打字机效果
  const resetTyping = useCallback(() => {
    stopTyping();
    setCurrentIndex(0);
    setDisplayedText('');
    currentParagraphIndexRef.current = 0;
  }, [stopTyping]);

  // 当text变化时重新开始打字
  useEffect(() => {
    startTyping();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text]); // 只在text变化时重新开始

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className={className}>
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
        {displayedText + (isTyping ? '|' : '')}
      </ReactMarkdown>
    </div>
  );
};

export default TypewriterEffect;
