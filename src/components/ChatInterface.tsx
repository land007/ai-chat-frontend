import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Bot, User, Loader2, RotateCcw, Edit3, Check, X, Trash2, Copy, ThumbsUp, ThumbsDown, Sun, Moon, RefreshCw, Globe, LogOut, Settings, Menu, Mic, Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { chatAPI } from '@/services/api';
import { speechRecognitionService } from '@/services/speechRecognition';
import TypewriterEffect from './TypewriterEffect';
import FeedbackAdmin from './FeedbackAdmin';
import ChatHistorySidebar from './ChatHistorySidebar';
import { 
  ChatMessage, 
  ChatInterfaceProps
} from '@/types';
import { generateId, copyToClipboard } from '@/utils';
import 'highlight.js/styles/github.css';

// 随机选择数组中的n个元素
const getRandomItems = <T,>(array: T[], count: number): T[] => {
  if (array.length <= count) return array;
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

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
    exampleQuestions: [] as string[],
    enableFastSuggest: true as boolean,
    fastSuggestDefaultCount: 3 as number,
    textareaMinRows: 2 as number,
    textareaMaxRows: 5 as number,
    enableVoiceInput: true as boolean,
    voiceInputLanguage: 'zh' as string,
    voiceInputVadMode: true as boolean
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const hasAddedStreamingMessageRef = useRef(false);
  const editContainerRef = useRef<HTMLDivElement | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const touchStartY = useRef<number>(0);
  const mainTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showFeedbackAdmin, setShowFeedbackAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState<string[]>(['admin']);
  
  // 历史记录相关状态
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  // 复制反馈状态
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 语音输入相关状态
  const [inputMode, setInputMode] = useState<'keyboard' | 'voice'>('keyboard');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedText, setRecognizedText] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  
  // 录音相关refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const currentTranscriptRef = useRef<string>(''); // 当前累积的识别文本
  const voiceInputModeRef = useRef<'vad' | 'manual'>('vad'); // 当前使用的模式
  const isRecordingRef = useRef<boolean>(false); // 录音状态ref（用于闭包中访问）
  const isInitializingRef = useRef<boolean>(false); // 初始化状态ref（防止过早清理）
  const recordingStartTimeRef = useRef<number>(0); // 录音开始时间（用于最小录音时长保护）
  
  // 检查是否是管理员用户
  const isAdmin = user?.userId && adminUsers.includes(user.userId);
  
  // 调试信息：打印当前用户和管理员列表
  useEffect(() => {
    if (user) {
      console.log('[管理员调试] 当前用户:', user.userId, user.name);
      console.log('[管理员调试] 管理员列表:', adminUsers);
      console.log('[管理员调试] 是否管理员:', isAdmin);
    }
  }, [user, adminUsers, isAdmin]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 检测用户是否在底部附近（距离底部小于100px）
  const isNearBottom = useCallback(() => {
    if (!messagesAreaRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= 100;
  }, []);

  // 平滑滚动到底部
  // immediate: 是否立即滚动（用于用户发送消息时），使用 requestAnimationFrame 确保DOM更新后再滚动
  const scrollToBottom = useCallback((immediate: boolean = false) => {
    if (immediate) {
      // 立即滚动模式：使用 requestAnimationFrame 确保DOM更新后再滚动
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end' 
        });
      });
    } else {
      // 普通模式：直接滚动
      messagesEndRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end' 
      });
    }
  }, []);

  // 自动保存当前会话（使用useEffect确保状态同步）
  const pendingSaveRef = useRef(false);
  
  const saveCurrentSession = useCallback(() => {
    // 标记需要保存
    pendingSaveRef.current = true;
  }, []);

  // 使用useEffect监听messages变化，确保在状态更新后保存
  useEffect(() => {
    if (!pendingSaveRef.current) return;
    
    // 重置标记
    pendingSaveRef.current = false;
    
    // 过滤欢迎消息
    const validMessages = messages.filter(m => !m.isWelcome);
    if (validMessages.length === 0) {
      console.log('[历史记录] 没有有效消息，跳过保存');
      return;
    }

    // 执行保存
    const doSave = async () => {
      try {
        console.log('[历史记录] 自动保存会话', { 
          currentSessionId, 
          messageCount: validMessages.length,
          messages: validMessages.map(m => ({ role: m.role, contentLength: m.content.length }))
        });
        
        const session = await chatAPI.saveSession(currentSessionId, validMessages);
        
        // 如果是新建会话，更新sessionId
        if (!currentSessionId) {
          setCurrentSessionId(session.id);
          console.log('[历史记录] 新会话已创建', session.id);
        } else {
          console.log('[历史记录] 会话已更新', session.id);
        }
      } catch (error) {
        console.error('[历史记录] 自动保存失败:', error);
        // 静默失败，不影响用户体验
      }
    };

    doSave();
  }, [messages, currentSessionId]);

  // 加载会话
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      setIsHistoryLoading(true);
      console.log('[历史记录] 加载会话', sessionId);
      
      const detail = await chatAPI.getSessionDetail(sessionId);
      
      // 设置消息（不包括欢迎消息，因为会话中已经过滤了）
      setMessages(detail.messages);
      setCurrentSessionId(sessionId);
      
      // 重置其他状态
      setEditingMessageId(null);
      setEditValue('');
      setInputValue('');
      
      console.log('[历史记录] 会话加载成功', { messageCount: detail.messages.length });
    } catch (error) {
      console.error('[历史记录] 加载会话失败:', error);
      alert('加载会话失败，请重试');
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  // 新建对话
  const handleNewChat = useCallback(() => {
    console.log('[历史记录] 新建对话');
    
    // 重新创建欢迎消息（如果配置了）
    const newMessages: ChatMessage[] = [];
    if (appConfig.welcomeMessage && appConfig.welcomeMessage.trim()) {
      const welcomeText = appConfig.welcomeMessage.replace(
        /\{\{name\}\}/g, 
        user?.name || ''
      );
      
      const welcomeMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: welcomeText,
        timestamp: Date.now(),
        isWelcome: true,
        suggestedQuestions: Array.isArray(appConfig.exampleQuestions)
          ? getRandomItems(appConfig.exampleQuestions, appConfig.fastSuggestDefaultCount || 3)
          : []
      };
      newMessages.push(welcomeMessage);
    }
    
    setMessages(newMessages);
    
    // 重置状态
    setCurrentSessionId(null);
    setEditingMessageId(null);
    setEditValue('');
    setInputValue('');
    setIsLoading(false);
    setStreamingMessageId(null);
    setIsStreamingThinking(false);
    
    // 关闭侧边栏
    setIsSidebarOpen(false);
  }, [appConfig, user]);

  // 处理滚动事件，检测用户是否在查看历史消息
  const handleScroll = () => {
    if (!messagesAreaRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // 如果距离底部超过100px，认为用户在查看历史消息
    // 用户手动滚动时，浏览器会自动中断平滑滚动动画，这里我们标记状态以阻止后续自动滚动
    const userScrolling = distanceFromBottom > 100;
    setIsUserScrolling(userScrolling);
    
    // 如果用户正在向上滚动（查看历史消息），立即停止自动滚动跟随
    // 浏览器本身会中断平滑滚动，这里额外标记以确保代码逻辑停止触发新的滚动
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

  // 编辑容器自动滚动到可视区域
  useEffect(() => {
    if (editingMessageId && editContainerRef.current) {
      // 使用 setTimeout 确保 DOM 已更新
      setTimeout(() => {
        editContainerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest', // 如果已经在视图中，不滚动；如果不在，滚动到最近位置
          inline: 'nearest'
        });
      }, 0);
    }
  }, [editingMessageId]);

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
          // 设置管理员列表
          if (config.adminUsers && Array.isArray(config.adminUsers)) {
            setAdminUsers(config.adminUsers);
          }
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
              timestamp: Date.now(),
              isWelcome: true, // 标记为欢迎语
              // 将欢迎建议作为"回复建议"直接挂在欢迎消息下
              suggestedQuestions: Array.isArray(config.exampleQuestions)
                ? getRandomItems(config.exampleQuestions, config.fastSuggestDefaultCount || 3)
                : []
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
  }, [user]);

  // textarea自动调整高度
  const autoResizeTextarea = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    
    // 重置高度以获取正确的scrollHeight
    textarea.style.height = 'auto';
    
    // 获取实际内容高度
    const scrollHeight = textarea.scrollHeight;
    
    // 计算最小和最大行数
    const minRows = appConfig.textareaMinRows || 2;
    const maxRows = appConfig.textareaMaxRows || 5;
    
    // 获取计算后的样式来计算行高
    const computedStyle = window.getComputedStyle(textarea);
    const fontSize = parseFloat(computedStyle.fontSize) || 16;
    const lineHeightStr = computedStyle.lineHeight || '1.5';
    const lineHeight = lineHeightStr.includes('px') 
      ? parseFloat(lineHeightStr) 
      : parseFloat(lineHeightStr) * fontSize;
    
    // 计算最小和最大高度
    const minHeight = minRows * lineHeight;
    const maxHeight = maxRows * lineHeight;
    
    // 限制scrollHeight在最小和最大高度之间
    const targetHeight = Math.max(minHeight, Math.min(maxHeight, scrollHeight));
    
    // 设置高度和滚动条
    textarea.style.height = `${targetHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [appConfig.textareaMinRows, appConfig.textareaMaxRows]);

  // 监听主输入框内容变化，自动调整高度
  useEffect(() => {
    autoResizeTextarea(mainTextareaRef.current);
  }, [inputValue, autoResizeTextarea]);

  // 监听编辑框内容变化，自动调整高度
  useEffect(() => {
    autoResizeTextarea(editTextareaRef.current);
  }, [editValue, autoResizeTextarea]);

  // 监听配置变化，重新调整高度（当配置加载完成后）
  useEffect(() => {
    autoResizeTextarea(mainTextareaRef.current);
    autoResizeTextarea(editTextareaRef.current);
  }, [appConfig.textareaMinRows, appConfig.textareaMaxRows, autoResizeTextarea]);

  // 在回答完成后请求fast建议并写回对应AI消息
  const attachFastSuggestions = async (assistantMessageId: string, answerContent: string, userQuestionOverride?: string) => {
    try {
      if (!appConfig.enableFastSuggest) return;
      // 当回调传入的answerContent为空时，从当前消息列表获取该AI消息的最终内容
      const currentAssistant = messages.find(m => m.id === assistantMessageId);
      const finalAnswer = (answerContent && answerContent.trim()) ? answerContent : (currentAssistant?.content || '');
      if (!finalAnswer) return; // 仍为空则放弃本次建议，避免后端校验错误

      // 优先使用调用方显式提供的最新问题，避免闭包导致读取到旧的messages
      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      const userQuestion = (userQuestionOverride && userQuestionOverride.trim()) || lastUser?.content || '';
      const suggestions = await chatAPI.getFastSuggestions(
        finalAnswer,
        userQuestion,
        appConfig.fastSuggestDefaultCount
      );
      if (suggestions && suggestions.length > 0) {
        setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, suggestedQuestions: suggestions } : m));
      }
    } catch (_) {
      // 静默失败
    }
  };

  // 停止当前请求
  const handleStopRequest = () => {
    if (abortControllerRef.current) {
      console.log('[UI] 用户请求中止');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // 使用 chatAPI 的中止方法作为备用
    chatAPI.abortCurrentRequest();
    
    // 找到最后一条用户消息，恢复到输入框
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      setInputValue(lastUserMessage.content);
      // 删除最后一条用户消息和未完成的 AI 消息（如果存在）
      setMessages(prev => {
        const lastUserIndex = prev.findIndex(m => m.id === lastUserMessage.id);
        if (lastUserIndex !== -1) {
          // 删除从该用户消息开始的所有后续消息（包括用户消息和未完成的 AI 回复）
          return prev.slice(0, lastUserIndex);
        }
        return prev;
      });
    }
    
    // 重置所有加载状态
    setIsLoading(false);
    setStreamingMessageId(null);
    setIsStreamingThinking(false);
    hasAddedStreamingMessageRef.current = false;
    
    // 清除编辑状态（如果有）
    setEditingMessageId(null);
    setEditValue('');
  };

  const handleExampleClick = async (question: string) => {
    // 如果正在加载，禁止点击
    if (isLoading) {
      console.log('[UI] 正在加载中，禁止点击建议问题');
      return;
    }
    
    // 清空输入框
    setInputValue('');
    
    // 保留示例问题显示：不再隐藏
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: question,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    // 用户消息添加后立即平滑滚动到底部
    scrollToBottom(true);

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

      // 创建新的 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        await chatAPI.sendMessageStream(
          question,
          messages,
          (incrementalContent: string, done: boolean) => {
            // 只有在收到有实际内容的数据时才添加消息并退出思考状态
            if (incrementalContent && incrementalContent.length > 0 && !hasAddedStreamingMessageRef.current) {
              setIsStreamingThinking(false);
              setMessages(prev => [...prev, assistantMessage]);
              hasAddedStreamingMessageRef.current = true;
            }
            
            // 更新消息内容（累积模式 - 直接使用后端发送的累积内容）
            if (incrementalContent) {
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: incrementalContent }
                  : msg
              ));
              // 流式输出期间，如果用户在底部附近且没有手动向上滚动，持续跟随滚动
              // 浏览器会在用户手动滚动时自动中断平滑滚动动画，这里我们额外检查 isUserScrolling 状态
              if (isNearBottom() && !isUserScrolling) {
                scrollToBottom();
              }
            }
            
            if (done) {
              setStreamingMessageId(null);
              setIsStreamingThinking(false);
              hasAddedStreamingMessageRef.current = false;
              setIsLoading(false);
              abortControllerRef.current = null;
              // 回答完成后触发fast建议（显式传入本次问题以避免读取到旧问题）
              attachFastSuggestions(assistantMessageId, incrementalContent || '', question);
              // 自动保存会话
              saveCurrentSession();
            }
          },
          (error: string) => {
            // 检查是否是用户中止
            if (error === '请求已取消') {
              console.log('[UI] 请求已被用户取消');
              setIsStreamingThinking(false);
              setStreamingMessageId(null);
              hasAddedStreamingMessageRef.current = false;
              setIsLoading(false);
              abortControllerRef.current = null;
              return;
            }
            setIsStreamingThinking(false);
            setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
            setStreamingMessageId(null);
            hasAddedStreamingMessageRef.current = false;
            setIsLoading(false);
            abortControllerRef.current = null;
          },
          abortController.signal
        );
      } catch (error) {
        // 检查是否是用户主动中止
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[UI] 请求已被用户取消');
          setIsStreamingThinking(false);
          setStreamingMessageId(null);
          hasAddedStreamingMessageRef.current = false;
          setIsLoading(false);
          abortControllerRef.current = null;
          return;
        }
        setIsStreamingThinking(false);
        setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
        setStreamingMessageId(null);
        hasAddedStreamingMessageRef.current = false;
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    } else {
      // 非流式传输模式
      // 创建新的 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await chatAPI.sendMessage(question, messages, abortController.signal);
        
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: response,
          timestamp: Date.now()
        };

        setMessages(prev => [...prev, assistantMessage]);
        // 非流式也触发fast建议（显式传入本次问题）
        attachFastSuggestions(assistantMessage.id, response, question);
        // 自动保存会话
        saveCurrentSession();
      } catch (error) {
        // 检查是否是用户主动中止
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[UI] 请求已被用户取消');
          return;
        }
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: t('messages.errorMessage'),
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
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
    // 用户消息添加后立即平滑滚动到底部
    scrollToBottom(true);
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

      // 创建新的 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        await chatAPI.sendMessageStream(
          currentInput,
          messages,
          (content: string, done: boolean) => {
            // 只有在收到有实际内容的数据时才添加消息并退出思考状态
            if (content && content.length > 0 && !hasAddedStreamingMessageRef.current) {
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
              // 流式输出期间，如果用户在底部附近且没有手动向上滚动，持续跟随滚动
              // 浏览器会在用户手动滚动时自动中断平滑滚动动画，这里我们额外检查 isUserScrolling 状态
              if (isNearBottom() && !isUserScrolling) {
                scrollToBottom();
              }
            }
            
            if (done) {
              setStreamingMessageId(null);
              setIsStreamingThinking(false);
              hasAddedStreamingMessageRef.current = false;
              setIsLoading(false);
              abortControllerRef.current = null;
              // 回答完成后触发fast建议（显式传入本次问题）
              attachFastSuggestions(assistantMessageId, content || '', currentInput);
              // 自动保存会话
              saveCurrentSession();
            }
          },
          (error: string) => {
            // 检查是否是用户中止
            if (error === '请求已取消') {
              console.log('[UI] 请求已被用户取消');
              setIsStreamingThinking(false);
              setStreamingMessageId(null);
              hasAddedStreamingMessageRef.current = false;
              setIsLoading(false);
              abortControllerRef.current = null;
              return;
            }
            // 错误处理：停止思考状态并添加错误消息
            setIsStreamingThinking(false);
            setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
            setStreamingMessageId(null);
            hasAddedStreamingMessageRef.current = false;
            setIsLoading(false);
            abortControllerRef.current = null;
          },
          abortController.signal
        );
      } catch (error) {
        // 检查是否是用户主动中止
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[UI] 请求已被用户取消');
          setIsStreamingThinking(false);
          setStreamingMessageId(null);
          hasAddedStreamingMessageRef.current = false;
          setIsLoading(false);
          abortControllerRef.current = null;
          return;
        }
        // 异常处理：停止思考状态并添加错误消息
        setIsStreamingThinking(false);
        setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
        setStreamingMessageId(null);
        hasAddedStreamingMessageRef.current = false;
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    } else {
      // 非流式传输模式
      // 创建新的 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await chatAPI.sendMessage(currentInput, messages, abortController.signal);
        
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: response,
          timestamp: Date.now()
        };

        setMessages(prev => [...prev, assistantMessage]);
        // 非流式也触发fast建议（显式传入本次问题）
        attachFastSuggestions(assistantMessage.id, response, currentInput);
        // 自动保存会话
        saveCurrentSession();
      } catch (error) {
        // 检查是否是用户主动中止
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[UI] 请求已被用户取消');
          return;
        }
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: t('messages.errorMessage'),
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
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

    if (isStreamingEnabled) {
      // 流式传输编辑后的问题
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

      // 创建新的 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        await chatAPI.sendMessageStream(
          editValue.trim(),
          newMessages,
          (content: string, done: boolean) => {
            // 只有在收到有实际内容的数据时才添加消息并退出思考状态
            if (content && content.length > 0 && !hasAddedStreamingMessageRef.current) {
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
              // 流式输出期间，如果用户在底部附近且没有手动向上滚动，持续跟随滚动
              // 浏览器会在用户手动滚动时自动中断平滑滚动动画，这里我们额外检查 isUserScrolling 状态
              if (isNearBottom() && !isUserScrolling) {
                scrollToBottom();
              }
            }

            if (done) {
              setStreamingMessageId(null);
              setIsStreamingThinking(false);
              hasAddedStreamingMessageRef.current = false;
              setIsLoading(false);
              abortControllerRef.current = null;
              attachFastSuggestions(assistantMessageId, content || '', editValue.trim());
              setEditValue('');
              // 自动保存会话
              saveCurrentSession();
            }
          },
          (error: string) => {
            // 检查是否是用户中止
            if (error === '请求已取消') {
              console.log('[UI] 请求已被用户取消');
              setIsStreamingThinking(false);
              setStreamingMessageId(null);
              hasAddedStreamingMessageRef.current = false;
              setIsLoading(false);
              abortControllerRef.current = null;
              setEditValue('');
              return;
            }
            // 错误处理：停止思考状态并添加错误消息
            setIsStreamingThinking(false);
            setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
            setStreamingMessageId(null);
            hasAddedStreamingMessageRef.current = false;
            setIsLoading(false);
            abortControllerRef.current = null;
            setEditValue('');
          },
          abortController.signal
        );
      } catch (error) {
        // 检查是否是用户主动中止
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[UI] 请求已被用户取消');
          setIsStreamingThinking(false);
          setStreamingMessageId(null);
          hasAddedStreamingMessageRef.current = false;
          setIsLoading(false);
          abortControllerRef.current = null;
          setEditValue('');
          return;
        }
        // 异常处理：停止思考状态并添加错误消息
        setIsStreamingThinking(false);
        setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
        setStreamingMessageId(null);
        hasAddedStreamingMessageRef.current = false;
        setIsLoading(false);
        abortControllerRef.current = null;
        setEditValue('');
      }
    } else {
      // 非流式传输模式
      // 创建新的 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await chatAPI.sendMessage(editValue.trim(), newMessages, abortController.signal);
        
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: response,
          timestamp: Date.now()
        };

        setMessages(prev => [...prev, assistantMessage]);
        attachFastSuggestions(assistantMessage.id, response, editValue.trim());
        // 自动保存会话
        saveCurrentSession();
      } catch (error) {
        // 检查是否是用户主动中止
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[UI] 请求已被用户取消');
          return;
        }
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: t('messages.errorMessage'),
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
        setEditValue('');
      }
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

      // 创建新的 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        await chatAPI.sendMessageStream(
          userMessage.content,
          newMessages,
          (content: string, done: boolean) => {
            // 只有在收到有实际内容的数据时才添加消息并退出思考状态
            if (content && content.length > 0 && !hasAddedStreamingMessageRef.current) {
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
              // 流式输出期间，如果用户在底部附近且没有手动向上滚动，持续跟随滚动
              // 浏览器会在用户手动滚动时自动中断平滑滚动动画，这里我们额外检查 isUserScrolling 状态
              if (isNearBottom() && !isUserScrolling) {
                scrollToBottom();
              }
            }
            
            if (done) {
              setStreamingMessageId(null);
              setIsStreamingThinking(false);
              hasAddedStreamingMessageRef.current = false;
              setIsLoading(false);
              abortControllerRef.current = null;
              attachFastSuggestions(assistantMessageId, content || '', userMessage.content);
              // 自动保存会话
              saveCurrentSession();
            }
          },
          (error: string) => {
            // 检查是否是用户中止
            if (error === '请求已取消') {
              console.log('[UI] 请求已被用户取消');
              setIsStreamingThinking(false);
              setStreamingMessageId(null);
              hasAddedStreamingMessageRef.current = false;
              setIsLoading(false);
              abortControllerRef.current = null;
              return;
            }
            // 错误处理：停止思考状态并添加错误消息
            setIsStreamingThinking(false);
            setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
            setStreamingMessageId(null);
            hasAddedStreamingMessageRef.current = false;
            setIsLoading(false);
            abortControllerRef.current = null;
          },
          abortController.signal
        );
      } catch (error) {
        // 检查是否是用户主动中止
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[UI] 请求已被用户取消');
          setIsStreamingThinking(false);
          setStreamingMessageId(null);
          hasAddedStreamingMessageRef.current = false;
          setIsLoading(false);
          abortControllerRef.current = null;
          return;
        }
        // 异常处理：停止思考状态并添加错误消息
        setIsStreamingThinking(false);
        setMessages(prev => [...prev, { ...assistantMessage, content: t('messages.errorMessage') }]);
        setStreamingMessageId(null);
        hasAddedStreamingMessageRef.current = false;
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    } else {
      // 非流式传输模式
      // 创建新的 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await chatAPI.sendMessage(userMessage.content, newMessages, abortController.signal);
        
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: response,
          timestamp: Date.now()
        };

        setMessages(prev => [...prev, assistantMessage]);
        attachFastSuggestions(assistantMessage.id, response, userMessage.content);
        // 自动保存会话
        saveCurrentSession();
      } catch (error) {
        // 检查是否是用户主动中止
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[UI] 请求已被用户取消');
          return;
        }
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: t('messages.errorMessage'),
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
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
    // 清空对话时重置会话ID
    setCurrentSessionId(null);
  };

  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };

  // 复制消息
  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      const success = await copyToClipboard(content);
      if (success) {
        // 清除之前的定时器（如果有）
        if (copyTimerRef.current) {
          clearTimeout(copyTimerRef.current);
        }
        // 设置复制成功状态
        setCopiedMessageId(messageId);
        console.log('[复制] 消息已复制到剪贴板', messageId);
        // 2秒后自动恢复
        copyTimerRef.current = setTimeout(() => {
          setCopiedMessageId(null);
          copyTimerRef.current = null;
        }, 2000);
      } else {
        console.error('[复制] 复制失败', messageId);
      }
    } catch (error) {
      console.error('[复制] 复制错误:', error, messageId);
    }
  };
  
  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // 消息反馈
  const handleMessageFeedback = async (messageId: string, feedback: 'like' | 'dislike') => {
    // 更新UI状态
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, feedback: msg.feedback === feedback ? null : feedback }
        : msg
    ));

    // 如果是取消反馈，不保存
    const currentMessage = messages.find(msg => msg.id === messageId);
    if (currentMessage?.feedback === feedback) {
      return;
    }

    // 保存反馈到服务器
    try {
      await chatAPI.saveFeedback(feedback, messages, messageId);
      console.log(`[反馈] ${feedback}保存成功`);
    } catch (error) {
      console.error(`[反馈] ${feedback}保存失败:`, error);
      // 保存失败不影响UI状态，静默失败
    }
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

  // ==================== 语音输入相关功能 ====================
  
  // 检查浏览器是否支持语音识别
  const checkSpeechRecognitionSupport = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return !!SpeechRecognition;
  }, []);

  // 检查是否支持 getUserMedia（需要 HTTPS 或 localhost）
  const checkMediaDevicesSupport = useCallback(() => {
    // 检查 navigator.mediaDevices 是否存在
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // 检查是否是 HTTP（非 HTTPS）环境
      const isHttp = window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      if (isHttp) {
        return {
          supported: false,
          reason: 'https',
          message: '语音输入功能需要 HTTPS 环境，请使用 HTTPS 访问或使用 localhost'
        };
      }
      return {
        supported: false,
        reason: 'not_supported',
        message: '浏览器不支持语音输入功能'
      };
    }
    return {
      supported: true,
      reason: null,
      message: null
    };
  }, []);

  // 检查浏览器是否支持录音
  const checkMediaRecorderSupport = useCallback(() => {
    const support = checkMediaDevicesSupport();
    return support.supported && !!window.MediaRecorder;
  }, [checkMediaDevicesSupport]);

  // 请求麦克风权限
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    // 先检查是否支持
    const support = checkMediaDevicesSupport();
    if (!support.supported) {
      console.error('[语音输入] 不支持麦克风访问:', support.message);
      setHasPermission(false);
      setRecordingError(support.message);
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // 立即停止，只是测试权限
      setHasPermission(true);
      setRecordingError(null);
      return true;
    } catch (error: any) {
      console.error('[语音输入] 麦克风权限请求失败:', error);
      setHasPermission(false);
      if (error.name === 'NotAllowedError') {
        setRecordingError('需要麦克风权限才能使用语音输入，请在浏览器设置中允许麦克风权限');
      } else if (error.name === 'NotFoundError') {
        setRecordingError('未检测到麦克风设备，请检查设备连接');
      } else if (error.name === 'NotSupportedError') {
        setRecordingError('浏览器不支持麦克风访问，请使用 HTTPS 或 localhost');
      } else {
        setRecordingError('无法访问麦克风，请检查设备权限或使用 HTTPS 环境');
      }
      return false;
    }
  }, [checkMediaDevicesSupport]);

  // 清理音频资源
  const cleanupAudioResources = useCallback(() => {
    console.log('[语音输入] 清理音频资源');
    
    // 检查是否正在初始化，如果是则延迟清理
    if (isInitializingRef.current) {
      console.log('[语音输入] ⚠️ 正在初始化，延迟清理资源');
      setTimeout(() => {
        cleanupAudioResources();
      }, 100);
      return;
    }
    
    // 检查录音状态，如果仍在录音则不允许清理
    if (isRecordingRef.current) {
      console.log('[语音输入] ⚠️ 仍在录音中，不允许清理资源');
      return;
    }
    
    // 停止音频流
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        if (track.readyState !== 'ended') {
          track.stop();
        }
      });
      mediaStreamRef.current = null;
    }

    // 参考微软SDK：严格按照 ScriptProcessorNode -> MediaStream -> AudioContext 的顺序清理
    
    // 1. 先断开ScriptProcessorNode（必须在AudioContext关闭前）
    if (scriptProcessorRef.current && audioContextRef.current) {
      try {
        scriptProcessorRef.current.disconnect(audioContextRef.current.destination);
        console.log('[语音输入] ScriptProcessorNode已断开');
      } catch (err) {
        // 忽略已经断开的错误
        console.debug('[语音输入] ScriptProcessorNode断开失败（可能已断开）:', err);
      }
      scriptProcessorRef.current = null;
    }

    // 2. 停止MediaStream tracks（参考微软SDK：在断开ScriptProcessorNode之后）
    // 注意：这已经在上面做了，但确保顺序正确

    // 3. 最后关闭或暂停AudioContext（参考微软SDK）
    if (audioContextRef.current) {
      try {
        // 参考微软SDK：检查是否有close方法，有则关闭，否则暂停
        const hasClose = 'close' in audioContextRef.current;
        if (hasClose) {
          if (audioContextRef.current.state !== 'closed') {
            console.log('[语音输入] 关闭AudioContext，当前状态:', audioContextRef.current.state);
            audioContextRef.current.close().then(() => {
              console.log('[语音输入] AudioContext已关闭');
            }).catch(err => {
              // 忽略已经关闭的错误
              if (err.name !== 'InvalidStateError') {
                console.error('[语音输入] 关闭AudioContext失败:', err);
              }
            });
          } else {
            console.log('[语音输入] AudioContext已经是关闭状态，跳过关闭');
          }
          audioContextRef.current = null;
        } else if (audioContextRef.current.state === 'running') {
          // 如果没有close方法，尝试暂停（参考微软SDK）
          console.log('[语音输入] AudioContext不支持close，尝试暂停');
          audioContextRef.current.suspend();
          audioContextRef.current = null;
        }
      } catch (err) {
        // 忽略错误
        console.debug('[语音输入] AudioContext关闭检查失败:', err);
        audioContextRef.current = null;
      }
    }
    
    analyserRef.current = null;

    // 取消动画帧
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 关闭语音识别服务
    speechRecognitionService.close().catch(err => {
      console.error('[语音输入] 关闭语音识别服务失败:', err);
    });
    
    // 清除初始化标志（如果还在设置中）
    isInitializingRef.current = false;
  }, []);

  // 绘制音波效果
  const drawWaveform = useCallback(() => {
    if (!waveformCanvasRef.current || !analyserRef.current || !audioContextRef.current) {
      return;
    }

    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * canvas.height;
      
      const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
      gradient.addColorStop(0, isDarkMode ? '#3b82f6' : '#2563eb');
      gradient.addColorStop(1, isDarkMode ? '#60a5fa' : '#3b82f6');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

      x += barWidth + 1;
    }

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    }
  }, [isRecording, isDarkMode]);

  // 开始录音
  const startRecording = useCallback(async () => {
    // 设置初始化标志，防止过早清理
    isInitializingRef.current = true;
    recordingStartTimeRef.current = Date.now();
    
    try {
      console.log('[语音输入] 开始录音（初始化中...）');
      
      // 先检查是否支持
      const support = checkMediaDevicesSupport();
      if (!support.supported) {
        console.error('[语音输入] 不支持麦克风访问:', support.message);
        setRecordingError(support.message);
        setInputMode('keyboard');
        isInitializingRef.current = false;
        return;
      }
      
      // 请求权限
      if (hasPermission === null || hasPermission === false) {
        const granted = await requestMicrophonePermission();
        if (!granted) {
          setInputMode('keyboard');
          isInitializingRef.current = false;
          return;
        }
      }

      // 确定使用的模式（从配置读取）
      voiceInputModeRef.current = appConfig.voiceInputVadMode !== false ? 'vad' : 'manual';

      // 重置识别状态
      currentTranscriptRef.current = '';
      setRecognizedText(null);
      setIsRecognizing(true);
      setRecordingError(null);

      // 先连接WebSocket，等待通路完全打通
      console.log('[语音输入] 先连接WebSocket，等待通路完全打通...');
      try {
        await speechRecognitionService.start({
          mode: voiceInputModeRef.current,
          language: appConfig.voiceInputLanguage || 'zh'
        });
        console.log('[语音输入] ✅ WebSocket连接成功，通路完全打通，可以开始录音');
      } catch (error: any) {
        console.error('[语音输入] ❌ WebSocket连接失败:', error);
        setRecordingError(`连接失败: ${error.message}`);
        setIsRecognizing(false);
        setInputMode('keyboard');
        isInitializingRef.current = false;
        return;
      }

      // 注册语音识别服务回调
      speechRecognitionService.removeCallbacks();
      
      speechRecognitionService.onTranscript((text, isFinal) => {
        console.log('[语音输入] 识别结果:', text, 'isFinal:', isFinal);
        
        // 实时更新识别结果（最佳实践：同时更新recognizedText和inputValue，让用户看到结果）
        currentTranscriptRef.current = text;
        setRecognizedText(text);
        setInputValue(text); // 同步到inputValue，让用户看到识别结果
        
        if (isFinal) {
          // 最终结果
          console.log('[语音输入] ✅ 最终识别结果:', text);
          setIsRecognizing(false);
          setIsRecording(false);
          isRecordingRef.current = false; // 更新ref
          
          // 停止录音
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
          }
          
          // 清理资源
          cleanupAudioResources();
        } else {
          // 实时增量结果
          console.log('[语音输入] 📝 实时识别结果:', text);
        }
      });

      speechRecognitionService.onError((error) => {
        console.error('[语音输入] 识别错误:', error);
        setRecordingError(`识别失败: ${error}`);
        setIsRecognizing(false);
        setIsRecording(false);
        isRecordingRef.current = false; // 更新ref
        cleanupAudioResources();
      });

      speechRecognitionService.onComplete(() => {
        console.log('[语音输入] 识别完成');
        setIsRecognizing(false);
        setIsRecording(false);
        isRecordingRef.current = false; // 更新ref
      });

      // 获取音频流（再次检查确保支持）
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('浏览器不支持麦克风访问，请使用 HTTPS 或 localhost');
      }

      // 创建AudioContext用于实时音频处理（参考微软SDK：在getUserMedia之前创建）
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      
      console.log('[语音输入] AudioContext已创建，状态:', audioContext.state, '采样率:', audioContext.sampleRate);
      
      // 如果音频上下文的采样率不是16000，需要重采样
      if (audioContext.sampleRate !== 16000) {
        console.warn('[语音输入] 音频上下文采样率不是16000Hz，将进行重采样:', audioContext.sampleRate);
      }

      // 参考微软SDK：在getUserMedia之前检查并恢复AudioContext状态
      if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
        console.log('[语音输入] AudioContext状态不是running，当前状态:', audioContext.state);
        await audioContext.resume();
        console.log('[语音输入] AudioContext已恢复，新状态:', audioContext.state);
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const source = audioContext.createMediaStreamSource(stream);
      console.log('[语音输入] MediaStreamSource已创建');
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      console.log('[语音输入] Analyser已连接');

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // 初始化canvas并开始绘制音波
      if (waveformCanvasRef.current) {
        const canvas = waveformCanvasRef.current;
        canvas.width = canvas.offsetWidth;
        canvas.height = 40;
        drawWaveform();
      }

      // 先设置录音状态，确保音频处理立即开始
      setIsRecording(true);
      isRecordingRef.current = true; // 更新ref（必须在audioProcess之前设置）

      // 确保AudioContext处于运行状态（再次检查，防止状态变化）
      // AudioContext.state 可能是: 'suspended' | 'running' | 'closed' | 'interrupted'
      if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
        console.log('[语音输入] AudioContext状态不是running，当前状态:', audioContext.state);
        await audioContext.resume();
        console.log('[语音输入] AudioContext已恢复，新状态:', audioContext.state);
      } else if (audioContext.state === 'closed') {
        console.error('[语音输入] ❌ AudioContext已被关闭，无法继续录音');
        throw new Error('AudioContext已被关闭');
      }

      // 创建ScriptProcessorNode用于实时音频处理
      // ScriptProcessorNode已废弃，但为了兼容性仍使用
      // 未来可以改用AudioWorklet
      // 参考微软SDK：先尝试bufferSize=0（让浏览器自动决定），失败后使用默认值
      let scriptProcessor: ScriptProcessorNode;
      let bufferSize = 0;
      try {
        scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        console.log('[语音输入] ScriptProcessor已创建，bufferSize:', bufferSize, '(浏览器自动决定)');
      } catch (error) {
        // 如果bufferSize=0失败，使用默认值4096或根据采样率动态调整
        bufferSize = 4096;
        const audioSampleRate = audioContext.sampleRate;
        // 参考微软SDK：根据采样率动态调整bufferSize
        while (bufferSize < 16384 && audioSampleRate >= (2 * 16000)) {
          bufferSize <<= 1;
        }
        scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        console.log('[语音输入] ScriptProcessor已创建，bufferSize:', bufferSize, '(使用默认值)');
      }
      
      // 音频块计数器（用于调试）- 使用 ref 以便在外部访问
      const audioChunkCountRef = { current: 0 };
      
      scriptProcessor.onaudioprocess = async (event) => {
        // 每次音频处理都记录（调试用）
        audioChunkCountRef.current++;
        
        // 每10次输出一次日志，确保能看到所有处理过程
        if (audioChunkCountRef.current <= 10 || audioChunkCountRef.current % 10 === 0) {
          console.log('[语音输入] ✅ onaudioprocess触发 #', audioChunkCountRef.current, 'isRecordingRef:', isRecordingRef.current, 'isReady:', speechRecognitionService.isReady(), 'audioContext.state:', audioContext.state);
        }
        
        // 检查AudioContext状态（关键：如果被关闭，停止处理）
        if (audioContext.state === 'closed') {
          if (audioChunkCountRef.current <= 10 || audioChunkCountRef.current % 10 === 0) {
            console.warn('[语音输入] ⚠️ AudioContext已关闭，停止音频处理 #', audioChunkCountRef.current);
          }
          return;
        }
        
        // 检查录音状态（使用ref检查，避免闭包问题）
        // 注意：即使用户停止录音，如果 WebSocket 已就绪，仍然发送音频数据
        // 这样可以确保所有音频数据都被发送，直到 AudioContext 被关闭
        if (!isRecordingRef.current && !speechRecognitionService.isReady()) {
          if (audioChunkCountRef.current <= 10 || audioChunkCountRef.current % 10 === 0) {
            console.log('[语音输入] 录音已停止且WebSocket未就绪，跳过音频处理 #', audioChunkCountRef.current);
          }
          return;
        }
        
        if (!mediaStreamRef.current) {
          if (audioChunkCountRef.current <= 10 || audioChunkCountRef.current % 10 === 0) {
            console.log('[语音输入] 媒体流不存在，跳过音频处理 #', audioChunkCountRef.current);
          }
          return;
        }

        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // 计算最大振幅（用于调试）
        let maxAmplitude = 0;
        for (let i = 0; i < inputData.length; i++) {
          const abs = Math.abs(inputData[i]);
          if (abs > maxAmplitude) {
            maxAmplitude = abs;
          }
        }
        
        // 注释掉静音检测，确保所有音频数据都发送（由服务器端VAD处理）
        // if (maxAmplitude < 0.001) {
        //   return;
        // }
        
        // 将Float32Array转换为Int16Array (PCM16)
        // 标准PCM16转换：将-1.0到1.0的浮点数转换为-32768到32767的整数
        const pcm16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // 限制范围到[-1, 1]
          const s = Math.max(-1, Math.min(1, inputData[i]));
          // 转换为16位整数：s * 32768，然后限制到Int16范围
          pcm16Data[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32768)));
        }

        // 将Int16Array转换为ArrayBuffer
        const audioBuffer = pcm16Data.buffer;

        // 发送音频数据到语音识别服务（连接确认后才开始录音，所以一定已就绪）
        try {
          await speechRecognitionService.sendAudio(audioBuffer);
          
          // 每100次发送一次调试日志（避免日志过多）
          if (audioChunkCountRef.current % 100 === 0) {
            console.log('[语音输入] 已发送音频块:', audioChunkCountRef.current, '大小:', audioBuffer.byteLength, 'bytes', '最大振幅:', maxAmplitude.toFixed(4), 'isRecordingRef:', isRecordingRef.current);
          }
          
          // 前10次和每10次也输出日志，确保发送正常
          if (audioChunkCountRef.current <= 10 || audioChunkCountRef.current % 10 === 0 || audioChunkCountRef.current <= 50) {
            console.log('[语音输入] ✅ 发送音频块:', audioChunkCountRef.current, '大小:', audioBuffer.byteLength, 'bytes', '最大振幅:', maxAmplitude.toFixed(4), 'isRecordingRef:', isRecordingRef.current);
          }
        } catch (error) {
          // 关键：记录所有发送错误，确保能看到问题
          console.error('[语音输入] ❌ 发送音频数据失败 #', audioChunkCountRef.current, ':', error, 'isRecordingRef:', isRecordingRef.current, 'isReady:', speechRecognitionService.isReady());
          // 不中断录音，继续发送
        }
      };

      // 连接音频处理节点（参考微软SDK：直接连接到destination）
      // 关键：ScriptProcessorNode 必须直接连接到 audioContext.destination 才能触发 onaudioprocess
      // 注意：这会导致音频输出（可能听到回音），但这是触发onaudioprocess的必要条件
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination); // 直接连接到 destination
      
      scriptProcessorRef.current = scriptProcessor;
      
      console.log('[语音输入] ScriptProcessor已直接连接到audioContext.destination');
      
      console.log('[语音输入] ScriptProcessor已连接，开始处理音频');
      console.log('[语音输入] 音频上下文状态:', audioContext.state);
      console.log('[语音输入] 音频上下文采样率:', audioContext.sampleRate);
      console.log('[语音输入] 音频流活动状态:', stream.active);
      console.log('[语音输入] 音频流轨道数:', stream.getAudioTracks().length);
      
      // 检查音频轨道状态
      stream.getAudioTracks().forEach((track, index) => {
        console.log(`[语音输入] 音频轨道 ${index}:`, {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label
        });
      });
      
      // 初始化完成，清除初始化标志
      isInitializingRef.current = false;
      console.log('[语音输入] ✅ 初始化完成，可以开始处理音频');
      
      // 添加一个测试：等待一小段时间后检查是否触发
      setTimeout(() => {
        console.log('[语音输入] 🔍 3秒后检查：isRecordingRef.current =', isRecordingRef.current);
        console.log('[语音输入] 🔍 3秒后检查：isInitializingRef.current =', isInitializingRef.current);
        console.log('[语音输入] 🔍 3秒后检查：audioChunkCount =', audioChunkCountRef.current);
        console.log('[语音输入] 🔍 3秒后检查：audioContext.state =', audioContext.state);
        console.log('[语音输入] 🔍 3秒后检查：stream.active =', stream.active);
        if (audioChunkCountRef.current === 0) {
          console.error('[语音输入] ❌ 错误：3秒内没有触发 onaudioprocess！');
          console.error('[语音输入] ❌ 可能的原因：');
          console.error('[语音输入] ❌ 1. ScriptProcessorNode 未正确连接');
          console.error('[语音输入] ❌ 2. 音频流没有数据');
          console.error('[语音输入] ❌ 3. 浏览器不支持 ScriptProcessorNode');
          console.error('[语音输入] ❌ 4. 音频上下文被暂停');
        } else {
          console.log('[语音输入] ✅ 音频处理正常，已处理', audioChunkCountRef.current, '个音频块');
        }
      }, 3000);


      // 开始录音时长计时
      setRecordingDuration(0);

      // 启动录音时长计时器
      const startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        setRecordingDuration(duration);
        
        // 最长60秒（VAD模式会自动结束，Manual模式需要手动停止）
        if (duration >= 60) {
          stopRecording();
        }
      }, 1000);

      } catch (error: any) {
        console.error('[语音输入] 录音失败:', error);
        setRecordingError(`录音失败: ${error.message}`);
        setIsRecording(false);
        isRecordingRef.current = false; // 更新ref
        isInitializingRef.current = false; // 清除初始化标志
        setIsRecognizing(false);
        setInputMode('keyboard');
        cleanupAudioResources();
      }
  }, [hasPermission, requestMicrophonePermission, drawWaveform, checkMediaDevicesSupport, cleanupAudioResources]);

  // 停止录音
  const stopRecording = useCallback(() => {
    console.log('[语音输入] 停止录音');
    
    // 检查最小录音时长（100ms），防止快速点击导致问题
    const recordingDuration = Date.now() - recordingStartTimeRef.current;
    const minRecordingDuration = 100; // 最小录音时长100ms
    if (recordingDuration < minRecordingDuration) {
      console.log(`[语音输入] 录音时长过短（${recordingDuration}ms），等待最小时长...`);
      setTimeout(() => {
        stopRecording();
      }, minRecordingDuration - recordingDuration);
      return;
    }
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // 先不立即设置 isRecordingRef.current = false
    // 让音频处理继续一段时间，确保所有音频块都被处理
    // 注意：即使用户停止录音，如果 WebSocket 已就绪，仍然继续发送音频数据
    setIsRecording(false);
    // 延迟设置 isRecordingRef，给音频处理时间完成
    // 增加延迟时间，确保所有音频块都被处理（特别是 WebSocket 连接建立前的音频块）
    setTimeout(() => {
      isRecordingRef.current = false;
      console.log('[语音输入] isRecordingRef已设置为false（延迟设置）');
    }, 2000); // 延迟2秒，确保所有音频块都被处理（包括 WebSocket 连接建立前的音频块）

    // 如果是Manual模式，需要提交音频
    if (voiceInputModeRef.current === 'manual') {
      speechRecognitionService.commit().catch(err => {
        console.error('[语音输入] 提交音频失败:', err);
        setRecordingError(`提交音频失败: ${err.message}`);
      });
    }

    // 延迟清理资源，确保音频处理完成
    // 如果正在初始化，等待初始化完成
    if (isInitializingRef.current) {
      console.log('[语音输入] 正在初始化，等待初始化完成后再清理...');
      const checkInterval = setInterval(() => {
        if (!isInitializingRef.current) {
          clearInterval(checkInterval);
          // 等待更长时间，确保音频处理完成
          setTimeout(() => {
            cleanupAudioResources();
          }, 1000); // 增加到1秒，确保音频处理完成
        }
      }, 50);
    } else {
      // 延迟清理，给音频处理时间完成（至少等待一个音频块的处理时间）
      setTimeout(() => {
        cleanupAudioResources();
      }, 1000); // 增加到1秒，确保音频处理完成
    }
  }, [cleanupAudioResources]);

  // 切换输入模式
  const handleToggleInputMode = useCallback(() => {
    // 如果配置关闭了语音输入，不允许切换
    if (!appConfig.enableVoiceInput) {
      return;
    }
    
    if (inputMode === 'voice') {
      // 如果正在录音，先停止
      if (isRecording) {
        stopRecording();
      }
      setInputMode('keyboard');
    } else {
      // 切换到语音模式前，先检查是否支持
      const support = checkMediaDevicesSupport();
      if (!support.supported) {
        console.error('[语音输入] 不支持语音输入:', support.message);
        setRecordingError(support.message);
        // 不切换模式，保持键盘模式
        return;
      }
      // 切换到语音模式
      setInputMode('voice');
      setRecordingError(null);
    }
  }, [inputMode, isRecording, stopRecording, checkMediaDevicesSupport, appConfig.enableVoiceInput]);

  // 发送识别结果
  const handleSendRecognizedText = useCallback(() => {
    const textToSend = recognizedText || inputValue.trim();
    if (textToSend && !isLoading) {
      // 设置输入值并发送
      setInputValue(textToSend);
      setRecognizedText(null);
      setInputMode('keyboard');
      setIsRecognizing(false);
      
      // 使用现有的发送消息函数
      // 需要等待状态更新
      setTimeout(() => {
        handleSendMessage();
      }, 0);
    }
  }, [recognizedText, inputValue, isLoading, handleSendMessage]);

  // 取消识别结果
  const handleCancelRecognizedText = useCallback(() => {
    setRecognizedText(null);
    setInputValue('');
    setIsRecognizing(false);
    setRecordingError(null);
    // 保持语音模式，等待下次录音
  }, []);

  // 处理输入框的鼠标按下事件（语音模式）
  const handleInputMouseDown = useCallback((e: React.MouseEvent) => {
    if (inputMode === 'voice' && !isRecording && !isRecognizing && !recognizedText) {
      e.preventDefault();
      e.stopPropagation();
      
      // 开始录音
      startRecording();
      
      // 在document上添加mouseup监听，确保鼠标移出输入框也能停止录音
      const handleDocumentMouseUp = (event: MouseEvent) => {
        event.preventDefault();
        stopRecording();
        document.removeEventListener('mouseup', handleDocumentMouseUp);
        document.removeEventListener('mouseleave', handleDocumentMouseUp);
      };
      
      // 监听鼠标松开和鼠标离开
      document.addEventListener('mouseup', handleDocumentMouseUp);
      document.addEventListener('mouseleave', handleDocumentMouseUp);
    }
  }, [inputMode, isRecording, isRecognizing, recognizedText, startRecording, stopRecording]);

  // 处理输入框的鼠标松开事件（语音模式）
  const handleInputMouseUp = useCallback((e: React.MouseEvent) => {
    if (inputMode === 'voice' && isRecording) {
      e.preventDefault();
      e.stopPropagation();
      stopRecording();
    }
  }, [inputMode, isRecording, stopRecording]);

  // 处理输入框的触摸事件（移动端）
  const handleInputTouchStart = useCallback((e: React.TouchEvent) => {
    if (inputMode === 'voice' && !isRecording && !isRecognizing) {
      e.preventDefault();
      startRecording();
    }
  }, [inputMode, isRecording, isRecognizing, startRecording]);

  const handleInputTouchEnd = useCallback((e: React.TouchEvent) => {
    if (inputMode === 'voice' && isRecording) {
      e.preventDefault();
      stopRecording();
    }
  }, [inputMode, isRecording, stopRecording]);

  // 清理录音资源（组件卸载时）
  useEffect(() => {
    return () => {
      // 组件卸载时的清理
      console.log('[语音输入] 组件卸载，清理资源');
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stop();
        } catch (err) {
          // 忽略错误
        }
        mediaRecorderRef.current = null;
      }
      // 注意：AudioContext 的关闭应该由 cleanupAudioResources 处理
      // 如果组件卸载时仍在录音，调用 cleanupAudioResources
      if (isRecordingRef.current || audioContextRef.current) {
        console.log('[语音输入] 组件卸载时仍在录音，调用cleanupAudioResources');
        cleanupAudioResources();
      }
    };
  }, []); // 只在组件卸载时执行，不依赖 isRecording

  // 检查浏览器支持，如果不支持则隐藏切换按钮或显示提示
  useEffect(() => {
    // 如果配置关闭了语音输入，强制使用键盘模式
    if (!appConfig.enableVoiceInput) {
      if (inputMode === 'voice') {
        setInputMode('keyboard');
      }
      return;
    }
    
    const support = checkMediaDevicesSupport();
    if (!support.supported) {
      console.log('[语音输入] 浏览器不支持语音功能:', support.message);
      // 如果当前是语音模式，自动切换回键盘模式
      if (inputMode === 'voice') {
        setInputMode('keyboard');
        setRecordingError(support.message);
      }
    }
  }, [checkMediaDevicesSupport, inputMode, appConfig.enableVoiceInput]);

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
      whiteSpace: 'pre-wrap' as const,
      display: 'inline-block',
      maxWidth: '80%'
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
      border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box' as const,
      overflow: 'hidden' as const
    },
    editInput: {
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
      borderRadius: '6px',
      fontSize: '14px',
      lineHeight: '1.5',
      resize: 'none' as const,
      fontFamily: 'inherit',
      outline: 'none',
      transition: 'border-color 0.2s ease',
      backgroundColor: surfaceColor,
      color: textColor,
      boxSizing: 'border-box' as const,
      maxWidth: '100%'
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
      lineHeight: '1.5',
      fontFamily: 'inherit',
      backgroundColor: surfaceColor,
      color: textColor,
      boxSizing: 'border-box' as const
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
    },
    exampleQuestionButtonDisabled: {
      padding: '12px 16px',
      backgroundColor: isDark ? '#1f2937' : '#f9fafb',
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      cursor: 'not-allowed',
      textAlign: 'left' as const,
      color: isDark ? '#4b5563' : '#9ca3af',
      fontSize: '16px',
      opacity: 0.5,
      transition: 'all 0.2s ease'
    },
    stopButton: {
      backgroundColor: '#ef4444',
      color: 'white'
    },
    // 语音输入相关样式
    waveformArea: {
      height: '60px',
      backgroundColor: isDark ? '#2d3748' : '#f8fafc',
      borderBottom: `1px solid ${borderColor}`,
      padding: '8px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px'
    },
    waveformCanvas: {
      width: '100%',
      height: '40px',
      maxWidth: '600px'
    },
    recordingDuration: {
      fontSize: '14px',
      color: mutedColor,
      minWidth: '50px',
      textAlign: 'center' as const
    },
    modeToggleButton: {
      width: '48px',
      height: '48px',
      backgroundColor: inputMode === 'voice' ? '#3b82f6' : (isDark ? '#4b5563' : '#f3f4f6'),
      color: inputMode === 'voice' ? 'white' : mutedColor,
      borderRadius: '16px',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      opacity: 0.7
    },
    modeToggleButtonHover: {
      opacity: 1,
      backgroundColor: inputMode === 'voice' ? '#2563eb' : (isDark ? '#6b7280' : '#e5e7eb')
    },
    voiceTextarea: {
      flex: 1,
      padding: '12px 16px',
      border: `1px solid ${isRecording ? '#ef4444' : (isDarkMode ? '#4b5563' : '#e5e7eb')}`,
      borderRadius: '16px',
      resize: 'none' as const,
      outline: 'none',
      fontSize: '16px',
      lineHeight: '1.5',
      fontFamily: 'inherit',
      backgroundColor: isRecording ? (isDark ? '#4b1f1f' : '#fef2f2') : surfaceColor,
      color: inputMode === 'voice' && !isRecording && !isRecognizing ? mutedColor : textColor,
      boxSizing: 'border-box' as const,
      textAlign: inputMode === 'voice' && !isRecording && !isRecognizing && !recognizedText ? 'center' as const : 'left' as const,
      cursor: inputMode === 'voice' ? 'pointer' : 'text',
      userSelect: 'none' as const,
      transition: 'all 0.3s ease',
      animation: isRecording ? 'pulse 1s infinite' : 'none'
    },
    voiceCancelButton: {
      width: '48px',
      height: '48px',
      backgroundColor: isDark ? '#4b5563' : '#f3f4f6',
      color: mutedColor,
      borderRadius: '16px',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      opacity: 0.7
    },
    voiceCancelButtonHover: {
      opacity: 1,
      backgroundColor: isDark ? '#6b7280' : '#e5e7eb'
    }
  };
};

  return (
    <>
      {/* 历史侧边栏 */}
      <ChatHistorySidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSessionSelect={loadSession}
        onNewChat={handleNewChat}
        currentSessionId={currentSessionId}
        isDarkMode={isDarkMode}
      />
      
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
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
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
        <div style={getStyles().headerActions}>
          {/* 历史记录按钮 */}
          <button
            style={getStyles().actionButton}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, getStyles().actionButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, getStyles().actionButton);
            }}
            title="历史记录"
          >
            <Menu size={18} />
          </button>
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
          {/* 管理员面板入口 */}
          {isAdmin && (
            <button
              style={getStyles().actionButton}
              onClick={() => setShowFeedbackAdmin(true)}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, getStyles().actionButtonHover);
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, getStyles().actionButton);
              }}
              title="反馈管理"
            >
              <Settings size={18} />
            </button>
          )}
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
                        enabled={streamingMessageId === message.id} // 只对当前流式消息启用打字机
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
                        style={{
                          ...getStyles().actionButton,
                          ...(copiedMessageId === message.id ? { color: '#10b981' } : {})
                        }}
                        onClick={() => handleCopyMessage(message.id, message.content)}
                        onMouseEnter={(e) => {
                          if (copiedMessageId !== message.id) {
                            Object.assign(e.currentTarget.style, getStyles().actionButtonHover);
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (copiedMessageId !== message.id) {
                            Object.assign(e.currentTarget.style, getStyles().actionButton);
                          } else {
                            e.currentTarget.style.color = '#10b981';
                          }
                        }}
                        title={copiedMessageId === message.id ? t('messages.copySuccess') : t('ui.copy')}
                      >
                        {copiedMessageId === message.id ? (
                          <Check size={14} style={{ transition: 'all 0.2s ease' }} />
                        ) : (
                          <Copy size={14} style={{ transition: 'all 0.2s ease' }} />
                        )}
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

                  {/* fast 建议问题（仅在该AI消息下方显示） */}
                  {message.role === 'assistant' && Array.isArray(message.suggestedQuestions) && message.suggestedQuestions.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                      {message.suggestedQuestions.slice(0, appConfig.fastSuggestDefaultCount).map((q, idx) => (
                        <button
                          key={idx}
                          disabled={isLoading}
                          style={isLoading ? getStyles().exampleQuestionButtonDisabled : getStyles().exampleQuestionButton}
                          onClick={() => handleExampleClick(q)}
                          onMouseEnter={(e) => { 
                            if (!isLoading) {
                              Object.assign(e.currentTarget.style, getStyles().exampleQuestionButtonHover);
                            }
                          }}
                          onMouseLeave={(e) => { 
                            if (!isLoading) {
                              Object.assign(e.currentTarget.style, getStyles().exampleQuestionButton);
                            }
                          }}
                          title={q}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* 编辑模式 */}
                  {message.role === 'assistant' && editingMessageId === message.id && (
                    <div ref={editContainerRef} style={getStyles().editContainer}>
                      <textarea
                        ref={editTextareaRef}
                        style={getStyles().editInput}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder={t('ui.editPlaceholder')}
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

      {/* 音波效果显示区域（仅录音时显示） */}
      {isRecording && (
        <div style={getStyles().waveformArea}>
          <canvas
            ref={waveformCanvasRef}
            width={600}
            height={40}
            style={getStyles().waveformCanvas}
          />
          <div style={getStyles().recordingDuration}>
            {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:
            {String(recordingDuration % 60).padStart(2, '0')}
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <div style={getStyles().inputArea}>
        <div style={getStyles().inputContainer}>
          <textarea
            ref={mainTextareaRef}
            value={
              isRecognizing 
                ? '识别中...' 
                : inputMode === 'voice' && !isRecording && !isRecognizing && !recognizedText
                  ? '按住说话'
                  : recognizedText || inputValue // 优先显示识别结果
            }
            onChange={(e) => {
              if (inputMode !== 'voice' || isRecognizing || recognizedText) {
                const newValue = e.target.value;
                setInputValue(newValue);
                // 如果用户开始编辑，清除recognizedText，让用户看到自己编辑的内容
                if (recognizedText && newValue !== recognizedText) {
                  setRecognizedText(null);
                }
              }
            }}
            onKeyPress={handleKeyPress}
            placeholder={
              inputMode === 'voice' && !isRecording && !isRecognizing
                ? '按住说话'
                : t('ui.inputPlaceholder')
            }
            readOnly={inputMode === 'voice' && !isRecording && !isRecognizing && !recognizedText}
            onMouseDown={handleInputMouseDown}
            onMouseUp={handleInputMouseUp}
            onTouchStart={handleInputTouchStart}
            onTouchEnd={handleInputTouchEnd}
            onKeyDown={(e) => {
              // 语音模式下阻止键盘输入
              if (inputMode === 'voice' && !isRecording && !isRecognizing && !recognizedText) {
                e.preventDefault();
              }
            }}
            style={
              inputMode === 'voice'
                ? getStyles().voiceTextarea
                : {
                    ...getStyles().textarea,
                    ...(inputValue.trim() ? getStyles().textareaFocus : {})
                  }
            }
          />
          {/* 发送按钮（键盘模式或识别结果时显示） */}
          {(inputMode === 'keyboard' || recognizedText || isRecognizing) && (
            <button
              onClick={
                isRecognizing
                  ? handleCancelRecognizedText
                  : recognizedText
                    ? handleSendRecognizedText
                    : isLoading
                      ? handleStopRequest
                      : handleSendMessage
              }
              disabled={
                isRecognizing
                  ? false
                  : recognizedText
                    ? !recognizedText.trim() && !inputValue.trim()
                    : !isLoading && !inputValue.trim()
              }
              style={{
                ...getStyles().sendButton,
                ...(isLoading ? getStyles().stopButton : {}),
                ...(!isLoading && !inputValue.trim() && !recognizedText ? getStyles().sendButtonDisabled : {})
              }}
              onMouseEnter={(e) => {
                if (isLoading) {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                } else if (inputValue.trim() || recognizedText) {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }
              }}
              onMouseLeave={(e) => {
                if (isLoading) {
                  e.currentTarget.style.backgroundColor = '#ef4444';
                } else if (inputValue.trim() || recognizedText) {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                }
              }}
              title={
                isRecognizing
                  ? '取消'
                  : recognizedText
                    ? '发送'
                    : isLoading
                      ? t('ui.stop')
                      : t('ui.send')
              }
            >
              {isRecognizing ? (
                <X size={20} />
              ) : isLoading ? (
                <Square size={20} />
              ) : (
                <Send size={20} />
              )}
            </button>
          )}
          {/* 取消按钮（识别结果时显示） */}
          {recognizedText && !isRecognizing && (
            <button
              onClick={handleCancelRecognizedText}
              style={getStyles().voiceCancelButton}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, getStyles().voiceCancelButtonHover);
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, getStyles().voiceCancelButton);
              }}
              title="取消"
            >
              <X size={20} />
            </button>
          )}
          {/* 模式切换按钮（右下角）- 仅在启用语音输入时显示，识别结束后隐藏 */}
          {appConfig.enableVoiceInput && !recognizedText && (
            <button
              onClick={handleToggleInputMode}
              style={getStyles().modeToggleButton}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, getStyles().modeToggleButtonHover);
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, getStyles().modeToggleButton);
              }}
              title={inputMode === 'voice' ? '切换到键盘模式' : '切换到语音模式'}
            >
              {inputMode === 'voice' ? <Keyboard size={20} /> : <Mic size={20} />}
            </button>
          )}
        </div>
        {/* 错误提示 */}
        {recordingError && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            backgroundColor: isDarkMode ? '#4b1f1f' : '#fef2f2',
            border: `1px solid ${isDarkMode ? '#7f1d1d' : '#fecaca'}`,
            borderRadius: '8px',
            color: isDarkMode ? '#fca5a5' : '#dc2626',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <X size={16} />
            <span>{recordingError}</span>
            <button
              onClick={() => setRecordingError(null)}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* 反馈管理面板 */}
      {showFeedbackAdmin && (
        <FeedbackAdmin
          isDarkMode={isDarkMode}
          onClose={() => setShowFeedbackAdmin(false)}
        />
      )}
      </div>
      
      {/* 加载遮罩 */}
      {isHistoryLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: isDarkMode ? '#374151' : 'white',
            padding: '24px 32px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: isDarkMode ? '#f9fafb' : '#111827'
          }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
            <span>加载中...</span>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatInterface;

