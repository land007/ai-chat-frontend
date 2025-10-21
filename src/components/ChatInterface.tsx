import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, RotateCcw, Edit3, Check, X, Trash2, Copy, ThumbsUp, ThumbsDown, Sun, Moon, RefreshCw, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ChatMessage, chatAPI } from '../services/api';
import SyncTTS from './SyncTTS';
import 'highlight.js/styles/github.css';

// 生成唯一ID的工具函数
const generateId = () => Math.random().toString(36).substr(2, 9);

interface ChatInterfaceProps {
  className?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ className = '' }) => {
  const { t, i18n } = useTranslation();
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

    // 创建助手消息，内容为空，等待流式填充
    const assistantMessageId = generateId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // 使用流式API
      await chatAPI.sendMessageStream(
        inputValue.trim(), 
        messages,
        {
          onStart: () => {
            console.log('[ChatInterface] 流式响应开始');
          },
          onContent: (content: string) => {
            // 实时更新助手消息内容
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: msg.content + content }
                : msg
            ));
          },
          onDone: () => {
            console.log('[ChatInterface] 流式响应完成');
            setIsLoading(false);
          },
          onError: (error: string, code?: string) => {
            console.error('[ChatInterface] 流式响应错误:', error, code);
            // 更新助手消息为错误信息
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: t('messages.errorMessage') }
                : msg
            ));
            setIsLoading(false);
          }
        }
      );
    } catch (error) {
      console.error('[ChatInterface] 发送消息失败:', error);
      // 更新助手消息为错误信息
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: t('messages.errorMessage') }
          : msg
      ));
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
        content: t('messages.errorMessage'),
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
        content: t('messages.errorMessage'),
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
      console.log(t('messages.copySuccess'));
    } catch (error) {
      console.error(t('messages.copyError'), error);
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
        content: t('messages.errorMessage'),
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

  // 切换语言
  const handleToggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
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
      backgroundColor: surfaceColor,
      color: textColor,
      border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
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
      backgroundColor: surfaceColor,
      border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    loadingText: {
      color: mutedColor
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
      backgroundColor: isDark ? '#2d3748' : '#f8fafc',
      borderRadius: '8px',
      border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`
    },
    editInput: {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
      borderRadius: '6px',
      fontSize: '14px',
      lineHeight: '1.5',
      resize: 'vertical' as const,
      minHeight: '40px',
      fontFamily: 'inherit',
      outline: 'none',
      transition: 'border-color 0.2s ease',
      backgroundColor: surfaceColor,
      color: textColor
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
      backgroundColor: surfaceColor,
      borderTop: `1px solid ${borderColor}`,
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
      border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
      borderRadius: '16px',
      resize: 'none' as const,
      outline: 'none',
      fontSize: '16px',
      fontFamily: 'inherit',
      minHeight: '48px',
      maxHeight: '120px',
      backgroundColor: surfaceColor,
      color: textColor
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
      border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
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
            onClick={handleToggleLanguage}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, getStyles().actionButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, getStyles().actionButton);
            }}
            title={t('ui.switchLanguage')}
          >
            <Globe size={18} />
          </button>
          <button
            style={getStyles().actionButton}
            onClick={handleToggleTheme}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, getStyles().actionButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, getStyles().actionButton);
            }}
            title={isDarkMode ? t('ui.lightTheme') : t('ui.darkTheme')}
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
            title={t('ui.clear')}
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
            <h2 style={getStyles().emptyTitle}>{t('app.welcome')}</h2>
            <p style={getStyles().emptyDescription}>
              {t('app.welcomeDescription')}
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
                      <SyncTTS
                        text={message.content}
                        messageId={message.id}
                        isDarkMode={isDarkMode}
                      />
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                        {message.content}
                      </div>
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
                        title={t('ui.copy')}
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
                        title={t('ui.edit')}
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
                        title={t('ui.regenerate')}
                      >
                        <RotateCcw size={14} />
                      </button>
                      {message.content.includes(t('messages.errorMessage')) && (
                        <button
                          style={getStyles().actionButton}
                          onClick={() => handleRetryMessage(message.id)}
                          onMouseEnter={(e) => {
                            Object.assign(e.currentTarget.style, getStyles().actionButtonHover);
                          }}
                          onMouseLeave={(e) => {
                            Object.assign(e.currentTarget.style, getStyles().actionButton);
                          }}
                          title={t('ui.retry')}
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
                        title={t('ui.like')}
                      >
                        <ThumbsUp size={14} />
                      </button>
                      <button
                        style={{
                          ...getStyles().feedbackButton,
                          ...(message.feedback === 'dislike' ? getStyles().feedbackButtonDislike : {})
                        }}
                        onClick={() => handleMessageFeedback(message.id, 'dislike')}
                        title={t('ui.dislike')}
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
                        placeholder={t('ui.editPlaceholder')}
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
                          {t('ui.cancel')}
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
                          {t('ui.confirm')}
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
                <span style={getStyles().loadingText}>{t('ui.loading')}</span>
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
            <div style={getStyles().clearConfirmTitle}>{t('messages.clearConfirm')}</div>
            <div style={getStyles().clearConfirmText}>
              {t('messages.clearConfirmText')}
            </div>
            <div style={getStyles().clearConfirmButtons}>
              <button
                style={{...getStyles().clearConfirmButton, ...getStyles().clearConfirmButtonCancel}}
                onClick={handleCancelClear}
              >
                {t('ui.cancel')}
              </button>
              <button
                style={{...getStyles().clearConfirmButton, ...getStyles().clearConfirmButtonConfirm}}
                onClick={handleConfirmClear}
              >
                {t('messages.clearConfirmButton')}
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
            placeholder={t('ui.inputPlaceholder')}
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

