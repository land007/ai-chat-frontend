import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { ChatMessage, chatAPI } from '../services/api';

interface ChatInterfaceProps {
  className?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ className = '' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
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
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
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
      {/* 头部 */}
      <div style={styles.header}>
        <div style={styles.headerIcon}>
          <Bot size={24} />
        </div>
        <div>
          <h1 style={styles.headerTitle}>AI智能助手</h1>
          <p style={styles.headerSubtitle}>基于阿里云DashScope的智能对话</p>
        </div>
      </div>

      {/* 消息区域 */}
      <div style={styles.messagesArea}>
        {messages.length === 0 ? (
          <div style={styles.emptyState}>
            <Bot style={styles.emptyIcon} />
            <h2 style={styles.emptyTitle}>欢迎使用AI智能助手</h2>
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
                    {message.content}
                  </div>
                  <div style={message.role === 'user' ? styles.messageTimeUser : styles.messageTime}>
                    {message.timestamp && new Date(message.timestamp).toLocaleTimeString()}
                  </div>
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

