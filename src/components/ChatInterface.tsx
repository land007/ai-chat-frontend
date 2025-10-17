import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, RotateCcw, Edit3, Check, X, Trash2, Copy, ThumbsUp, ThumbsDown, Sun, Moon, RefreshCw } from 'lucide-react';
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
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
      const response = await chatAPI.sendMessage(inputValue.trim(), messages);
      
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

  // 进入编辑模式
  const handleEditMessage = (messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const userMessage = messages[messageIndex - 1];
    if (!userMessage || userMessage.role !== 'user') return;

    setEditingMessageId(messageId);
    setEditValue(userMessage.content);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditValue('');
  };

  // 确认编辑并重新提问
  const handleConfirmEdit = async () => {
    if (!editingMessageId || !editValue.trim() || isLoading) return;

    const messageIndex = messages.findIndex(msg => msg.id === editingMessageId);
    if (messageIndex === -1) return;

    // 找到对应的用户消息并更新其内容
    const userMessageIndex = messageIndex - 1;
    const updatedUserMessage: ChatMessage = {
      ...messages[userMessageIndex],
      content: editValue.trim(),
      timestamp: Date.now()
    };

    // 删除从该位置开始的所有后续消息，但保留更新后的用户消息
    const newMessages = messages.slice(0, userMessageIndex);
    newMessages.push(updatedUserMessage);
    setMessages(newMessages);
    setIsLoading(true);
    setEditingMessageId(null);

    try {
      const response = await chatAPI.sendMessage(editValue.trim(), newMessages);
      
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
      setEditValue('');
    }
  };

  // 直接重新生成（不修改问题）
  const handleRegenerateMessage = async (messageId: string) => {
    if (isLoading) return;

    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const userMessage = messages[messageIndex - 1];
    if (!userMessage || userMessage.role !== 'user') return;

    // 删除从该位置开始的所有后续消息
    const newMessages = messages.slice(0, messageIndex);
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await chatAPI.sendMessage(userMessage.content, newMessages);
      
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

  // 清空对话
  const handleClearChat = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    setMessages([]);
    setShowClearConfirm(false);
    setEditingMessageId(null);
    setEditValue('');
  };

  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };

  // 复制消息
  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // 可以添加一个toast提示
      console.log('消息已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  // 消息反馈
  const handleMessageFeedback = (messageId: string, feedback: 'like' | 'dislike') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, feedback: msg.feedback === feedback ? null : feedback }
        : msg
    ));
  };

  // 重试消息
  const handleRetryMessage = async (messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const userMessage = messages[messageIndex - 1];
    if (!userMessage || userMessage.role !== 'user') return;

    // 增加重试次数
    const retryCount = (messages[messageIndex].retryCount || 0) + 1;
    
    // 删除当前AI回复
    const newMessages = messages.slice(0, messageIndex);
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await chatAPI.sendMessage(userMessage.content, newMessages);
      
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        retryCount: retryCount
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '抱歉，我暂时无法回复您的消息。请稍后重试。',
        timestamp: Date.now(),
        retryCount: retryCount
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 切换主题
  const handleToggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 编辑模式的键盘事件处理
  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleConfirmEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // 动态样式，支持深色主题
  const getStyles = () => {
    const isDark = isDarkMode;
    const bgColor = isDark ? '#1f2937' : '#f9fafb';
    const surfaceColor = isDark ? '#374151' : 'white';
    const textColor = isDark ? '#f9fafb' : '#111827';
    const borderColor = isDark ? '#4b5563' : '#e5e7eb';
    const mutedColor = isDark ? '#9ca3af' : '#6b7280';
    
    return {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100vh',
      backgroundColor: bgColor,
      color: textColor,
      ...(className && {})
    },
    header: {
      backgroundColor: surfaceColor,
      borderBottom: `1px solid ${borderColor}`,
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
    editContainer: {
      marginTop: '8px',
      padding: '12px',
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0'
    },
    editInput: {
      width: '100%',
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '14px',
      lineHeight: '1.5',
      resize: 'vertical' as const,
      minHeight: '40px',
      fontFamily: 'inherit',
      outline: 'none',
      transition: 'border-color 0.2s ease'
    },
    editInputFocus: {
      borderColor: '#3b82f6',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
    },
    editButtons: {
      display: 'flex',
      gap: '8px',
      marginTop: '8px',
      justifyContent: 'flex-end'
    },
    editButton: {
      padding: '6px 12px',
      borderRadius: '6px',
      border: 'none',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontWeight: '500'
    },
    confirmButton: {
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    confirmButtonHover: {
      backgroundColor: '#2563eb'
    },
    cancelButton: {
      backgroundColor: '#f3f4f6',
      color: '#374151'
    },
    cancelButtonHover: {
      backgroundColor: '#e5e7eb'
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
    },
    // 新增功能样式
    headerActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginLeft: 'auto'
    },
    actionButton: {
      background: 'none',
      border: 'none',
      padding: '8px',
      borderRadius: '6px',
      cursor: 'pointer',
      color: mutedColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
      opacity: 0.7
    },
    actionButtonHover: {
      backgroundColor: isDark ? '#4b5563' : '#f3f4f6',
      color: textColor,
      opacity: 1
    },
    messageActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      marginTop: '4px'
    },
    feedbackButtons: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      marginTop: '4px'
    },
    feedbackButton: {
      background: 'none',
      border: 'none',
      padding: '4px',
      borderRadius: '4px',
      cursor: 'pointer',
      color: mutedColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
      opacity: 0.7
    },
    feedbackButtonActive: {
      color: isDark ? '#10b981' : '#059669',
      opacity: 1
    },
    feedbackButtonDislike: {
      color: isDark ? '#ef4444' : '#dc2626',
      opacity: 1
    },
    clearConfirmModal: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    clearConfirmContent: {
      backgroundColor: surfaceColor,
      padding: '24px',
      borderRadius: '12px',
      border: `1px solid ${borderColor}`,
      maxWidth: '400px',
      width: '90%'
    },
    clearConfirmTitle: {
      fontSize: '18px',
      fontWeight: 'bold',
      marginBottom: '12px',
      color: textColor
    },
    clearConfirmText: {
      fontSize: '14px',
      color: mutedColor,
      marginBottom: '20px',
      lineHeight: '1.5'
    },
    clearConfirmButtons: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end'
    },
    clearConfirmButton: {
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontWeight: '500'
    },
    clearConfirmButtonCancel: {
      backgroundColor: isDark ? '#4b5563' : '#f3f4f6',
      color: textColor
    },
    clearConfirmButtonConfirm: {
      backgroundColor: '#ef4444',
      color: 'white'
    }
  };
};

  return (
    <div style={getStyles().container}>
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
      <div style={getStyles().header}>
        <div style={getStyles().headerIcon}>
          <Bot size={24} />
        </div>
        <div>
          <h1 style={getStyles().headerTitle}>{appConfig.name}</h1>
          <p style={getStyles().headerSubtitle}>{appConfig.description}</p>
        </div>
        <div style={getStyles().headerActions}>
          <button
            style={getStyles().actionButton}
            onClick={handleToggleTheme}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, getStyles().actionButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, getStyles().actionButton);
            }}
            title={isDarkMode ? "切换到浅色主题" : "切换到深色主题"}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            style={getStyles().actionButton}
            onClick={handleClearChat}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, getStyles().actionButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, getStyles().actionButton);
            }}
            title="清空对话"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* 消息区域 */}
      <div style={getStyles().messagesArea}>
        {messages.length === 0 && !appConfig.welcomeMessage ? (
          <div style={getStyles().emptyState}>
            <Bot style={getStyles().emptyIcon} />
            <h2 style={getStyles().emptyTitle}>欢迎使用{appConfig.name}</h2>
            <p style={getStyles().emptyDescription}>
              我是您的AI助手，可以回答各种问题，帮助您解决问题。请在下方的输入框中输入您的问题。
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              style={message.role === 'user' ? getStyles().messageContainerUser : getStyles().messageContainer}
            >
              <div style={message.role === 'user' ? getStyles().messageContentUser : getStyles().messageContent}>
                <div style={message.role === 'user' ? getStyles().avatarUser : getStyles().avatar}>
                  {message.role === 'user' ? (
                    <User size={16} />
                  ) : (
                    <Bot size={16} />
                  )}
                </div>
                <div>
                  <div style={message.role === 'user' ? getStyles().messageBubbleUser : getStyles().messageBubble}>
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
                  <div style={message.role === 'user' ? getStyles().messageTimeUser : getStyles().messageTime}>
                    {message.timestamp && new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                  {message.role === 'assistant' && (
                    <div style={getStyles().messageActions}>
                      <button
                        style={getStyles().actionButton}
                        onClick={() => handleCopyMessage(message.content)}
                        onMouseEnter={(e) => {
                          Object.assign(e.currentTarget.style, getStyles().actionButtonHover);
                        }}
                        onMouseLeave={(e) => {
                          Object.assign(e.currentTarget.style, getStyles().actionButton);
                        }}
                        title="复制消息"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        style={getStyles().actionButton}
                        onClick={() => handleEditMessage(message.id)}
                        onMouseEnter={(e) => {
                          Object.assign(e.currentTarget.style, getStyles().actionButtonHover);
                        }}
                        onMouseLeave={(e) => {
                          Object.assign(e.currentTarget.style, getStyles().actionButton);
                        }}
                        title="编辑问题"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        style={getStyles().actionButton}
                        onClick={() => handleRegenerateMessage(message.id)}
                        onMouseEnter={(e) => {
                          Object.assign(e.currentTarget.style, getStyles().actionButtonHover);
                        }}
                        onMouseLeave={(e) => {
                          Object.assign(e.currentTarget.style, getStyles().actionButton);
                        }}
                        title="重新生成"
                      >
                        <RotateCcw size={14} />
                      </button>
                      {message.content.includes('抱歉，我暂时无法回复您的消息') && (
                        <button
                          style={getStyles().actionButton}
                          onClick={() => handleRetryMessage(message.id)}
                          onMouseEnter={(e) => {
                            Object.assign(e.currentTarget.style, getStyles().actionButtonHover);
                          }}
                          onMouseLeave={(e) => {
                            Object.assign(e.currentTarget.style, getStyles().actionButton);
                          }}
                          title="重试"
                        >
                          <RefreshCw size={14} />
                        </button>
                      )}
                      {/* 反馈按钮 */}
                      <button
                        style={{
                          ...getStyles().feedbackButton,
                          ...(message.feedback === 'like' ? getStyles().feedbackButtonActive : {})
                        }}
                        onClick={() => handleMessageFeedback(message.id, 'like')}
                        title="点赞"
                      >
                        <ThumbsUp size={14} />
                      </button>
                      <button
                        style={{
                          ...getStyles().feedbackButton,
                          ...(message.feedback === 'dislike' ? getStyles().feedbackButtonDislike : {})
                        }}
                        onClick={() => handleMessageFeedback(message.id, 'dislike')}
                        title="点踩"
                      >
                        <ThumbsDown size={14} />
                      </button>
                    </div>
                  )}
                  
                  {/* 编辑模式 */}
                  {message.role === 'assistant' && editingMessageId === message.id && (
                    <div style={getStyles().editContainer}>
                      <textarea
                        style={getStyles().editInput}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="修改您的问题..."
                        rows={2}
                        onFocus={(e) => {
                          Object.assign(e.currentTarget.style, getStyles().editInputFocus);
                        }}
                        onBlur={(e) => {
                          Object.assign(e.currentTarget.style, getStyles().editInput);
                        }}
                        onKeyDown={handleEditKeyPress}
                      />
                      <div style={getStyles().editButtons}>
                        <button
                          style={{...getStyles().editButton, ...getStyles().cancelButton}}
                          onClick={handleCancelEdit}
                          onMouseEnter={(e) => {
                            Object.assign(e.currentTarget.style, getStyles().cancelButtonHover);
                          }}
                          onMouseLeave={(e) => {
                            Object.assign(e.currentTarget.style, getStyles().cancelButton);
                          }}
                        >
                          <X size={14} style={{ marginRight: '4px' }} />
                          取消
                        </button>
                        <button
                          style={{...getStyles().editButton, ...getStyles().confirmButton}}
                          onClick={handleConfirmEdit}
                          disabled={!editValue.trim() || isLoading}
                          onMouseEnter={(e) => {
                            if (!e.currentTarget.disabled) {
                              Object.assign(e.currentTarget.style, getStyles().confirmButtonHover);
                            }
                          }}
                          onMouseLeave={(e) => {
                            Object.assign(e.currentTarget.style, getStyles().confirmButton);
                          }}
                        >
                          <Check size={14} style={{ marginRight: '4px' }} />
                          确认
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div style={getStyles().loadingContainer}>
            <div style={getStyles().loadingContent}>
              <div style={getStyles().avatar}>
                <Bot size={16} />
              </div>
              <div style={getStyles().loadingBubble}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={getStyles().loadingText}>AI正在思考...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 清空确认对话框 */}
      {showClearConfirm && (
        <div style={getStyles().clearConfirmModal}>
          <div style={getStyles().clearConfirmContent}>
            <div style={getStyles().clearConfirmTitle}>确认清空对话</div>
            <div style={getStyles().clearConfirmText}>
              您确定要清空所有对话记录吗？此操作无法撤销。
            </div>
            <div style={getStyles().clearConfirmButtons}>
              <button
                style={{...getStyles().clearConfirmButton, ...getStyles().clearConfirmButtonCancel}}
                onClick={handleCancelClear}
              >
                取消
              </button>
              <button
                style={{...getStyles().clearConfirmButton, ...getStyles().clearConfirmButtonConfirm}}
                onClick={handleConfirmClear}
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <div style={getStyles().inputArea}>
        <div style={getStyles().inputContainer}>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的问题..."
            style={{
              ...getStyles().textarea,
              ...(inputValue.trim() ? getStyles().textareaFocus : {})
            }}
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            style={{
              ...getStyles().sendButton,
              ...((!inputValue.trim() || isLoading) ? getStyles().sendButtonDisabled : {})
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

