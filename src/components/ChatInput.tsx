import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, X, Mic, Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { speechRecognitionService } from '@/services/speechRecognition';
import FourDotWaveform from './FourDotWaveform';

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  enableVoiceInput?: boolean;
  voiceInputLanguage?: string;
  isDarkMode?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onStop,
  isLoading = false,
  enableVoiceInput = true,
  voiceInputLanguage = 'zh',
  isDarkMode = false,
  placeholder,
  disabled = false
}) => {
  const { t } = useTranslation();
  
  // 语音输入相关状态
  const [inputMode, setInputMode] = useState<'keyboard' | 'voice'>('keyboard');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedText, setRecognizedText] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [showDebugLog, setShowDebugLog] = useState(false); // 显示调试日志开关
  const [debugLogs, setDebugLogs] = useState<string[]>([]); // 调试日志数组
  
  // 录音相关refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const currentTranscriptRef = useRef<string>(''); // 当前累积的识别文本（已废弃，保留用于兼容）
  const finalTextRef = useRef<string>(''); // 所有已确定段落的累加文本（游标之前的内容，确定不变）
  const currentSegmentRef = useRef<string>(''); // 当前正在识别的段落（游标位置，不确定的，实时更新）
  const voiceInputModeRef = useRef<'vad' | 'manual'>('vad'); // 当前使用的模式
  const isRecordingRef = useRef<boolean>(false); // 录音状态ref（用于闭包中访问）
  const isInitializingRef = useRef<boolean>(false); // 初始化状态ref（防止过早清理）
  const recordingStartTimeRef = useRef<number>(0); // 录音开始时间（用于最小录音时长保护）
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 识别超时定时器ref
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 关闭连接超时定时器ref（如果服务器2秒内未关闭，客户端主动关闭）
  const mainTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const audioBufferRef = useRef<ArrayBuffer[]>([]); // 音频缓冲区：存储连接建立前的音频数据
  const isConnectionReadyRef = useRef<boolean>(false); // 连接是否已就绪
  const isSendingBufferedRef = useRef<boolean>(false); // 是否正在发送缓冲音频
  const maxBufferSize = 150; // 最大缓冲音频块数（约3秒，假设50块/秒）
  const touchStartTimerRef = useRef<NodeJS.Timeout | null>(null); // 延迟开始录音的定时器（移动端按住检测）
  const isTouchHoldingRef = useRef<boolean>(false); // 标记用户是否正在按住（用于区分点击和按住）
  
  // 检测是否为触摸设备
  const isTouchDevice = useCallback(() => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  // 检查是否支持 getUserMedia（需要 HTTPS 或 localhost）
  const checkMediaDevicesSupport = useCallback(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
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

  // 请求麦克风权限
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    const support = checkMediaDevicesSupport();
    if (!support.supported) {
      console.error('[语音输入] 不支持麦克风访问:', support.message);
      setHasPermission(false);
      setRecordingError(support.message);
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
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
    
    // 清除关闭超时定时器
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    
    if (isInitializingRef.current) {
      console.log('[语音输入] ⚠️ 正在初始化，延迟清理资源');
      setTimeout(() => {
        cleanupAudioResources();
      }, 100);
      return;
    }
    
    if (isRecordingRef.current) {
      console.log('[语音输入] ⚠️ 仍在录音中，不允许清理资源');
      return;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        if (track.readyState !== 'ended') {
          track.stop();
        }
      });
      mediaStreamRef.current = null;
    }

    if (scriptProcessorRef.current && audioContextRef.current) {
      try {
        scriptProcessorRef.current.disconnect(audioContextRef.current.destination);
        console.log('[语音输入] ScriptProcessorNode已断开');
      } catch (err) {
        console.debug('[语音输入] ScriptProcessorNode断开失败（可能已断开）:', err);
      }
      scriptProcessorRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        const hasClose = 'close' in audioContextRef.current;
        if (hasClose) {
          if (audioContextRef.current.state !== 'closed') {
            console.log('[语音输入] 关闭AudioContext，当前状态:', audioContextRef.current.state);
            audioContextRef.current.close().then(() => {
              console.log('[语音输入] AudioContext已关闭');
            }).catch(err => {
              if (err.name !== 'InvalidStateError') {
                console.error('[语音输入] 关闭AudioContext失败:', err);
              }
            });
          } else {
            console.log('[语音输入] AudioContext已经是关闭状态，跳过关闭');
          }
          audioContextRef.current = null;
        } else if (audioContextRef.current.state === 'running') {
          console.log('[语音输入] AudioContext不支持close，尝试暂停');
          audioContextRef.current.suspend();
          audioContextRef.current = null;
        }
      } catch (err) {
        console.debug('[语音输入] AudioContext关闭检查失败:', err);
        audioContextRef.current = null;
      }
    }
    
        analyserRef.current = null;

    // 清空音频缓冲区和重置连接状态
    audioBufferRef.current = [];
    isConnectionReadyRef.current = false;
    isSendingBufferedRef.current = false;

    // 注意：不在这里关闭 WebSocket 连接
    // 连接应该由服务器关闭（收到 stop 消息后）
    // 客户端只负责清理本地资源（媒体流、AudioContext等）
    // speechRecognitionService.close() 应该在 onClose 回调中调用，或者由服务器关闭
    
    isInitializingRef.current = false;
    
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
    }

        setIsRecognizing(prev => {
          if (prev) {
            console.log('[语音输入] 清理资源时检测到仍在识别状态，立即重置');
            // 注意：这里不应该清空 finalTextRef，因为可能是在继续识别下一段
            // 只清空 currentSegmentRef，保留已确定的文本以便累加
            currentSegmentRef.current = '';
            // 如果有已确定的文本，显示它；否则清空
            if (finalTextRef.current) {
              setRecognizedText(finalTextRef.current);
              onChange(finalTextRef.current);
            } else {
              setRecognizedText(null);
              onChange('');
            }
            return false;
          }
          return prev;
        });
  }, [onChange]);

  // 开始录音
  const startRecording = useCallback(async () => {
    isInitializingRef.current = true;
    recordingStartTimeRef.current = Date.now();
    
    // PC端检查：如果有内容，无法开始新的录音
    const hasContent = finalTextRef.current || currentSegmentRef.current || value.trim();
    if (hasContent && !isTouchDevice()) {
      console.log('[语音输入] PC端：输入框有内容，无法开始新的录音');
      setRecordingError('请先清空输入框内容后再开始录音');
      isInitializingRef.current = false;
      return;
    }
    
    // 开始录音时：只在没有已确定文本时清空（支持多段累加）
    // 如果有已确定文本，保留它以便累加下一段
    if (!finalTextRef.current) {
      // 第一次开始录音，清空所有内容
      finalTextRef.current = '';
      currentSegmentRef.current = '';
      setRecognizedText(null);
      onChange('');
    } else {
      // 继续识别下一段，只清空当前正在识别的部分，保留已确定的文本
      currentSegmentRef.current = '';
      // 更新显示，只显示已确定的文本
      const fullText = finalTextRef.current;
      setRecognizedText(fullText);
      onChange(fullText);
    }
    
    // 立即失焦，防止键盘弹出
    if (mainTextareaRef.current && document.activeElement === mainTextareaRef.current) {
      console.log('[语音输入] 开始录音时，立即失焦防止键盘弹出');
      mainTextareaRef.current.blur();
    }
    
    try {
      console.log('[语音输入] 开始录音（初始化中...）');
      
      const support = checkMediaDevicesSupport();
      if (!support.supported) {
        console.error('[语音输入] 不支持麦克风访问:', support.message);
        setRecordingError(support.message);
        setInputMode('keyboard');
        setIsRecognizing(false); // 重置识别状态
        isInitializingRef.current = false;
        return;
      }
      
      if (hasPermission === null || hasPermission === false) {
        const granted = await requestMicrophonePermission();
        if (!granted) {
          setInputMode('keyboard');
          setIsRecognizing(false); // 重置识别状态
          isInitializingRef.current = false;
          return;
        }
      }

      const touchDevice = isTouchDevice();
      voiceInputModeRef.current = touchDevice ? 'manual' : 'vad';
      console.log('[语音输入] 设备类型:', touchDevice ? '触摸设备（手机）' : '鼠标设备（电脑）', '使用模式:', voiceInputModeRef.current);

      currentTranscriptRef.current = '';
      // 注意：这里不应该清空 finalTextRef，因为可能是在继续识别下一段
      // 只清空 currentSegmentRef，保留已确定的文本以便累加
      currentSegmentRef.current = '';
      // 如果有已确定的文本，显示它；否则清空
      if (finalTextRef.current) {
        setRecognizedText(finalTextRef.current);
        onChange(finalTextRef.current);
      } else {
        setRecognizedText(null);
        onChange('');
      }
      // 确保 isRecognizing 为 true（可能在 handleVoiceButtonTouchStart 中已经设置，再次设置也无妨）
      setIsRecognizing(true);
      setRecordingError(null);

      // 重置音频缓冲区和连接状态
      audioBufferRef.current = [];
      isConnectionReadyRef.current = false;
      isSendingBufferedRef.current = false;

      // 并行执行：同时启动连接和录音，不等待连接完成
      console.log('[语音输入] 并行启动：同时连接WebSocket和开始录音...');
      
      const connectionPromise = speechRecognitionService.start({
        mode: voiceInputModeRef.current,
        language: voiceInputLanguage
      }).then(() => {
        console.log('[语音输入] ✅ WebSocket连接成功，通路完全打通');
        isConnectionReadyRef.current = true;
        // 连接建立后，触发发送缓冲音频
        return true;
      }).catch((error: any) => {
        console.error('[语音输入] ❌ WebSocket连接失败:', error);
        setRecordingError(`连接失败: ${error.message}`);
        setIsRecognizing(false);
        setInputMode('keyboard');
        isInitializingRef.current = false;
        // 连接失败，清空缓冲区
        audioBufferRef.current = [];
        throw error;
      });

      // 注册回调（在连接建立前注册，避免丢失消息）
      speechRecognitionService.removeCallbacks();
      
      speechRecognitionService.onTranscript((text, isFinal) => {
        const logMsg = `[识别结果] isFinal=${isFinal}, text="${text}", finalText="${finalTextRef.current}", currentSegment="${currentSegmentRef.current}"`;
        console.log('[语音输入]', logMsg);
        
        // 添加到调试日志
        setDebugLogs(prev => [...prev.slice(-49), logMsg]); // 只保留最近50条
        
        if (isFinal) {
          // 最终结果：将当前段落的最终文本累加到已确定文本
          // 注意：isFinal=true 时，text 是最终确定的文本，应该直接使用它来累加
          // 使用 text 参数（最终确定的文本）累加到 finalTextRef
          const segmentToAdd = text || '';
          const oldFinalText = finalTextRef.current;
          finalTextRef.current = finalTextRef.current + segmentToAdd;
          currentSegmentRef.current = '';
          const fullText = finalTextRef.current;
          
          const finalLogMsg = `[最终结果] 累加前="${oldFinalText}", 累加段落="${segmentToAdd}", 累加后="${finalTextRef.current}"`;
          console.log('[语音输入] ✅', finalLogMsg);
          setDebugLogs(prev => [...prev.slice(-49), finalLogMsg]);
          
          setRecognizedText(fullText);
          onChange(fullText);
          
          // 注意：收到 isFinal: true 时，只更新文本，不停止录音，不清理资源，不关闭连接
          // 因为用户可能还在继续说话，需要继续采集和发送音频
          // 只有在用户松手（stopRecording）或收到 complete 消息时，才停止录音和清理资源
          // 重置识别超时定时器，继续等待后续消息
          if (recognitionTimeoutRef.current) {
            clearTimeout(recognitionTimeoutRef.current);
            recognitionTimeoutRef.current = null;
          }
          
          // 不设置 setIsRecognizing(false)，因为可能还有后续消息
          // 不设置 setIsRecording(false)，因为用户可能还在说话
          // 不停止 mediaStream，因为需要继续采集音频
          // 不调用 cleanupAudioResources()，因为它会关闭 WebSocket 连接和停止录音
        } else {
          // 实时猜测：更新当前正在识别的段落
          currentSegmentRef.current = text;
          const fullText = finalTextRef.current + currentSegmentRef.current;
          
          const realtimeLogMsg = `[实时猜测] 已确定="${finalTextRef.current}", 正在识别="${currentSegmentRef.current}", 完整="${fullText}"`;
          console.log('[语音输入] 📝', realtimeLogMsg);
          setDebugLogs(prev => [...prev.slice(-49), realtimeLogMsg]);
          
          setRecognizedText(fullText);
          onChange(fullText);
        }
      });

      speechRecognitionService.onError((error) => {
        console.error('[语音输入] 识别错误:', error);
        if (recognitionTimeoutRef.current) {
          clearTimeout(recognitionTimeoutRef.current);
          recognitionTimeoutRef.current = null;
        }
        setRecordingError(`识别失败: ${error}`);
        setIsRecognizing(false);
        setIsRecording(false);
        isRecordingRef.current = false;
        // 识别失败时，保留已确定的文本，只清空正在识别的部分
        const finalText = finalTextRef.current;
        currentSegmentRef.current = '';
        setRecognizedText(finalText || null);
        onChange(finalText || '');
        cleanupAudioResources();
      });

      speechRecognitionService.onComplete(() => {
        console.log('[语音输入] 识别完成');
        if (recognitionTimeoutRef.current) {
          clearTimeout(recognitionTimeoutRef.current);
          recognitionTimeoutRef.current = null;
        }
        
        // ✅ 优化：识别完成时，确保文本正确显示
        const finalText = finalTextRef.current;
        currentSegmentRef.current = '';
        
        // 更新识别文本状态
        setRecognizedText(prevText => {
          // 如果之前没有文本或为空，使用最终文本
          if (!prevText || prevText.trim() === '') {
            onChange(finalText || '');
            return finalText || null;
          }
          // 如果之前有文本，确保使用最终文本（可能更准确）
          if (finalText && finalText !== prevText) {
            onChange(finalText);
            return finalText;
          }
          return prevText;
        });
        
        // ✅ 优化：识别完成后才设置 isRecognizing = false
        setIsRecognizing(false);
        setIsRecording(false);
        isRecordingRef.current = false;
        
        console.log('[语音输入] ✅ 识别完成，最终文本:', finalText);
        
        // 注意：识别完成时，不在这里清理资源
        // 应该等待服务器关闭连接，在 onClose 回调中清理资源
      });

      // 注册关闭回调（服务器关闭连接时触发，用于清理资源）
      speechRecognitionService.onClose(() => {
        console.log('[语音输入] WebSocket连接已关闭（由服务器关闭），清理音频资源');
        
        // 清除关闭超时定时器（服务器已经关闭连接，不需要客户端再关闭）
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
          closeTimeoutRef.current = null;
        }
        
        // 停止录音状态（确保 cleanupAudioResources 可以执行）
        setIsRecording(false);
        isRecordingRef.current = false;
        setIsRecognizing(false);
        
        // 清理音频资源（连接已经被服务器关闭，不需要再关闭）
        // cleanupAudioResources() 中已经移除了 speechRecognitionService.close() 的调用
        cleanupAudioResources();
        
        // 重置状态，允许再次按下
        // 重置 isStoppingRef，确保可以再次按下按钮
        // 注意：isStoppingRef 是在组件顶层定义的，onClose 回调在 startRecording 中注册
        // 由于 startRecording 是组件内部的 useCallback，可以通过闭包访问 isStoppingRef
        // 但为了确保，我们通过一个间接方式：在 stopRecording 中已经设置了100ms后重置
        // 这里再确保一次，以防连接关闭很慢
        console.log('[语音输入] 状态已重置，可以再次按下开始录音');
    });

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('浏览器不支持麦克风访问，请使用 HTTPS 或 localhost');
      }

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      
      console.log('[语音输入] AudioContext已创建，状态:', audioContext.state, '采样率:', audioContext.sampleRate);
      
      if (audioContext.sampleRate !== 16000) {
        console.warn('[语音输入] 音频上下文采样率不是16000Hz，将进行重采样:', audioContext.sampleRate);
      }

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

      setIsRecording(true);
      isRecordingRef.current = true;

      if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
        console.log('[语音输入] AudioContext状态不是running，当前状态:', audioContext.state);
        await audioContext.resume();
        console.log('[语音输入] AudioContext已恢复，新状态:', audioContext.state);
      } else if (audioContext.state === 'closed') {
        console.error('[语音输入] ❌ AudioContext已被关闭，无法继续录音');
        throw new Error('AudioContext已被关闭');
      }

      let scriptProcessor: ScriptProcessorNode;
      let bufferSize = 0;
      try {
        scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        console.log('[语音输入] ScriptProcessor已创建，bufferSize:', bufferSize, '(浏览器自动决定)');
      } catch (error) {
        bufferSize = 4096;
        const audioSampleRate = audioContext.sampleRate;
        while (bufferSize < 16384 && audioSampleRate >= (2 * 16000)) {
          bufferSize <<= 1;
        }
        scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        console.log('[语音输入] ScriptProcessor已创建，bufferSize:', bufferSize, '(使用默认值)');
      }
      
      const audioChunkCountRef = { current: 0 };
      
      // 发送缓冲音频的函数（在连接建立后调用）
      const sendBufferedAudioRef = { current: null as (() => Promise<void>) | null };
      
      const sendBufferedAudio = async () => {
        if (isSendingBufferedRef.current || audioBufferRef.current.length === 0) {
          return;
        }
        
        if (!speechRecognitionService.isReady()) {
          return;
        }
        
        isSendingBufferedRef.current = true;
        console.log('[语音输入] 📦 开始发送缓冲音频，共', audioBufferRef.current.length, '个音频块');
        
        // 复制缓冲区并清空，避免在发送过程中继续添加
        const buffered = audioBufferRef.current.splice(0);
        
        try {
          // 按顺序发送所有缓冲的音频数据
          for (let i = 0; i < buffered.length; i++) {
            if (!speechRecognitionService.isReady() || !isRecordingRef.current) {
              console.log('[语音输入] ⚠️ 发送缓冲音频时连接断开或录音停止，停止发送');
              // 将未发送的音频重新放回缓冲区（如果需要）
              audioBufferRef.current.unshift(...buffered.slice(i));
              break;
            }
            await speechRecognitionService.sendAudio(buffered[i]);
            if (i < 10 || i % 20 === 0) {
              console.log('[语音输入] 📦 已发送缓冲音频块:', i + 1, '/', buffered.length);
            }
          }
          console.log('[语音输入] ✅ 缓冲音频发送完成，共发送', buffered.length, '个音频块');
        } catch (error) {
          console.error('[语音输入] ❌ 发送缓冲音频失败:', error);
          // 发送失败，不再重新放入缓冲区（避免无限重试）
        } finally {
          isSendingBufferedRef.current = false;
        }
      };
      
      // 保存函数引用，以便在连接建立后调用
      sendBufferedAudioRef.current = sendBufferedAudio;
      
      scriptProcessor.onaudioprocess = async (event) => {
        audioChunkCountRef.current++;
        
        if (audioChunkCountRef.current <= 10 || audioChunkCountRef.current % 10 === 0) {
          console.log('[语音输入] ✅ onaudioprocess触发 #', audioChunkCountRef.current, 'isRecordingRef:', isRecordingRef.current, 'isReady:', speechRecognitionService.isReady(), 'audioContext.state:', audioContext.state, '缓冲区:', audioBufferRef.current.length);
        }
        
        if (audioContext.state === 'closed') {
          if (audioChunkCountRef.current <= 10 || audioChunkCountRef.current % 10 === 0) {
            console.warn('[语音输入] ⚠️ AudioContext已关闭，停止音频处理 #', audioChunkCountRef.current);
          }
          return;
        }
        
        if (!isRecordingRef.current) {
          if (voiceInputModeRef.current === 'manual') {
            if (audioChunkCountRef.current <= 10 || audioChunkCountRef.current % 10 === 0) {
              console.log('[语音输入] Manual模式：录音已停止，停止发送音频 #', audioChunkCountRef.current);
            }
            return;
          }
          if (!speechRecognitionService.isReady()) {
            if (audioChunkCountRef.current <= 10 || audioChunkCountRef.current % 10 === 0) {
              console.log('[语音输入] VAD模式：录音已停止且WebSocket未就绪，跳过音频处理 #', audioChunkCountRef.current);
            }
            return;
          }
        }
        
        if (!mediaStreamRef.current) {
          if (audioChunkCountRef.current <= 10 || audioChunkCountRef.current % 10 === 0) {
            console.log('[语音输入] 媒体流不存在，跳过音频处理 #', audioChunkCountRef.current);
          }
          return;
        }

        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        let maxAmplitude = 0;
        for (let i = 0; i < inputData.length; i++) {
          const abs = Math.abs(inputData[i]);
          if (abs > maxAmplitude) {
            maxAmplitude = abs;
          }
        }
        
        const pcm16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16Data[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32768)));
        }

        const audioBuffer = pcm16Data.buffer;

        // 检查连接是否就绪
        const isReady = speechRecognitionService.isReady();
        
        if (!isReady) {
          // 连接未就绪，存入缓冲区
          if (audioBufferRef.current.length < maxBufferSize) {
            audioBufferRef.current.push(audioBuffer);
            if (audioChunkCountRef.current <= 10 || audioChunkCountRef.current % 20 === 0) {
              console.log('[语音输入] 📦 音频数据已缓冲 #', audioChunkCountRef.current, '缓冲区大小:', audioBufferRef.current.length);
            }
          } else {
            // 缓冲区已满，丢弃最旧的数据（FIFO）
            audioBufferRef.current.shift();
            audioBufferRef.current.push(audioBuffer);
            console.warn('[语音输入] ⚠️ 音频缓冲区已满，丢弃最旧的数据');
          }
          return;
        }
        
        // 连接已就绪
        // 注意：缓冲音频的发送在连接建立的 Promise 回调中处理，这里只发送实时音频
        
        // 发送当前音频数据
        try {
          await speechRecognitionService.sendAudio(audioBuffer);
          
          if (audioChunkCountRef.current % 100 === 0) {
            console.log('[语音输入] 已发送音频块:', audioChunkCountRef.current, '大小:', audioBuffer.byteLength, 'bytes', '最大振幅:', maxAmplitude.toFixed(4), 'isRecordingRef:', isRecordingRef.current);
          }
          
          if (audioChunkCountRef.current <= 10 || audioChunkCountRef.current % 10 === 0 || audioChunkCountRef.current <= 50) {
            console.log('[语音输入] ✅ 发送音频块:', audioChunkCountRef.current, '大小:', audioBuffer.byteLength, 'bytes', '最大振幅:', maxAmplitude.toFixed(4), 'isRecordingRef:', isRecordingRef.current);
          }
        } catch (error) {
          console.error('[语音输入] ❌ 发送音频数据失败 #', audioChunkCountRef.current, ':', error, 'isRecordingRef:', isRecordingRef.current, 'isReady:', speechRecognitionService.isReady());
          // 发送失败，如果是因为连接未就绪，将数据存入缓冲区
          if (!speechRecognitionService.isReady() && audioBufferRef.current.length < maxBufferSize) {
            audioBufferRef.current.push(audioBuffer);
            console.log('[语音输入] 📦 发送失败，音频数据已重新缓冲');
          }
        }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);
      
      scriptProcessorRef.current = scriptProcessor;
      
      console.log('[语音输入] ScriptProcessor已直接连接到audioContext.destination');
      console.log('[语音输入] ScriptProcessor已连接，开始处理音频（并行模式：连接和录音同时进行）');
      console.log('[语音输入] 音频上下文状态:', audioContext.state);
      console.log('[语音输入] 音频上下文采样率:', audioContext.sampleRate);
      console.log('[语音输入] 音频流活动状态:', stream.active);
      console.log('[语音输入] 音频流轨道数:', stream.getAudioTracks().length);
      
      stream.getAudioTracks().forEach((track, index) => {
        console.log(`[语音输入] 音频轨道 ${index}:`, {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label
        });
      });
      
      // 等待连接建立（不阻塞录音）
      connectionPromise.then(() => {
        console.log('[语音输入] ✅ 连接已建立，开始发送缓冲音频');
        // 连接建立后，立即尝试发送缓冲音频
        setTimeout(() => {
          if (sendBufferedAudioRef.current) {
            sendBufferedAudioRef.current();
          }
        }, 50);
      }).catch((error) => {
        // 连接失败已在 connectionPromise 中处理
        console.error('[语音输入] 连接失败，清空音频缓冲区');
        audioBufferRef.current = [];
      });
      
      isInitializingRef.current = false;
      console.log('[语音输入] ✅ 录音初始化完成，音频处理已开始（连接建立前音频将被缓冲）');
      
      setTimeout(() => {
        console.log('[语音输入] 🔍 3秒后检查：isRecordingRef.current =', isRecordingRef.current);
        console.log('[语音输入] 🔍 3秒后检查：isInitializingRef.current =', isInitializingRef.current);
        console.log('[语音输入] 🔍 3秒后检查：audioChunkCount =', audioChunkCountRef.current);
        console.log('[语音输入] 🔍 3秒后检查：audioContext.state =', audioContext.state);
        console.log('[语音输入] 🔍 3秒后检查：stream.active =', stream.active);
        if (audioChunkCountRef.current === 0) {
          console.error('[语音输入] ❌ 错误：3秒内没有触发 onaudioprocess！');
        } else {
          console.log('[语音输入] ✅ 音频处理正常，已处理', audioChunkCountRef.current, '个音频块');
        }
      }, 3000);

      setRecordingDuration(0);

      const startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        setRecordingDuration(duration);
        
        if (duration >= 60) {
          stopRecording();
        }
      }, 1000);

      } catch (error: any) {
        console.error('[语音输入] 录音失败:', error);
        setRecordingError(`录音失败: ${error.message}`);
        setIsRecording(false);
        isRecordingRef.current = false;
        isInitializingRef.current = false;
        setIsRecognizing(false);
        setInputMode('keyboard');
        cleanupAudioResources();
      }
  }, [hasPermission, requestMicrophonePermission, checkMediaDevicesSupport, cleanupAudioResources, isTouchDevice, voiceInputLanguage, onChange]);

  // 停止录音
  const stopRecording = useCallback(() => {
    console.log('[语音输入] 停止录音');
    
    const recordingDuration = Date.now() - recordingStartTimeRef.current;
    const minRecordingDuration = 100;
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

    setIsRecording(false);
    isRecordingRef.current = false;
    
    // ✅ 优化：检查是否有识别文本，决定是否立即显示输入框
    const hasRecognizedText = finalTextRef.current || currentSegmentRef.current;
    if (hasRecognizedText) {
      // 有文本：立即更新显示，让用户看到识别结果
      const fullText = finalTextRef.current + currentSegmentRef.current;
      setRecognizedText(fullText);
      onChange(fullText);
      console.log('[语音输入] ✅ 检测到识别文本，立即显示输入框:', fullText);
    } else {
      console.log('[语音输入] ⏳ 暂无识别文本，保持识别状态，等待服务器返回结果');
    }
    // 注意：保持 isRecognizing = true，等待服务器返回最终结果
    
    // 停止发送音频数据
    if (voiceInputModeRef.current === 'manual') {
      console.log('[语音输入] Manual模式，主动提交音频');
      speechRecognitionService.commit().catch(err => {
        console.error('[语音输入] 提交音频失败:', err);
        setRecordingError(`提交音频失败: ${err.message}`);
      });
    }
    
    // 发送 stop 消息给服务器，让服务器关闭连接
    // 注意：不在这里调用 cleanupAudioResources()，应该在 WebSocket onclose 事件中清理
    console.log('[语音输入] 发送 stop 消息给服务器，等待服务器关闭连接');
    
    // 清除之前的关闭超时定时器（如果有）
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    
    // 设置2秒超时：如果服务器没有关闭连接，客户端主动关闭
    closeTimeoutRef.current = setTimeout(() => {
      console.warn('[语音输入] ⚠️ 服务器2秒内未关闭连接，客户端主动关闭');
      closeTimeoutRef.current = null;
      // 主动关闭连接并清理资源
      speechRecognitionService.close().catch(err => {
        console.error('[语音输入] 主动关闭连接失败:', err);
      });
      // 清理资源
      setIsRecording(false);
      isRecordingRef.current = false;
      setIsRecognizing(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      cleanupAudioResources();
      // 重置状态，允许再次按下
      // 重置 isStoppingRef，确保可以再次按下按钮
      // 注意：这里可以直接访问 isStoppingRef，因为它在组件顶层定义
      isStoppingRef.current = false;
      console.log('[语音输入] 状态已重置（超时关闭），可以再次按下开始录音');
    }, 2000);
    
    speechRecognitionService.stop().catch(err => {
      console.error('[语音输入] 发送 stop 消息失败:', err);
      // 如果发送失败，清除超时定时器并直接清理资源
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      cleanupAudioResources();
    });

    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
    }
  }, [cleanupAudioResources, onChange]);

  // 切换输入模式
  const handleToggleInputMode = useCallback(() => {
    if (!enableVoiceInput) {
      return;
    }
    
    if (inputMode === 'voice') {
      if (isRecording) {
        stopRecording();
      }
      setInputMode('keyboard');
    } else {
      const support = checkMediaDevicesSupport();
      if (!support.supported) {
        console.error('[语音输入] 不支持语音输入:', support.message);
        setRecordingError(support.message);
        return;
      }
      setInputMode('voice');
      setRecordingError(null);
    }
  }, [inputMode, isRecording, stopRecording, checkMediaDevicesSupport, enableVoiceInput]);

  // 发送识别结果
  const handleSendRecognizedText = useCallback(() => {
    // 发送时使用完整文本（已确定 + 正在识别的，如果有）
    const fullText = finalTextRef.current + currentSegmentRef.current;
    const textToSend = fullText || recognizedText || value.trim();
    if (textToSend && !isLoading) {
      onChange(textToSend);
      
      // 清空所有内容，重置所有状态
      finalTextRef.current = '';
      currentSegmentRef.current = '';
      setRecognizedText(null);
      setInputMode('keyboard');
      setIsRecognizing(false);
      
      setTimeout(() => {
        onSend(textToSend);
      }, 0);
    }
  }, [recognizedText, value, isLoading, onChange, onSend]);

  // 取消识别结果
  const handleCancelRecognizedText = useCallback(() => {
    console.log('[语音输入] 用户取消识别');
    
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
    }
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (isRecording) {
      console.log('[语音输入] 取消时检测到正在录音，停止录音并关闭连接');
      setIsRecording(false);
      isRecordingRef.current = false;
    }
    
    speechRecognitionService.close().catch(err => {
      console.error('[语音输入] 关闭语音识别服务失败:', err);
    });
    
    cleanupAudioResources();
    
    // 清空所有内容，重置所有状态
    finalTextRef.current = '';
    currentSegmentRef.current = '';
    setRecognizedText(null);
    onChange('');
    setIsRecognizing(false);
    setRecordingError(null);
  }, [isRecording, cleanupAudioResources, onChange]);

  // 处理输入框的鼠标按下事件（语音模式 - 电脑使用VAD模式）
  const handleInputMouseDown = useCallback((e: React.MouseEvent) => {
    if (inputMode === 'voice' && !isRecording && !isRecognizing && !recognizedText) {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('[语音输入] 鼠标设备，点击开始录音（VAD模式）');
      startRecording();
    }
  }, [inputMode, isRecording, isRecognizing, recognizedText, startRecording]);

  // 处理输入框的鼠标松开事件（语音模式 - 电脑VAD模式不需要处理）
  const handleInputMouseUp = useCallback((e: React.MouseEvent) => {
    // VAD模式不需要在mouseup时停止，让VAD自动检测结束
  }, []);

  // 处理输入框的焦点事件（语音模式下阻止焦点，防止键盘弹出）
  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    // 在语音输入流程中（录音和识别时）不应该获得焦点
    // 但识别完成后（有recognizedText时），用户可以编辑输入框
    if (inputMode === 'voice' && !recognizedText && (isRecording || isRecognizing)) {
      console.log('[语音输入] 语音模式下阻止输入框获得焦点，防止键盘弹出', { isRecording, isRecognizing, recognizedText });
      e.target.blur();
    }
  }, [inputMode, isRecording, isRecognizing, recognizedText]);

  // 处理语音按钮的触摸事件（移动端 - 使用Manual模式）
  const handleVoiceButtonTouchStart = useCallback((e: React.TouchEvent) => {
    if (inputMode === 'voice' && isRecording) {
      // 如果正在录音，再次点击时停止录音（备用方案，防止 onTouchEnd 未触发）
      e.preventDefault();
      e.stopPropagation();
      console.log('[语音输入] 正在录音时再次点击，停止录音（备用方案）');
      stopRecording();
      return;
    }
    if (inputMode === 'voice' && !isRecording && !isRecognizing) {
      e.preventDefault();
      e.stopPropagation();
      
      // 移动端：使用延迟机制，只有按住超过一定时间才开始录音
      if (isTouchDevice()) {
        console.log('[语音输入] 移动端触摸开始，设置延迟定时器（150ms）');
        isTouchHoldingRef.current = true;
        
        // 清除之前的定时器（如果有）
        if (touchStartTimerRef.current) {
          clearTimeout(touchStartTimerRef.current);
          touchStartTimerRef.current = null;
        }
        
        // 设置延迟定时器，150ms后开始录音
        touchStartTimerRef.current = setTimeout(() => {
          // 检查用户是否还在按住
          if (isTouchHoldingRef.current && !isRecording && !isRecognizing) {
            console.log('[语音输入] 移动端按住超过150ms，开始录音（Manual模式）');
            touchStartTimerRef.current = null;
            // 立即设置 isRecognizing 为 true，确保按钮立即显示，不显示输入框
            setIsRecognizing(true);
            // 然后异步开始录音
            startRecording();
          } else {
            console.log('[语音输入] 移动端延迟期间状态已变化，取消开始录音');
            touchStartTimerRef.current = null;
          }
        }, 150);
      } else {
        // PC端：立即开始录音（保持原有逻辑）
        console.log('[语音输入] PC端点击开始录音（VAD模式）');
        setIsRecognizing(true);
        startRecording();
      }
    }
  }, [inputMode, isRecording, isRecognizing, startRecording, stopRecording, isTouchDevice]);

  // 处理语音按钮的触摸移动事件（防止触发滚动或其他交互）
  const handleVoiceButtonTouchMove = useCallback((e: React.TouchEvent) => {
    if (inputMode === 'voice' && isRecording) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [inputMode, isRecording]);

  // 防止重复触发停止录音的标志
  const isStoppingRef = useRef(false);

  const handleVoiceButtonTouchEnd = useCallback((e: React.TouchEvent) => {
    console.log('[语音输入] handleVoiceButtonTouchEnd 触发', { inputMode, isRecording, isRecognizing, isStopping: isStoppingRef.current });
    
    // 移动端：标记不再按住
    if (isTouchDevice()) {
      isTouchHoldingRef.current = false;
      
      // 如果延迟定时器还在，说明用户快速点击，取消开始录音
      if (touchStartTimerRef.current) {
        console.log('[语音输入] 移动端快速点击，取消开始录音');
        clearTimeout(touchStartTimerRef.current);
        touchStartTimerRef.current = null;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    
    // 如果已经开始录音，正常停止
    if (inputMode === 'voice' && isRecording && !isStoppingRef.current) {
      isStoppingRef.current = true;
      e.preventDefault();
      e.stopPropagation();
      console.log('[语音输入] 触摸设备，松开结束录音（Manual模式，将提交音频）');
      stopRecording();
      // 重置标志，延迟一点时间避免重复触发
      setTimeout(() => {
        isStoppingRef.current = false;
      }, 100);
    } else {
      console.log('[语音输入] handleVoiceButtonTouchEnd 条件不满足，不执行停止录音');
    }
  }, [inputMode, isRecording, isRecognizing, stopRecording, isTouchDevice]);

  const handleVoiceButtonTouchCancel = useCallback((e: React.TouchEvent) => {
    console.log('[语音输入] handleVoiceButtonTouchCancel 触发', { inputMode, isRecording, isRecognizing });
    
    // 移动端：标记不再按住，清除延迟定时器
    if (isTouchDevice()) {
      isTouchHoldingRef.current = false;
      if (touchStartTimerRef.current) {
        console.log('[语音输入] 移动端触摸取消，清除延迟定时器');
        clearTimeout(touchStartTimerRef.current);
        touchStartTimerRef.current = null;
      }
    }
    
    // 触摸取消时也结束录音（例如用户手指移出按钮区域）
    if (inputMode === 'voice' && isRecording) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[语音输入] 触摸取消，结束录音');
      stopRecording();
    }
  }, [inputMode, isRecording, isRecognizing, stopRecording, isTouchDevice]);

  // 处理指针事件（Pointer Events API，更现代的方式，支持触摸和鼠标）
  const handleVoiceButtonPointerUp = useCallback((e: React.PointerEvent) => {
    console.log('[语音输入] handleVoiceButtonPointerUp 触发', { inputMode, isRecording, isRecognizing, isStopping: isStoppingRef.current });
    
    // 移动端：如果是触摸指针，标记不再按住，清除延迟定时器
    if (isTouchDevice() && e.pointerType === 'touch') {
      isTouchHoldingRef.current = false;
      if (touchStartTimerRef.current) {
        console.log('[语音输入] 移动端指针松开（触摸），清除延迟定时器');
        clearTimeout(touchStartTimerRef.current);
        touchStartTimerRef.current = null;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    
    // 如果已经开始录音，正常停止
    if (inputMode === 'voice' && isRecording && !isStoppingRef.current) {
      isStoppingRef.current = true;
      e.preventDefault();
      e.stopPropagation();
      console.log('[语音输入] 指针松开，结束录音（Pointer Events）');
      stopRecording();
      // 重置标志，延迟一点时间避免重复触发
      setTimeout(() => {
        isStoppingRef.current = false;
      }, 100);
    }
  }, [inputMode, isRecording, isRecognizing, stopRecording, isTouchDevice]);

  // 处理鼠标事件（作为备用方案）
  const handleVoiceButtonMouseUp = useCallback((e: React.MouseEvent) => {
    console.log('[语音输入] handleVoiceButtonMouseUp 触发', { inputMode, isRecording, isRecognizing, isStopping: isStoppingRef.current });
    if (inputMode === 'voice' && isRecording && !isStoppingRef.current) {
      isStoppingRef.current = true;
      e.preventDefault();
      e.stopPropagation();
      console.log('[语音输入] 鼠标松开，结束录音（备用方案）');
      stopRecording();
      // 重置标志，延迟一点时间避免重复触发
      setTimeout(() => {
        isStoppingRef.current = false;
      }, 100);
    }
  }, [inputMode, isRecording, isRecognizing, stopRecording]);

  // 处理按钮点击事件（移动端阻止默认行为，防止快速点击触发录音）
  const handleVoiceButtonClick = useCallback((e: React.MouseEvent) => {
    // 移动端：阻止默认点击行为，只允许按住开始录音
    if (isTouchDevice() && inputMode === 'voice') {
      console.log('[语音输入] 移动端点击事件，阻止默认行为（只允许按住开始）');
      e.preventDefault();
      e.stopPropagation();
    }
    // PC端：允许点击开始（但实际由 mousedown/mouseup 处理）
  }, [inputMode, isTouchDevice]);

  // 处理输入框的触摸事件（移动端 - 仅在识别结果后允许编辑）
  const handleInputTouchStart = useCallback((e: React.TouchEvent) => {
    // 移动端语音模式下，输入框不再处理触摸事件（由独立按钮处理）
    if (inputMode === 'voice' && isTouchDevice()) {
      return;
    }
    // 保留PC端的处理逻辑
    if (inputMode === 'voice' && !isRecording && !isRecognizing) {
      if (mainTextareaRef.current && document.activeElement === mainTextareaRef.current) {
        console.log('[语音输入] 输入框有焦点，先失焦再开始录音');
        mainTextareaRef.current.blur();
      }
      e.preventDefault();
      e.stopPropagation();
      console.log('[语音输入] 鼠标设备，点击开始录音（VAD模式）');
      startRecording();
    }
  }, [inputMode, isRecording, isRecognizing, startRecording, isTouchDevice]);

  // 处理输入框的触摸移动事件（防止触发滚动或其他交互）
  const handleInputTouchMove = useCallback((e: React.TouchEvent) => {
    // 移动端语音模式下，输入框不再处理触摸事件
    if (inputMode === 'voice' && isTouchDevice()) {
      return;
    }
    if (inputMode === 'voice' && isRecording && !isTouchDevice()) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [inputMode, isRecording, isTouchDevice]);

  // 处理输入框的上下文菜单事件（阻止长按弹出粘贴、全选等菜单）
  const handleInputContextMenu = useCallback((e: React.MouseEvent) => {
    if (inputMode === 'voice') {
      console.log('[语音输入] 语音模式下阻止上下文菜单（粘贴、全选等）');
      e.preventDefault();
      e.stopPropagation();
    }
  }, [inputMode]);

  const handleInputTouchEnd = useCallback((e: React.TouchEvent) => {
    // 移动端语音模式下，输入框不再处理触摸事件
    if (inputMode === 'voice' && isTouchDevice()) {
      return;
    }
    if (inputMode === 'voice' && isRecording) {
      e.preventDefault();
      console.log('[语音输入] 鼠标设备，松开结束录音');
      stopRecording();
    }
  }, [inputMode, isRecording, stopRecording, isTouchDevice]);

  // 处理键盘事件
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (recognizedText || value.trim()) {
        handleSendRecognizedText();
      } else {
        onSend(value);
      }
    }
  }, [recognizedText, value, handleSendRecognizedText, onSend]);

  // 清理录音资源（组件卸载时）
  useEffect(() => {
    return () => {
      console.log('[语音输入] 组件卸载，清理资源');
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
        recognitionTimeoutRef.current = null;
      }
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      if (touchStartTimerRef.current) {
        clearTimeout(touchStartTimerRef.current);
        touchStartTimerRef.current = null;
      }
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stop();
        } catch (err) {
          // 忽略错误
        }
        mediaRecorderRef.current = null;
      }
      if (isRecordingRef.current || audioContextRef.current) {
        console.log('[语音输入] 组件卸载时仍在录音，调用cleanupAudioResources');
        cleanupAudioResources();
      }
    };
  }, [cleanupAudioResources]);

  // 检查浏览器支持，如果不支持则隐藏切换按钮或显示提示
  useEffect(() => {
    if (enableVoiceInput) {
      const support = checkMediaDevicesSupport();
      if (!support.supported) {
        console.log('[语音输入] 浏览器不支持语音功能:', support.message);
        if (inputMode === 'voice') {
          setInputMode('keyboard');
          setRecordingError(support.message);
        }
      }
    } else {
      if (inputMode === 'voice') {
        setInputMode('keyboard');
      }
    }
  }, [enableVoiceInput, checkMediaDevicesSupport, inputMode]);

  // 样式定义
  const getStyles = () => {
    const surfaceColor = isDarkMode ? '#1f2937' : '#ffffff';
    const textColor = isDarkMode ? '#f9fafb' : '#111827';
    const mutedColor = isDarkMode ? '#9ca3af' : '#6b7280';
    const borderColor = isDarkMode ? '#4b5563' : '#e5e7eb';

    return {
      waveformArea: {
        backgroundColor: isDarkMode ? '#2d3748' : '#f8fafc',
        borderBottom: `1px solid ${borderColor}`,
        padding: '12px 24px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px'
      },
      transcriptArea: {
        // 识别内容显示区域（在波形上方）
        minHeight: '40px',
        maxHeight: '80px',
        padding: '8px 12px',
        backgroundColor: isDarkMode ? '#374151' : '#ffffff',
        borderRadius: '8px',
        border: `1px solid ${borderColor}`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start'
      },
      transcriptText: {
        fontSize: '14px',
        lineHeight: '1.5',
        color: textColor,
        wordBreak: 'break-word' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical' as const
      },
      waveformContainer: {
        // 波形和时间显示容器
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        height: '56px'
      },
      waveformWrapper: {
        flex: 1
      },
      recordingDuration: {
        fontSize: '14px',
        color: mutedColor,
        whiteSpace: 'nowrap' as const,
        paddingRight: '6px'
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
        border: `1px solid ${borderColor}`,
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
      voiceTextarea: {
        flex: 1,
        padding: '12px 16px',
        border: `1px solid ${(isRecording || isRecognizing) ? '#3b82f6' : borderColor}`,
        borderRadius: '16px',
        resize: 'none' as const,
        outline: 'none',
        fontSize: '16px',
        lineHeight: '1.5',
        fontFamily: 'inherit',
        backgroundColor: (isRecording || isRecognizing) ? (isDarkMode ? '#1e3a5f' : '#eff6ff') : surfaceColor,
        color: inputMode === 'voice' && !isRecording && !isRecognizing ? mutedColor : textColor,
        boxSizing: 'border-box' as const,
        textAlign: (inputMode === 'voice' && !isRecording && !isRecognizing && !recognizedText) ? 'center' as const : 'left' as const,
        cursor: inputMode === 'voice' ? 'pointer' : 'text',
        userSelect: 'none' as const,
        transition: 'all 0.3s ease',
        animation: (isRecording || isRecognizing) ? 'pulse 1s infinite' : 'none'
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
      stopButton: {
        backgroundColor: '#ef4444',
        color: 'white'
      },
      voiceCancelButton: {
        width: '48px',
        height: '48px',
        backgroundColor: isDarkMode ? '#4b5563' : '#f3f4f6',
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
        backgroundColor: isDarkMode ? '#6b7280' : '#e5e7eb'
      },
      modeToggleButton: {
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
        transition: 'all 0.2s ease',
        opacity: 0.7,
        outline: 'none',
        WebkitTapHighlightColor: 'transparent'
      },
      modeToggleButtonHover: {
        opacity: 1,
        backgroundColor: '#2563eb'
      },
      modeToggleButtonActive: {
        borderRadius: '16px',
        transform: 'scale(0.98)'
      },
      voiceHoldButton: {
        flex: 1,
        minHeight: '48px', // 最小高度，与原先输入框高度一致
        padding: '12px 24px', // 与原先输入框的 padding 一致
        backgroundColor: '#3b82f6', // 始终蓝色，不随录音状态变化
        color: 'white',
        borderRadius: '16px',
        border: 'none',
        display: 'flex',
        flexDirection: 'row' as const,
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none' as const,
        transition: 'all 0.2s ease',
        boxShadow: isRecording 
          ? '0 4px 12px rgba(59, 130, 246, 0.5)' // 录音时阴影更明显
          : '0 2px 8px rgba(59, 130, 246, 0.3)', // 未录音时阴影轻微
        fontSize: '16px',
        fontWeight: 500,
        touchAction: 'none' as const,
        WebkitTapHighlightColor: 'transparent'
      },
      voiceHoldButtonActive: {
        transform: 'scale(0.98)',
        boxShadow: isRecording 
          ? '0 2px 6px rgba(59, 130, 246, 0.4)' 
          : '0 1px 4px rgba(59, 130, 246, 0.2)'
      },
      voiceHoldButtonText: {
        fontSize: '16px',
        fontWeight: 500,
        lineHeight: 1.5
      },
      voiceHoldButtonHint: {
        // 按钮上方的提示文字样式（用户按住时不会被手指遮挡）
        marginBottom: '12px',
        fontSize: '14px',
        color: mutedColor,
        textAlign: 'center' as const,
        fontWeight: 400,
        lineHeight: 1.4
      },
      voiceButtonContainer: {
        // 包含提示文字和按钮的容器
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'stretch',
        flex: 1
      },
      errorMessage: {
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
      }
    };
  };

  // 判断是否应该在移动端显示独立语音按钮
  // ✅ 优化后的逻辑（保持原有行为，但改善即时反馈）：
  // - 正在录音时：始终显示按钮
  // - 识别中时：显示按钮（保持原有逻辑，不管有没有文本）
  // - 识别完成且无文本时：显示按钮
  // - 识别完成且有文本时：显示输入框（让用户看到识别结果）
  const hasAnyText = finalTextRef.current || currentSegmentRef.current || recognizedText || value.trim();
  const shouldShowVoiceButton = inputMode === 'voice' && isTouchDevice() && 
    (isRecording || isRecognizing || (!recognizedText && !value.trim()));
  
  // 识别中时输入框显示累加后的完整文本
  // 如果正在识别（currentSegmentRef不为空），需要区分显示已确定和正在识别的部分
  // 确保显示完整的文本：已确定部分 + 正在识别部分
  const getDisplayValue = () => {
    if (recognizedText !== null) {
      return recognizedText;
    }
    // 如果 recognizedText 为 null，但 ref 中有值，使用 ref 的值
    const fullText = finalTextRef.current + currentSegmentRef.current;
    return fullText || value;
  };
  const displayValue = getDisplayValue();
  
  // ✅ 优化：检查是否有实际文本内容（用于显示"正在识别..."提示）
  // 修复：确保返回布尔值，而不是字符串
  const hasActualText = !!(displayValue && displayValue.trim().length > 0);
  
  // 计算完整文本（用于显示和编辑）
  const getFullText = () => {
    return finalTextRef.current + currentSegmentRef.current;
  };
  
  // 检查是否正在识别（currentSegmentRef不为空）
  // 注意：这里通过比较 recognizedText 和 finalTextRef 来判断是否有正在识别的部分
  // 如果 recognizedText 的长度大于 finalTextRef 的长度，说明有正在识别的部分
  const finalTextLength = finalTextRef.current.length;
  const isRecognizingSegment = isRecognizing && recognizedText !== null && 
    recognizedText.length > finalTextLength;

  // ✅ 优化：占位符逻辑（仅PC端优化，移动端保持不变）
  // PC端识别中且无文本：始终显示"正在识别..."，避免快速切换到"输入您的问题"
  // PC端识别完成且无文本：显示"点击说话，自动结束"
  // 移动端：保持原有逻辑不变
  // 
  // 关键修复：PC端识别中时，优先判断 isRecognizing 状态
  // 如果 isRecognizing 为 true，即使没有文本，也应该显示"正在识别..."
  // 这样可以避免在识别过程中状态切换导致的占位符闪烁
  // 
  // 注意：VAD模式下，isRecording 可能在识别过程中仍为 true，所以判断时需要考虑这种情况
  // 只要 isRecognizing 为 true 且无文本，就应该显示"正在识别..."
  const isPC = !isTouchDevice();
  const pcIsRecognizingState = inputMode === 'voice' && isPC && isRecognizing && !hasActualText;
  const pcIsCompletedState = inputMode === 'voice' && isPC && !isRecording && !isRecognizing && !hasActualText;
  
  // 计算占位符（必须在日志之前计算）
  const displayPlaceholder = 
    // PC端识别中且无文本：始终显示"正在识别..."（关键修复，优先级最高）
    pcIsRecognizingState
      ? '正在识别...'
      // PC端识别完成且无文本：显示"点击说话，自动结束"
      : pcIsCompletedState
        ? '点击说话，自动结束'
        // 移动端逻辑（保持不变，无问题）
        : (inputMode === 'voice' && isTouchDevice() && !isRecording && !isRecognizing && !shouldShowVoiceButton)
          ? '按住说话，松开结束'
          // 默认占位符（只有在不满足上述条件时才显示）
          : (placeholder || t('ui.inputPlaceholder'));
  

  return (
    <>
      {/* 调试日志面板 */}
      {showDebugLog && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          width: '300px',
          maxHeight: '400px',
          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
          border: `2px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
          borderRadius: '8px',
          padding: '12px',
          zIndex: 10000,
          overflow: 'auto',
          fontSize: '11px',
          fontFamily: 'monospace',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            paddingBottom: '8px',
            borderBottom: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`
          }}>
            <strong style={{ color: isDarkMode ? '#f9fafb' : '#111827' }}>识别日志</strong>
            <button
              onClick={() => setShowDebugLog(false)}
              style={{
                background: 'none',
                border: 'none',
                color: isDarkMode ? '#9ca3af' : '#6b7280',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0 4px'
              }}
            >
              ×
            </button>
          </div>
          <div style={{
            maxHeight: '350px',
            overflowY: 'auto'
          }}>
            {debugLogs.length === 0 ? (
              <div style={{ color: isDarkMode ? '#9ca3af' : '#6b7280', fontStyle: 'italic' }}>
                暂无日志
              </div>
            ) : (
              debugLogs.map((log, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: '4px',
                    padding: '4px',
                    backgroundColor: isDarkMode ? '#374151' : '#f9fafb',
                    borderRadius: '4px',
                    color: isDarkMode ? '#e5e7eb' : '#374151',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {log}
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => setDebugLogs([])}
            style={{
              marginTop: '8px',
              padding: '4px 8px',
              backgroundColor: isDarkMode ? '#4b5563' : '#e5e7eb',
              border: 'none',
              borderRadius: '4px',
              color: isDarkMode ? '#f9fafb' : '#111827',
              cursor: 'pointer',
              fontSize: '11px',
              width: '100%'
            }}
          >
            清空日志
          </button>
        </div>
      )}
      
      {/* 调试日志开关按钮（仅在语音模式下显示） */}
      {inputMode === 'voice' && (
        <button
          onClick={() => setShowDebugLog(!showDebugLog)}
          style={{
            position: 'fixed',
            top: '10px',
            right: showDebugLog ? '320px' : '10px',
            width: '40px',
            height: '40px',
            backgroundColor: showDebugLog ? '#3b82f6' : (isDarkMode ? '#374151' : '#f3f4f6'),
            border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            fontSize: '12px',
            color: isDarkMode ? '#f9fafb' : '#111827',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
          title="显示/隐藏识别日志"
        >
          📋
        </button>
      )}
      
      {/* 音波效果显示区域（✅ 优化：录音时显示波形，识别中时显示文本） */}
      {(isRecording || (isRecognizing && hasAnyText)) && (
        <div style={getStyles().waveformArea}>
          {/* 识别内容显示区域（在波形上方） */}
          {hasAnyText && (
            <div style={getStyles().transcriptArea}>
              <div style={getStyles().transcriptText}>
                {/* 已确定文本：正常显示 */}
                <span>{finalTextRef.current}</span>
                {/* 正在识别的文本：淡色显示 */}
                {isRecognizingSegment && (
                  <span style={{ opacity: 0.7, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                    {recognizedText.substring(finalTextLength)}
                  </span>
                )}
                {/* 如果 recognizedText 为空但 ref 有值，显示 ref 的值 */}
                {!recognizedText && (finalTextRef.current || currentSegmentRef.current) && (
                  <span>{finalTextRef.current + currentSegmentRef.current}</span>
                )}
              </div>
            </div>
          )}
          {/* 波形和时间显示容器（仅在录音时显示） */}
          {isRecording && (
            <div style={getStyles().waveformContainer}>
              <div style={getStyles().waveformWrapper}>
                <FourDotWaveform
                  analyserNode={analyserRef.current}
                  isRecording={isRecording}
                  isDarkMode={isDarkMode}
                  minRadius={8}
                  maxRadius={24}
                  spacing={24}
                  sampleRate={audioContextRef.current?.sampleRate || 16000}
                />
              </div>
              <div style={getStyles().recordingDuration}>
                {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:
                {String(recordingDuration % 60).padStart(2, '0')}
              </div>
            </div>
          )}
          {/* 识别中但不在录音时的提示 */}
          {!isRecording && isRecognizing && hasAnyText && (
            <div style={{
              padding: '8px 12px',
              textAlign: 'center',
              color: isDarkMode ? '#9ca3af' : '#6b7280',
              fontSize: '14px'
            }}>
              正在识别...
            </div>
          )}
        </div>
      )}

      {/* 输入区域 */}
      <div style={getStyles().inputArea}>
        <div style={getStyles().inputContainer}>
          {/* 移动端语音模式：显示独立语音按钮 */}
          {shouldShowVoiceButton ? (
            <div style={getStyles().voiceButtonContainer}>
              {/* 语音按钮 */}
              <button
                type="button"
                onClick={handleVoiceButtonClick}
                onTouchStart={handleVoiceButtonTouchStart}
                onTouchMove={handleVoiceButtonTouchMove}
                onTouchEnd={handleVoiceButtonTouchEnd}
                onTouchCancel={handleVoiceButtonTouchCancel}
                onPointerUp={handleVoiceButtonPointerUp}
                onMouseUp={handleVoiceButtonMouseUp}
                style={{
                  ...getStyles().voiceHoldButton,
                  ...((isRecording || isRecognizing) ? getStyles().voiceHoldButtonActive : {}),
                  touchAction: 'none' as const,
                  WebkitUserSelect: 'none' as const,
                  userSelect: 'none' as const,
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <div 
                  style={{
                    ...getStyles().voiceHoldButtonText,
                    pointerEvents: 'none' as const
                  }}
                >
                  按住说话
                </div>
              </button>
            </div>
          ) : (
            <textarea
              ref={mainTextareaRef}
              value={displayValue}
              onChange={(e) => {
                if (inputMode !== 'voice' || isRecognizing || recognizedText) {
                  const newValue = e.target.value;
                  
                  // 如果正在识别（有正在识别的部分），不允许编辑
                  const hasCurrentSegment = recognizedText && recognizedText.length > finalTextRef.current.length;
                  if (hasCurrentSegment && isRecognizing) {
                    // 恢复原值，不允许修改正在识别的部分
                    e.target.value = displayValue;
                    return;
                  }
                  
                  // 识别结束后，允许编辑已确定文本
                  // 将用户编辑后的完整文本作为新的finalTextRef
                  finalTextRef.current = newValue;
                  currentSegmentRef.current = '';
                  onChange(newValue);
                  
                  if (recognizedText && newValue !== recognizedText) {
                    setRecognizedText(newValue);
                  }
                }
              }}
              onKeyPress={handleKeyPress}
              placeholder={displayPlaceholder}
              readOnly={
                inputMode === 'voice' && !isRecording && !isRecognizing && !recognizedText && !isTouchDevice()
                  ? true
                  : isRecognizingSegment // 正在识别时禁用编辑
              }
              tabIndex={inputMode === 'voice' && !recognizedText && isTouchDevice() ? -1 : undefined}
              onFocus={handleInputFocus}
              onContextMenu={handleInputContextMenu}
              onMouseDown={handleInputMouseDown}
              onMouseUp={handleInputMouseUp}
              onTouchStart={handleInputTouchStart}
              onTouchMove={handleInputTouchMove}
              onTouchEnd={handleInputTouchEnd}
              onKeyDown={(e) => {
                if (inputMode === 'voice' && !isRecording && !isRecognizing && !recognizedText && !isTouchDevice()) {
                  e.preventDefault();
                  return;
                }
                
                // 处理删除功能：只允许删除正在识别的部分（currentSegmentRef）
                // 检查是否有正在识别的部分（通过比较 recognizedText 和 finalTextRef 的长度）
                const hasCurrentSegment = recognizedText && recognizedText.length > finalTextRef.current.length;
                if (e.key === 'Backspace' && hasCurrentSegment && isRecognizing) {
                  // 如果正在识别，只删除currentSegmentRef
                  currentSegmentRef.current = '';
                  const fullText = finalTextRef.current;
                  setRecognizedText(fullText);
                  onChange(fullText);
                  e.preventDefault();
                  return;
                }
                
                // 如果currentSegmentRef为空，正常删除finalTextRef的最后一个字符
                // 但已确定的文本（finalTextRef）不允许删除，所以这里不做特殊处理
                // 让浏览器默认行为处理（用户可以通过正常编辑删除）
              }}
              disabled={disabled}
              style={
                inputMode === 'voice' && !isTouchDevice()
                  ? getStyles().voiceTextarea
                  : {
                      ...getStyles().textarea,
                      ...(value.trim() ? getStyles().textareaFocus : {})
                    }
              }
            />
          )}
          {/* 移动端：精简布局 - 根据内容动态显示按钮 */}
          {isTouchDevice() ? (
            <>
              {/* 有文字时：显示发送按钮 */}
              {(value.trim() || recognizedText) && (
                <button
                  onClick={
                    recognizedText
                      ? handleSendRecognizedText
                      : () => onSend(value)
                  }
                  disabled={
                    recognizedText
                      ? !recognizedText.trim() && !value.trim()
                      : !value.trim()
                  }
                  style={{
                    ...getStyles().sendButton,
                    ...(!value.trim() && !recognizedText ? getStyles().sendButtonDisabled : {})
                  }}
                  onMouseEnter={(e) => {
                    if (value.trim() || recognizedText) {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (value.trim() || recognizedText) {
                      e.currentTarget.style.backgroundColor = '#3b82f6';
                    }
                  }}
                  title={recognizedText ? '发送' : t('ui.send')}
                >
                  <Send size={20} />
                </button>
              )}
              {/* 识别完毕时：显示取消按钮（在发送按钮右侧） */}
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
              {/* 无文字时：显示模式切换按钮 */}
              {enableVoiceInput && !value.trim() && !recognizedText && (
                <button
                  onClick={handleToggleInputMode}
                  style={getStyles().modeToggleButton}
                  onMouseEnter={(e) => {
                    Object.assign(e.currentTarget.style, getStyles().modeToggleButtonHover);
                  }}
                  onMouseLeave={(e) => {
                    Object.assign(e.currentTarget.style, getStyles().modeToggleButton);
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.borderRadius = '16px';
                    e.currentTarget.style.transform = 'scale(0.98)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.borderRadius = '16px';
                    e.currentTarget.style.transform = '';
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.borderRadius = '16px';
                    e.currentTarget.style.transform = 'scale(0.98)';
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.borderRadius = '16px';
                    e.currentTarget.style.transform = '';
                  }}
                  title={inputMode === 'voice' ? '切换到键盘模式' : '切换到语音模式'}
                >
                  {inputMode === 'voice' ? <Keyboard size={20} /> : <Mic size={20} />}
                </button>
              )}
            </>
          ) : (
            <>
              {/* PC端：与移动端相同的逻辑 */}
              {/* 有文字时：显示发送按钮 */}
              {(value.trim() || recognizedText || isLoading || isRecognizing) && (
                <button
                  onClick={
                    isRecognizing
                      ? handleCancelRecognizedText
                      : recognizedText
                        ? handleSendRecognizedText
                        : isLoading
                          ? onStop
                          : () => onSend(value)
                  }
                  disabled={
                    isRecognizing
                      ? false
                      : recognizedText
                        ? !recognizedText.trim() && !value.trim()
                        : !isLoading && !value.trim()
                  }
                  style={{
                    ...getStyles().sendButton,
                    ...(isLoading || isRecognizing ? getStyles().stopButton : {}),
                    ...(!isLoading && !isRecognizing && !value.trim() && !recognizedText ? getStyles().sendButtonDisabled : {})
                  }}
                  onMouseEnter={(e) => {
                    if (isLoading || isRecognizing) {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                    } else if (value.trim() || recognizedText) {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isLoading || isRecognizing) {
                      e.currentTarget.style.backgroundColor = '#ef4444';
                    } else if (value.trim() || recognizedText) {
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
              {/* 识别完毕时：显示取消按钮（在发送按钮右侧） */}
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
              {/* 无文字时：显示模式切换按钮 */}
              {enableVoiceInput && !value.trim() && !recognizedText && !isLoading && !isRecognizing && (
                <button
                  onClick={handleToggleInputMode}
                  style={getStyles().modeToggleButton}
                  onMouseEnter={(e) => {
                    Object.assign(e.currentTarget.style, getStyles().modeToggleButtonHover);
                  }}
                  onMouseLeave={(e) => {
                    Object.assign(e.currentTarget.style, getStyles().modeToggleButton);
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.borderRadius = '16px';
                    e.currentTarget.style.transform = 'scale(0.98)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.borderRadius = '16px';
                    e.currentTarget.style.transform = '';
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.borderRadius = '16px';
                    e.currentTarget.style.transform = 'scale(0.98)';
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.borderRadius = '16px';
                    e.currentTarget.style.transform = '';
                  }}
                  title={inputMode === 'voice' ? '切换到键盘模式' : '切换到语音模式'}
                >
                  {inputMode === 'voice' ? <Keyboard size={20} /> : <Mic size={20} />}
                </button>
              )}
            </>
          )}
        </div>
        {/* 错误提示 */}
        {recordingError && (
          <div style={getStyles().errorMessage}>
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
    </>
  );
};

export default ChatInput;
