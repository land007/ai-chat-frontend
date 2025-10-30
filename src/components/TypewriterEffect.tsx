import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { TypewriterEffectProps } from '@/types';
import 'highlight.js/styles/github.css';

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
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasStreamedRef = useRef(false); // 跟踪是否已经进行过流式传输
  const targetTextRef = useRef(''); // 存储目标文本（流式接收的完整内容）
  const timerRunningRef = useRef(false); // 定时器运行标志
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null); // 超时保护定时器
  const startTimeRef = useRef<number>(0); // 记录开始时间

  // 统一的定时器清理函数
  const stopTypingTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    timerRunningRef.current = false;
  };

  // 清理超时保护定时器
  const stopTimeoutTimer = () => {
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  };

  // 启动超时保护（30秒强制完成）
  const startTimeoutProtection = () => {
    stopTimeoutTimer();
    timeoutTimerRef.current = setTimeout(() => {
      console.warn('[打字机] 超时保护：30秒内未完成，强制显示完整内容');
      stopTypingTimer();
      if (targetTextRef.current) {
        setDisplayedText(targetTextRef.current);
        setCurrentIndex(targetTextRef.current.length);
      }
      setIsTyping(false);
      onComplete?.();
    }, 30000);
  };

  // 重置状态当文本改变时
  useEffect(() => {
    if (!enabled) {
      // 如果禁用打字机效果，直接显示完整文本
      setDisplayedText(text);
      setCurrentIndex(text.length);
      setIsTyping(false);
      stopTypingTimer();
      stopTimeoutTimer();
      return;
    }

    if (isStreaming) {
      try {
        // 流式传输时：更新目标文本，启动逐字渲染
        const prevLength = targetTextRef.current.length;
        targetTextRef.current = text;
        const newLength = targetTextRef.current.length;
        
        // 边界检查
        if (!targetTextRef.current || newLength < 0) {
          console.error('[打字机] 无效的目标文本');
          return;
        }
        
        // 只在文本有显著变化时打印日志（避免刷屏）
        if (newLength > prevLength && (newLength - prevLength > 50 || newLength % 100 === 0)) {
          console.log(`[打字机-流式] 目标文本更新: ${prevLength} -> ${newLength} 字符`);
        }
        
        setIsTyping(true);
        hasStreamedRef.current = true; // 标记已经进行过流式传输
        
        // 启动逐字渲染定时器（确保定时器唯一性）
        if (!timerRunningRef.current) {
          stopTypingTimer(); // 强制清理旧定时器（防御性）
          console.log('[打字机-流式] 启动逐字渲染定时器');
          timerRunningRef.current = true;
          startTimeRef.current = Date.now();
          startTimeoutProtection(); // 启动超时保护
          
          intervalRef.current = setInterval(() => {
            try {
              setCurrentIndex(prevIndex => {
                // 边界检查
                if (!targetTextRef.current) {
                  return prevIndex;
                }
                const targetLength = targetTextRef.current.length;
                if (prevIndex >= targetLength) {
                  return prevIndex; // 已完全显示
                }
                return prevIndex + 1; // 每次增加1个字符
              });
            } catch (error) {
              console.error('[打字机] 定时器执行错误:', error);
              // 异常恢复：直接显示完整内容
              if (targetTextRef.current) {
                setDisplayedText(targetTextRef.current);
                setCurrentIndex(targetTextRef.current.length);
              }
              stopTypingTimer();
            }
          }, speed);
        }
      } catch (error) {
        console.error('[打字机] 流式传输处理错误:', error);
        // 异常恢复
        if (targetTextRef.current) {
          setDisplayedText(targetTextRef.current);
          setCurrentIndex(targetTextRef.current.length);
        }
      }
      return;
    }

    // 非流式传输时：如果已经进行过流式传输，则不重新开始打字机
    if (hasStreamedRef.current) {
      // 保持当前显示的内容，不重新开始打字机
      return;
    }

    // 只有从未进行过流式传输的新消息才使用打字机效果
    try {
      setDisplayedText('');
      setCurrentIndex(0);
      setIsTyping(true);

      // 清除之前的定时器
      stopTypingTimer();
      stopTimeoutTimer();

      // 启动超时保护
      startTimeoutProtection();
      startTimeRef.current = Date.now();

      // 开始打字效果
      timerRunningRef.current = true;
      intervalRef.current = setInterval(() => {
        try {
          setCurrentIndex(prevIndex => {
            // 边界检查
            if (!text || prevIndex >= text.length) {
              setIsTyping(false);
              stopTypingTimer();
              stopTimeoutTimer();
              onComplete?.();
              return prevIndex;
            }
            return prevIndex + 1;
          });
        } catch (error) {
          console.error('[打字机] 非流式定时器执行错误:', error);
          stopTypingTimer();
          stopTimeoutTimer();
        }
      }, speed);
    } catch (error) {
      console.error('[打字机] 非流式传输处理错误:', error);
      // 异常恢复：直接显示完整文本
      setDisplayedText(text);
      setCurrentIndex(text.length);
    }

    return () => {
      stopTypingTimer();
      stopTimeoutTimer();
    };
  }, [text, speed, enabled, isStreaming, onComplete]);

  // 更新显示的文本
  useEffect(() => {
    if (enabled) {
      try {
        if (isStreaming) {
          // 流式传输时：根据currentIndex逐字符显示
          // 边界检查
          if (targetTextRef.current && currentIndex >= 0) {
            const displayText = targetTextRef.current.slice(0, currentIndex);
            setDisplayedText(displayText);
            // 每100个字符打印一次日志，避免刷屏
            if (currentIndex % 100 === 0 || currentIndex === targetTextRef.current.length) {
              console.log(`[打字机-流式] 当前显示: ${currentIndex}/${targetTextRef.current.length} 字符`);
            }
          }
        } else {
          // 非流式传输时：逐字符显示
          // 边界检查
          if (text && currentIndex >= 0) {
            setDisplayedText(text.slice(0, currentIndex));
          }
        }
      } catch (error) {
        console.error('[打字机] 更新显示文本错误:', error);
        // 异常恢复：显示完整内容
        setDisplayedText(isStreaming ? (targetTextRef.current || '') : text);
      }
    }
  }, [currentIndex, text, enabled, isStreaming]);
  
  // 流式传输结束时，确保显示完整内容
  useEffect(() => {
    if (!isStreaming && hasStreamedRef.current) {
      try {
        // 边界检查
        if (!targetTextRef.current) {
          console.error('[打字机] 流式结束但目标文本为空');
          setIsTyping(false);
          stopTimeoutTimer();
          return;
        }

        const targetLength = targetTextRef.current.length;
        console.log(`[打字机] 流式传输结束，检查显示完整性: ${currentIndex}/${targetLength}`);
        
        // 如果还有未显示的内容，继续显示
        if (currentIndex < targetLength && currentIndex >= 0) {
          const remainingChars = targetLength - currentIndex;
          console.log(`[打字机] 继续显示剩余内容: ${remainingChars} 字符`);
          
          // 继续使用现有的定时器（如果存在），否则创建新的
          if (!intervalRef.current) {
            timerRunningRef.current = true;
            intervalRef.current = setInterval(() => {
              try {
                setCurrentIndex(prevIndex => {
                  if (!targetTextRef.current) {
                    return prevIndex;
                  }
                  const len = targetTextRef.current.length;
                  if (prevIndex >= len) {
                    stopTypingTimer();
                    stopTimeoutTimer();
                    setIsTyping(false);
                    onComplete?.();
                    console.log('[打字机] 全部内容显示完成');
                    return prevIndex;
                  }
                  return prevIndex + 1;
                });
              } catch (error) {
                console.error('[打字机] 补充分显示定时器错误:', error);
                stopTypingTimer();
                stopTimeoutTimer();
              }
            }, speed);
          }
        } else {
          // 已经全部显示，清理定时器
          stopTypingTimer();
          stopTimeoutTimer();
          setIsTyping(false);
          onComplete?.();
          console.log('[打字机] 显示完成，清理定时器');
        }
      } catch (error) {
        console.error('[打字机] 流式结束处理错误:', error);
        // 异常恢复：直接显示完整内容
        if (targetTextRef.current) {
          setDisplayedText(targetTextRef.current);
          setCurrentIndex(targetTextRef.current.length);
        }
        stopTypingTimer();
        stopTimeoutTimer();
        setIsTyping(false);
      }
    }
  }, [isStreaming, speed, onComplete]); // 移除 currentIndex 依赖

  // 组件卸载时清理所有定时器
  useEffect(() => {
    return () => {
      stopTypingTimer();
      stopTimeoutTimer();
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
      {content}
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