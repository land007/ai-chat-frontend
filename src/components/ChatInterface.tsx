import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, RotateCcw, Edit3, Check, X, Trash2, Copy, ThumbsUp, ThumbsDown, Sun, Moon, RefreshCw, Globe, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { chatAPI } from '@/services/api';
import TypewriterEffect from './TypewriterEffect';
import { 
  ChatMessage, 
  ChatInterfaceProps
} from '@/types';
import { generateId } from '@/utils';
import 'highlight.js/styles/github.css';

const ChatInterface: React.FC<ChatInterfaceProps> = ({ className = '' }) => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // 自动检测系统主题偏好
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isStreamingEnabled] = useState(true); // 流式传输始终开启
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null); // 当前流式传输的消息ID
  const [isStreamingThinking, setIsStreamingThinking] = useState(false); // 流式传输思考状态
  const [showExamples, setShowExamples] = useState(true);
  const [appConfig, setAppConfig] = useState({
    name: 'AI智能助手',
    description: '基于阿里云DashScope的智能对话',
    welcomeMessage: '',
    enableI18nButton: false,
    exampleQuestions: [] as string[]
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const hasAddedStreamingMessageRef = useRef(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const touchStartY = useRef<number>(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 处理滚动事件，检测用户是否在查看历史消息
  const handleScroll = () => {
    if (!messagesAreaRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // 如果距离底部超过100px，认为用户在查看历史消息
    setIsUserScrolling(distanceFromBottom > 100);
  };

  // 处理触摸开始事件
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  // 处理触摸移动事件，防止橡皮筋效果
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!messagesAreaRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current;
    const touchY = e.touches[0].clientY;
    const deltaY = touchY - touchStartY.current;
    
    // 检测是否在边界处进行过度滚动
    const isAtTop = scrollTop <= 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
    
    // 在顶部向下拉动或在底部向上推动时阻止默认行为
    if ((isAtTop && deltaY > 0) || (isAtBottom && deltaY < 0)) {
      e.preventDefault();
    }
  };

  // 处理整个容器的触摸移动事件，防止页面级橡皮筋
  const handleContainerTouchMove = (e: React.TouchEvent) => {
    // 如果触摸事件发生在消息区域，让消息区域自己处理
    if (messagesAreaRef.current && messagesAreaRef.current.contains(e.target as Node)) {
      return;
    }
    
    // 对于其他区域，阻止所有可能导致橡皮筋的触摸移动
    e.preventDefault();
  };

  useEffect(() => {
    // 仅在用户没有手动滚动时自动滚动到底部
    if (!isUserScrolling) {
      scrollToBottom();
    }
  }, [messages, isUserScrolling]);

  // 调试用户信息
  useEffect(() => {
    if (user) {
      console.log('[调试] 用户信息:', user, 'loginType:', user.loginType);
    }
  }, [user]);

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    // 添加监听器
    mediaQuery.addEventListener('change', handleThemeChange);
    
    // 清理函数
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

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
            // 替换 {{name}} 占位符：有name值就替换为name，没有就替换为空字符串
            const welcomeText = config.welcomeMessage.replace(
              /\{\{name\}\}/g, 
              user?.name || ''
            );
            
            const welcomeMessage: ChatMessage = {
              id: generateId(),
              role: 'assistant',
              content: welcomeText,
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

  const handleExampleClick = async (question: string) => {
    setShowExamples(false);
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: question,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);

    if (isStreamingEnabled) {
      // 流式传输模式
      const assistantMessageId = generateId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      setStreamingMessageId(assistantMessageId);
      setIsStreamingThinking(true);
      hasAddedStreamingMessageRef.current = false;

      try {
        await chatAPI.sendMessageStream(
          question,
          messages,
          (content: string, done: boolean) => {
            if (content && !hasAddedStreamingMessageRef.current) {
              setIsStreamingThinking(false);
              setMessages(prev => [...prev, assistantMessage]);
              hasAddedStreamingMessageRef.current = true;
            }
            
            if (content) {
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content }
                  : msg
              ));
            }
            
            if (done) {
              setStreamingMessageId(null);
              setIsStreamingThinking(false);
              hasAddedStreamingMessageRef.current = false;
              setIsLoading(false);
            }
          },
          (error: string) => {
            setIsStreamingThinking(false);
            setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
            setStreamingMessageId(null);
            hasAddedStreamingMessageRef.current = false;
            setIsLoading(false);
          }
        );
      } catch (error) {
        setIsStreamingThinking(false);
        setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
        setStreamingMessageId(null);
        hasAddedStreamingMessageRef.current = false;
        setIsLoading(false);
      }
    } else {
      // 非流式传输模式
      try {
        const response = await chatAPI.sendMessage(question, messages);
        
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
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    if (isStreamingEnabled) {
      // 流式传输模式
      const assistantMessageId = generateId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      // 先设置思考状态，不立即添加空消息
      setStreamingMessageId(assistantMessageId);
      setIsStreamingThinking(true);
      hasAddedStreamingMessageRef.current = false;

      try {
        await chatAPI.sendMessageStream(
          currentInput,
          messages,
          (content: string, done: boolean) => {
            // 当有内容到达时，停止思考状态并添加消息
            if (content && !hasAddedStreamingMessageRef.current) {
              setIsStreamingThinking(false);
              setMessages(prev => [...prev, assistantMessage]);
              hasAddedStreamingMessageRef.current = true;
            }
            
            // 更新消息内容
            if (content) {
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content }
                  : msg
              ));
            }
            
            if (done) {
              setStreamingMessageId(null);
              setIsStreamingThinking(false);
              hasAddedStreamingMessageRef.current = false;
              setIsLoading(false);
            }
          },
          (error: string) => {
            // 错误处理：停止思考状态并添加错误消息
            setIsStreamingThinking(false);
            setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
            setStreamingMessageId(null);
            hasAddedStreamingMessageRef.current = false;
            setIsLoading(false);
          }
        );
      } catch (error) {
        // 异常处理：停止思考状态并添加错误消息
        setIsStreamingThinking(false);
        setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
        setStreamingMessageId(null);
        hasAddedStreamingMessageRef.current = false;
        setIsLoading(false);
      }
    } else {
      // 非流式传输模式
      try {
        const response = await chatAPI.sendMessage(currentInput, messages);
        
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

    if (isStreamingEnabled) {
      // 流式传输模式
      const assistantMessageId = generateId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      // 先设置思考状态，不立即添加空消息
      setStreamingMessageId(assistantMessageId);
      setIsStreamingThinking(true);
      hasAddedStreamingMessageRef.current = false;

      try {
        await chatAPI.sendMessageStream(
          userMessage.content,
          newMessages,
          (content: string, done: boolean) => {
            // 当有内容到达时，停止思考状态并添加消息
            if (content && !hasAddedStreamingMessageRef.current) {
              setIsStreamingThinking(false);
              setMessages(prev => [...prev, assistantMessage]);
              hasAddedStreamingMessageRef.current = true;
            }
            
            // 更新消息内容
            if (content) {
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content }
                  : msg
              ));
            }
            
            if (done) {
              setStreamingMessageId(null);
              setIsStreamingThinking(false);
              hasAddedStreamingMessageRef.current = false;
              setIsLoading(false);
            }
          },
          (error: string) => {
            // 错误处理：停止思考状态并添加错误消息
            setIsStreamingThinking(false);
            setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
            setStreamingMessageId(null);
            hasAddedStreamingMessageRef.current = false;
            setIsLoading(false);
          }
        );
      } catch (error) {
        // 异常处理：停止思考状态并添加错误消息
        setIsStreamingThinking(false);
        setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
        setStreamingMessageId(null);
        hasAddedStreamingMessageRef.current = false;
        setIsLoading(false);
      }
    } else {
      // 非流式传输模式
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
      width: '100vw',
      backgroundColor: bgColor,
      color: textColor,
      overflow: 'hidden' as const,
      position: 'relative' as const,
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
      color: textColor,
      margin: 0
    },
    headerSubtitle: {
      fontSize: '14px',
      color: mutedColor,
      margin: 0
    },
    messagesArea: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: '16px 24px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '16px',
      overscrollBehavior: 'contain',
      WebkitOverflowScrolling: 'touch' as any,
      touchAction: 'pan-y'
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
      color: '#6b7280',
      flexShrink: 0,
      minWidth: '32px',
      minHeight: '32px'
    },
    avatarUser: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#3b82f6',
      color: 'white',
      flexShrink: 0,
      minWidth: '32px',
      minHeight: '32px'
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
      alignItems: 'center',
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
      backgroundColor: 'transparent',
      border: 'none',
      padding: '8px',
      borderRadius: '6px',
      cursor: 'pointer',
      color: mutedColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
      opacity: 0.7,
      outline: 'none'
    } as React.CSSProperties,
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
    },
    exampleQuestionsContainer: {
      marginTop: '16px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '8px'
    },
    exampleQuestionButton: {
      padding: '12px 16px',
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      cursor: 'pointer',
      textAlign: 'left' as const,
      color: textColor,
      fontSize: '16px',
      transition: 'all 0.2s ease'
    },
    exampleQuestionButtonHover: {
      backgroundColor: isDark ? '#4b5563' : '#e5e7eb',
      borderColor: '#3b82f6'
    }
  };
};

  return (
    <div 
      style={getStyles().container}
      onTouchMove={handleContainerTouchMove}
    >
      {/* 添加旋转动画样式 */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          /* 移动端主题切换按钮样式修复 */
          @media (max-width: 768px) {
            .theme-toggle-button {
              -webkit-tap-highlight-color: transparent;
              -webkit-touch-callout: none;
              -webkit-user-select: none;
              user-select: none;
              background-color: transparent !important;
            }
            
            .theme-toggle-button:active {
              background-color: transparent !important;
            }
            
            .theme-toggle-button:focus {
              outline: none !important;
            }
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
        </div>
        <div style={getStyles().headerActions}>
          {appConfig.enableI18nButton && (
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
          )}
          <button
            className="theme-toggle-button"
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
          {/* 只有用户名密码登录的用户才显示注销按钮 */}
          {user && user.loginType === 'password' && (
            <button
              style={getStyles().actionButton}
              onClick={logout}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, getStyles().actionButtonHover);
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, getStyles().actionButton);
              }}
              title="退出登录"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 消息区域 */}
      <div 
        ref={messagesAreaRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        style={getStyles().messagesArea}
      >
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
                      <TypewriterEffect
                        text={message.content}
                        enabled={!isStreamingEnabled}
                        isDarkMode={isDarkMode}
                        isStreaming={streamingMessageId === message.id}
                        isThinking={isStreamingThinking && streamingMessageId === message.id}
                      />
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
        
        {/* 示例问题显示 */}
        {showExamples && appConfig.exampleQuestions.length > 0 && messages.length === 1 && messages[0].role === 'assistant' && (
          <div style={getStyles().exampleQuestionsContainer}>
            {appConfig.exampleQuestions.map((question, index) => (
              <button
                key={index}
                style={getStyles().exampleQuestionButton}
                onClick={() => handleExampleClick(question)}
                onMouseEnter={(e) => {
                  Object.assign(e.currentTarget.style, getStyles().exampleQuestionButtonHover);
                }}
                onMouseLeave={(e) => {
                  Object.assign(e.currentTarget.style, getStyles().exampleQuestionButton);
                }}
              >
                {question}
              </button>
            ))}
          </div>
        )}
        
        {isLoading && !isStreamingEnabled && (
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
        
        {isStreamingThinking && (
          <div style={getStyles().loadingContainer}>
            <div style={getStyles().loadingContent}>
              <div style={getStyles().avatar}>
                <Bot size={16} />
              </div>
              <div style={getStyles().loadingBubble}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={getStyles().loadingText}>思考中...</span>
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

