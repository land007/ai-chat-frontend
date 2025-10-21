// 全局类型定义
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatRequest {
  message: string;
  contextMessages?: ChatMessage[];
}

export interface ChatResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

export interface StreamEvent {
  type: 'start' | 'content' | 'done' | 'error';
  content?: string;
  timestamp: string;
  error?: string;
  code?: string;
}

export interface EnvironmentConfig {
  DASHSCOPE_API_KEY: string;
  DASHSCOPE_API_URL: string;
  APP_NAME: string;
  APP_DESCRIPTION: string;
  WELCOME_MESSAGE: string;
  CONTEXT_MESSAGE_COUNT: number;
}

export interface DashScopeRequest {
  input: {
    prompt: string;
  };
  parameters: Record<string, unknown>;
  debug: Record<string, unknown>;
}

export interface DashScopeResponse {
  output: {
    text: string;
    finish_reason?: string;
  };
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

export interface ConfigResponse {
  name: string;
  description: string;
  welcomeMessage: string;
  tts: {
    enabled: boolean;
    apiUrl: string;
  };
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
}

// TTS相关类型
export interface TTSConfig {
  enabled: boolean;
  apiUrl: string;
  voice?: string;
  speed?: number;
  volume?: number;
}

export interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
  volume?: number;
}

export interface TTSResponse {
  audioUrl: string;
  duration: number;
}

// 组件Props类型
export interface ChatInterfaceProps {
  className?: string;
}

export interface TTSControlsProps {
  onToggle: () => void;
  onSpeedChange: (speed: number) => void;
  isPlaying: boolean;
  speed: number;
}

export interface TextHighlighterProps {
  text: string;
  highlights?: string[];
  className?: string;
}

export interface TypewriterEffectProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}


