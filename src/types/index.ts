// 全局类型定义

// 聊天消息类型
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  feedback?: 'like' | 'dislike' | null;
  retryCount?: number;
}

// API响应类型
export interface ChatResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

// API错误类型
export interface ChatError {
  error: string;
  code: string;
  details?: any;
}

// 流式传输数据块类型
export interface StreamChunk {
  content: string;
  done: boolean;
  timestamp: string;
}

// 流式传输错误类型
export interface StreamError {
  error: string;
  code: string;
  details?: any;
}

// 应用配置类型
export interface AppConfig {
  name: string;
  description: string;
  welcomeMessage: string;
}

// 组件Props类型
export interface ChatInterfaceProps {
  className?: string;
}

export interface TypewriterEffectProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
  style?: React.CSSProperties;
  enabled?: boolean;
  isDarkMode?: boolean;
  isStreaming?: boolean;
  isThinking?: boolean;
}

// 主题类型
export type Theme = 'light' | 'dark';

// 语言类型
export type Language = 'zh' | 'en';

// 反馈类型
export type Feedback = 'like' | 'dislike' | null;

// 消息角色类型
export type MessageRole = 'user' | 'assistant';

// 工具函数类型
export type GenerateId = () => string;

// 事件处理器类型
export type EventHandler<T = Event> = (event: T) => void;
export type KeyboardEventHandler = (event: React.KeyboardEvent) => void;
export type MouseEventHandler = (event: React.MouseEvent) => void;
export type ChangeEventHandler = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

// 样式类型
export interface Styles {
  [key: string]: React.CSSProperties;
}

// 国际化类型
export interface TranslationFunction {
  (key: string, options?: any): string;
}

export interface I18nInstance {
  language: Language;
  changeLanguage: (lng: Language) => Promise<void>;
}

// 文本分段相关类型
export interface TextSegment {
  id: string;
  text: string;
  type: 'paragraph' | 'code' | 'heading' | 'list' | 'quote' | 'table';
  isComplete: boolean;
}

// 音频队列相关类型
export interface AudioQueueItem {
  url: string;
  textRef: any;
}

export interface AudioQueuePlayerHandle {
  enqueue: (item: AudioQueueItem) => void;
  pause: () => void;
  resume: () => void;
  clear: () => void;
  isPlaying: () => boolean;
  setAutoPlay: (autoPlay: boolean) => void;
}

export interface AudioQueuePlayerProps {
  onPlayingChange?: (textRef: any) => void;
  autoPlay?: boolean;
}

// 环境变量类型
export interface EnvironmentVariables {
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_API_URL?: string;
  APP_NAME?: string;
  APP_DESCRIPTION?: string;
  WELCOME_MESSAGE?: string;
  CONTEXT_MESSAGE_COUNT?: string;
  PORT?: string;
  NODE_ENV?: 'development' | 'production' | 'test';
}

// 窗口对象扩展
declare global {
  interface Window {
    // 可以在这里添加全局window对象的扩展
  }
}