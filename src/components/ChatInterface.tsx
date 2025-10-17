import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ChatMessage, chatAPI } from '../services/api';
import 'highlight.js/styles/github.css';

// 生成唯一ID的工具函数
const generateId = () => Math.random().toString(36).substr(2, 9);

interface ChatInterfaceProps {
  className?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ className = '' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appConfig, setAppConfig] = useState({
    name: 'AI智能助手',
    description: '基于阿里云DashScope的智能对话',
    welcomeMessage: ''
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 获取应用配置
  useEffect(() => {
    const fetchAppConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const config = await response.json();
          setAppConfig(config);
          // 动态设置页面标题
          document.title = config.name;
          
          // 如果有配置的欢迎语，添加为第一条消息
          if (config.welcomeMessage && config.welcomeMessage.trim()) {
            const welcomeMessage: ChatMessage = {
              id: generateId(),
              role: 'assistant',
              content: config.welcomeMessage,
              timestamp: Date.now()
            };
            setMessages([welcomeMessage]);
          }
        }
      } catch (error) {
        console.log('使用默认配置');
        // 设置默认标题
        document.title = 'AI智能助手';
      }
    };
    fetchAppConfig();
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatAPI.sendMessage(inputValue.trim());
      
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '抱歉，我暂时无法回复您的消息。请稍后重试。',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 重新提问功能
  const handleRegenerateMessage = async (messageId: string) => {
    if (isLoading) return;

    // 找到要重新提问的消息位置
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    // 找到对应的用户消息
    const userMessage = messages[messageIndex - 1];
    if (!userMessage || userMessage.role !== 'user') return;

    // 删除从该位置开始的所有后续消息
    const newMessages = messages.slice(0, messageIndex);
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await chatAPI.sendMessage(userMessage.content);
      
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '抱歉，我暂时无法回复您的消息。请稍后重试。',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100vh',
      backgroundColor: '#f9fafb',
      ...(className && {})
    },
    header: {
      backgroundColor: 'white',
      borderBottom: '1px solid #e5e7eb',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    headerIcon: {
      width: '40px',
      height: '40px',
      backgroundColor: '#3b82f6',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white'
    },
    headerTitle: {
      fontSize: '20px',
      fontWeight: '600',
      color: '#111827',
      margin: 0
    },
    headerSubtitle: {
      fontSize: '14px',
      color: '#6b7280',
      margin: 0
    },
    messagesArea: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: '16px 24px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '16px'
    },
    emptyState: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      textAlign: 'center' as const,
      color: '#6b7280'
    },
    emptyIcon: {
      width: '64px',
      height: '64px',
      color: '#d1d5db',
      marginBottom: '16px'
    },
    emptyTitle: {
      fontSize: '20px',
      fontWeight: '500',
      marginBottom: '8px',
      color: '#6b7280'
    },
    emptyDescription: {
      maxWidth: '448px',
      color: '#9ca3af'
    },
    messageContainer: {
      display: 'flex',
      justifyContent: 'flex-start' as const
    },
    messageContainerUser: {
      display: 'flex',
      justifyContent: 'flex-end' as const
    },
    messageContent: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      maxWidth: '768px'
    },
    messageContentUser: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      maxWidth: '768px',
      flexDirection: 'row-reverse' as const
    },
    avatar: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#e5e7eb',
      color: '#6b7280'
    },
    avatarUser: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    messageBubble: {
      padding: '12px 16px',
      borderRadius: '16px',
      backgroundColor: 'white',
      color: '#111827',
      border: '1px solid #e5e7eb',
      whiteSpace: 'pre-wrap' as const
    },
    messageBubbleUser: {
      padding: '12px 16px',
      borderRadius: '16px',
      backgroundColor: '#3b82f6',
      color: 'white',
      whiteSpace: 'pre-wrap' as const
    },
    messageTime: {
      fontSize: '12px',
      marginTop: '8px',
      color: '#9ca3af'
    },
    messageTimeUser: {
      fontSize: '12px',
      marginTop: '8px',
      color: '#bfdbfe'
    },
    loadingContainer: {
      display: 'flex',
      justifyContent: 'flex-start'
    },
    loadingContent: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px'
    },
    loadingBubble: {
      padding: '12px 16px',
      borderRadius: '16px',
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    loadingText: {
      color: '#6b7280'
    },
    regenerateButton: {
      background: 'none',
      border: 'none',
      padding: '4px',
      borderRadius: '4px',
      cursor: 'pointer',
      color: '#6b7280',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
      opacity: 0.7
    },
    regenerateButtonHover: {
      backgroundColor: '#f3f4f6',
      color: '#374151',
      opacity: 1
    },
    messageActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      marginTop: '4px'
    },
    inputArea: {
      backgroundColor: 'white',
      borderTop: '1px solid #e5e7eb',
      padding: '16px 24px'
    },
    inputContainer: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: '16px'
    },
    textarea: {
      flex: 1,
      padding: '12px 16px',
      border: '1px solid #d1d5db',
      borderRadius: '16px',
      resize: 'none' as const,
      outline: 'none',
      fontSize: '16px',
      fontFamily: 'inherit',
      minHeight: '48px',
      maxHeight: '120px'
    },
    textareaFocus: {
      borderColor: '#3b82f6',
      boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.1)'
    },
    sendButton: {
      width: '48px',
      height: '48px',
      backgroundColor: '#3b82f6',
      color: 'white',
      borderRadius: '16px',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'background-color 0.2s'
    },
    sendButtonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed'
    }
  };

  return (
    <div style={styles.container}>
      {/* 添加旋转动画样式 */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      
      {/* 头部 */}
      <div style={styles.header}>
        <div style={styles.headerIcon}>
          <Bot size={24} />
        </div>
        <div>
          <h1 style={styles.headerTitle}>{appConfig.name}</h1>
          <p style={styles.headerSubtitle}>{appConfig.description}</p>
        </div>
      </div>

      {/* 消息区域 */}
      <div style={styles.messagesArea}>
        {messages.length === 0 && !appConfig.welcomeMessage ? (
          <div style={styles.emptyState}>
            <Bot style={styles.emptyIcon} />
            <h2 style={styles.emptyTitle}>欢迎使用{appConfig.name}</h2>
            <p style={styles.emptyDescription}>
              我是您的AI助手，可以回答各种问题，帮助您解决问题。请在下方的输入框中输入您的问题。
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              style={message.role === 'user' ? styles.messageContainerUser : styles.messageContainer}
            >
              <div style={message.role === 'user' ? styles.messageContentUser : styles.messageContent}>
                <div style={message.role === 'user' ? styles.avatarUser : styles.avatar}>
                  {message.role === 'user' ? (
                    <User size={16} />
                  ) : (
                    <Bot size={16} />
                  )}
                </div>
                <div>
                  <div style={message.role === 'user' ? styles.messageBubbleUser : styles.messageBubble}>
                    {message.role === 'assistant' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          code: ({ className, children, ...props }: any) => {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !match;
                            return !isInline ? (
                              <pre style={{ 
                                backgroundColor: '#f6f8fa', 
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
                                backgroundColor: '#f1f3f4', 
                                padding: '2px 4px', 
                                borderRadius: '3px',
                                fontSize: '0.9em'
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
                              borderLeft: '4px solid #e1e4e8', 
                              paddingLeft: '16px', 
                              margin: '4px 0',
                              fontStyle: 'italic',
                              color: '#6a737d'
                            }}>
                              {children}
                            </blockquote>
                          ),
                          table: ({ children }) => (
                            <table style={{ 
                              borderCollapse: 'collapse', 
                              width: '100%', 
                              margin: '4px 0',
                              border: '1px solid #d0d7de'
                            }}>
                              {children}
                            </table>
                          ),
                          th: ({ children }) => (
                            <th style={{ 
                              border: '1px solid #d0d7de', 
                              padding: '8px', 
                              backgroundColor: '#f6f8fa',
                              fontWeight: 'bold'
                            }}>
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td style={{ 
                              border: '1px solid #d0d7de', 
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
                              borderTop: '1px solid #e1e4e8', 
                              margin: '8px 0' 
                            }} />
                          )
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      message.content
                    )}
                  </div>
                  <div style={message.role === 'user' ? styles.messageTimeUser : styles.messageTime}>
                    {message.timestamp && new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                  {message.role === 'assistant' && (
                    <div style={styles.messageActions}>
                      <button
                        style={styles.regenerateButton}
                        onClick={() => handleRegenerateMessage(message.id)}
                        onMouseEnter={(e) => {
                          Object.assign(e.currentTarget.style, styles.regenerateButtonHover);
                        }}
                        onMouseLeave={(e) => {
                          Object.assign(e.currentTarget.style, styles.regenerateButton);
                        }}
                        title="重新提问"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div style={styles.loadingContainer}>
            <div style={styles.loadingContent}>
              <div style={styles.avatar}>
                <Bot size={16} />
              </div>
              <div style={styles.loadingBubble}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={styles.loadingText}>AI正在思考...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div style={styles.inputArea}>
        <div style={styles.inputContainer}>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的问题..."
            style={{
              ...styles.textarea,
              ...(inputValue.trim() ? styles.textareaFocus : {})
            }}
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            style={{
              ...styles.sendButton,
              ...((!inputValue.trim() || isLoading) ? styles.sendButtonDisabled : {})
            }}
            onMouseEnter={(e) => {
              if (!(!inputValue.trim() || isLoading)) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
            onMouseLeave={(e) => {
              if (!(!inputValue.trim() || isLoading)) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }
            }}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;

