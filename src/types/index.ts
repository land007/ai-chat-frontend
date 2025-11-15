// 全局类型定义

// 聊天消息类型
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  feedback?: 'like' | 'dislike' | null;
  retryCount?: number;
  isWelcome?: boolean; // 标记是否为欢迎语
  suggestedQuestions?: string[]; // fast建议问题
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
  getQueueRemaining: () => number;
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

// 反馈系统类型
export interface FeedbackData {
  id: string;
  filename: string;
  type: 'like' | 'dislike';
  username: string;
  userId: string;
  timestamp: number;
  messageId: string;
  messages: ChatMessage[];
  metadata: {
    userAgent: string;
    language: string;
    ip: string;
  };
}

export interface FeedbackListItem {
  filename: string;
  type: 'like' | 'dislike';
  username: string;
  timestamp: number;
  messageCount: number;
  mtime: number;
}

export interface FeedbackListResponse {
  success: boolean;
  data: FeedbackListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface FeedbackDetailResponse {
  success: boolean;
  data: FeedbackData;
}

// 历史记录系统类型
// 会话元数据
export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  preview: string;
}

// 会话详情
export interface ChatSessionDetail {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

// 会话列表响应
export interface ChatHistoryListResponse {
  success: boolean;
  data: ChatSession[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// 会话保存响应
export interface ChatHistorySaveResponse {
  success: boolean;
  message: string;
  session: ChatSession;
}

// 会话删除响应
export interface ChatHistoryDeleteResponse {
  success: boolean;
  message: string;
}

// 地图相关类型
// 标记点
export interface MapMarker {
  lat: number;
  lng: number;
  title?: string;
  description?: string;
  icon?: string; // 图标URL或名称
}

// 轨迹点
export interface TrackPoint {
  lat: number;
  lng: number;
  timestamp?: number; // 时间戳（可选）
  description?: string; // 该点的描述信息
}

// 轨迹配置
export interface MapTrack {
  points: TrackPoint[]; // 轨迹点数组
  color?: string; // 轨迹颜色，默认 '#3b82f6'
  weight?: number; // 轨迹宽度，默认 3
  opacity?: number; // 轨迹透明度，默认 0.7
  dashArray?: string; // 虚线样式，如 '5, 5'，不设置则为实线
  title?: string; // 轨迹标题
  description?: string; // 轨迹描述
}

// 地图配置
export interface MapConfig {
  center: [number, number]; // [纬度, 经度]
  zoom?: number; // 缩放级别，默认 13
  markers?: MapMarker[]; // 标记点数组
  tracks?: MapTrack[]; // 轨迹数组
}

// 语音识别相关类型
export type VoiceInputMode = 'vad' | 'manual';

export interface SpeechRecognitionConfig {
  mode: VoiceInputMode;
  language: string;
}

export interface SpeechRecognitionEvent {
  type: 'ready' | 'transcript' | 'error' | 'complete';
  text?: string;
  isFinal?: boolean;
  message?: string;
}

export interface SpeechRecognitionService {
  start: (config: SpeechRecognitionConfig) => Promise<void>;
  sendAudio: (audioData: ArrayBuffer) => Promise<void>;
  commit: () => Promise<void>;
  close: () => Promise<void>;
  onTranscript: (callback: (text: string, isFinal: boolean) => void) => void;
  onError: (callback: (error: string) => void) => void;
  onComplete: (callback: () => void) => void;
}

// 弧形按钮布局相关类型
export interface Point {
  x: number;
  y: number;
}

export type ArcButtonArea = 'cancel' | 'edit' | 'send' | null;

// 按钮配置
export interface ArcButtonConfig {
  text: string;
  icon?: React.ReactNode;
  startAngle: number;
  endAngle: number;
  color?: {
    normal: string;
    highlighted: string;
    border?: string;
    borderHighlighted?: string;
  };
}

// 中心按钮配置
export interface ArcCenterButtonConfig {
  text: string;
  color?: {
    normal: string;
    highlighted: string;
  };
}

// 初始按钮配置
export interface ArcInitialButtonConfig {
  show?: boolean;
  text?: string;
  icon?: React.ReactNode;
  position?: {
    bottom?: number;
  };
  style?: React.CSSProperties;
}

// 布局配置（可选）
export interface ArcLayoutConfig {
  containerHeight?: number;
  arcRadius?: number;
  buttonDistance?: number;
  buttonWidth?: number;
  arcCenterOffset?: number; // 圆心Y坐标偏移量，默认70
  sendAreaWidth?: number; // 发送区域宽度比例，默认0.4 (0.3-0.7)
}

// 样式配置（可选）
export interface ArcStyleConfig {
  containerBackground?: string;
  containerZIndex?: number;
  arcColor?: string;
  cornerRadius?: number;
}

// 弧形按钮布局组件Props
export interface ArcButtonLayoutProps {
  // 回调函数
  onCancel?: () => void;
  onEdit?: () => void;
  onSend?: () => void;
  
  // 按钮配置
  leftButton?: ArcButtonConfig;
  rightButton?: ArcButtonConfig;
  centerButton?: ArcCenterButtonConfig;
  
  // 初始按钮配置
  initialButton?: ArcInitialButtonConfig;
  
  // 布局配置（可选）
  layoutConfig?: ArcLayoutConfig;
  
  // 样式配置（可选）
  styleConfig?: ArcStyleConfig;
  
  // 调试模式
  debug?: boolean;
  
  // 容器样式
  containerStyle?: React.CSSProperties;
  
  // 是否禁用
  disabled?: boolean;
}

// 窗口对象扩展
declare global {
  interface Window {
    // 可以在这里添加全局window对象的扩展
  }
}