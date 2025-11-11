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
  
  // 录音相关refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const currentTranscriptRef = useRef<string>(''); // 当前累积的识别文本
  const voiceInputModeRef = useRef<'vad' | 'manual'>('vad'); // 当前使用的模式
  const isRecordingRef = useRef<boolean>(false); // 录音状态ref（用于闭包中访问）
  const isInitializingRef = useRef<boolean>(false); // 初始化状态ref（防止过早清理）
  const recordingStartTimeRef = useRef<number>(0); // 录音开始时间（用于最小录音时长保护）
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 识别超时定时器ref
  const mainTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const audioBufferRef = useRef<ArrayBuffer[]>([]); // 音频缓冲区：存储连接建立前的音频数据
  const isConnectionReadyRef = useRef<boolean>(false); // 连接是否已就绪
  const isSendingBufferedRef = useRef<boolean>(false); // 是否正在发送缓冲音频
  const maxBufferSize = 150; // 最大缓冲音频块数（约3秒，假设50块/秒）
  
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

    speechRecognitionService.close().catch(err => {
      console.error('[语音输入] 关闭语音识别服务失败:', err);
    });
    
    isInitializingRef.current = false;
    
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
    }

    setIsRecognizing(prev => {
      if (prev) {
        console.log('[语音输入] 清理资源时检测到仍在识别状态，立即重置');
        setRecognizedText(prevText => {
          if (!prevText || prevText.trim() === '') {
            onChange('');
            return null;
          }
          return prevText;
        });
        return false;
      }
      return prev;
    });
  }, [onChange]);

  // 开始录音
  const startRecording = useCallback(async () => {
    isInitializingRef.current = true;
    recordingStartTimeRef.current = Date.now();
    
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
      setRecognizedText(null);
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
        console.log('[语音输入] 识别结果:', text, 'isFinal:', isFinal);
        
        currentTranscriptRef.current = text;
        setRecognizedText(text);
        onChange(text);
        
        if (isFinal) {
          console.log('[语音输入] ✅ 最终识别结果:', text);
          if (recognitionTimeoutRef.current) {
            clearTimeout(recognitionTimeoutRef.current);
            recognitionTimeoutRef.current = null;
          }
          setIsRecognizing(false);
          setIsRecording(false);
          isRecordingRef.current = false;
          
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
          }
          
          cleanupAudioResources();
        } else {
          console.log('[语音输入] 📝 实时识别结果:', text);
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
        // 识别失败时，清空识别结果，回到按钮状态
        setRecognizedText(null);
        onChange('');
        cleanupAudioResources();
      });

      speechRecognitionService.onComplete(() => {
        console.log('[语音输入] 识别完成');
        if (recognitionTimeoutRef.current) {
          clearTimeout(recognitionTimeoutRef.current);
          recognitionTimeoutRef.current = null;
        }
        setIsRecognizing(false);
        setIsRecording(false);
        isRecordingRef.current = false;
        
        setRecognizedText(prevText => {
          if (!prevText || prevText.trim() === '') {
            onChange('');
            return null;
          }
          return prevText;
        });
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
    
    if (voiceInputModeRef.current === 'manual') {
      console.log('[语音输入] Manual模式，主动提交音频并立即停止发送');
      isRecordingRef.current = false;
      speechRecognitionService.commit().catch(err => {
        console.error('[语音输入] 提交音频失败:', err);
        setRecordingError(`提交音频失败: ${err.message}`);
      });
    } else {
      console.log('[语音输入] VAD模式，等待服务器自动检测结束');
      setTimeout(() => {
        isRecordingRef.current = false;
        console.log('[语音输入] isRecordingRef已设置为false（延迟设置）');
      }, 2000);
    }

    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
    }

    recognitionTimeoutRef.current = setTimeout(() => {
      setIsRecognizing(prev => {
        if (prev) {
          console.log('[语音输入] 识别超时（3秒未收到结果），自动重置识别状态');
          setRecognizedText(prevText => {
            if (!prevText || prevText.trim() === '') {
              onChange('');
              return null;
            }
            return prevText;
          });
          recognitionTimeoutRef.current = null;
          return false;
        }
        return prev;
      });
    }, 3000);

    if (isInitializingRef.current) {
      console.log('[语音输入] 正在初始化，等待初始化完成后再清理...');
      const checkInterval = setInterval(() => {
        if (!isInitializingRef.current) {
          clearInterval(checkInterval);
          setTimeout(() => {
            cleanupAudioResources();
          }, 1000);
        }
      }, 50);
    } else {
      setTimeout(() => {
        cleanupAudioResources();
      }, 1000);
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
    const textToSend = recognizedText || value.trim();
    if (textToSend && !isLoading) {
      onChange(textToSend);
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
      console.log('[语音输入] 触摸设备，按住开始录音（Manual模式）');
      // 立即设置 isRecognizing 为 true，确保按钮立即显示，不显示输入框
      setIsRecognizing(true);
      // 然后异步开始录音
      startRecording();
    }
  }, [inputMode, isRecording, isRecognizing, startRecording, stopRecording]);

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
  }, [inputMode, isRecording, isRecognizing, stopRecording]);

  const handleVoiceButtonTouchCancel = useCallback((e: React.TouchEvent) => {
    console.log('[语音输入] handleVoiceButtonTouchCancel 触发', { inputMode, isRecording, isRecognizing });
    // 触摸取消时也结束录音（例如用户手指移出按钮区域）
    if (inputMode === 'voice' && isRecording) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[语音输入] 触摸取消，结束录音');
      stopRecording();
    }
  }, [inputMode, isRecording, isRecognizing, stopRecording]);

  // 处理指针事件（Pointer Events API，更现代的方式，支持触摸和鼠标）
  const handleVoiceButtonPointerUp = useCallback((e: React.PointerEvent) => {
    console.log('[语音输入] handleVoiceButtonPointerUp 触发', { inputMode, isRecording, isRecognizing, isStopping: isStoppingRef.current });
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
  }, [inputMode, isRecording, isRecognizing, stopRecording]);

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
        justifyContent: 'center',
        gap: '16px',
        height: '56px'
      },
      recordingDuration: {
        fontSize: '14px',
        color: mutedColor,
        minWidth: '50px',
        textAlign: 'center' as const
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
        backgroundColor: inputMode === 'voice' ? '#3b82f6' : (isDarkMode ? '#4b5563' : '#f3f4f6'),
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
        backgroundColor: inputMode === 'voice' ? '#2563eb' : (isDarkMode ? '#6b7280' : '#e5e7eb')
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
  // 按住时（isRecording = true 或 isRecognizing = true）：始终显示按钮，即使有识别结果
  // 松开后（isRecording = false 且 isRecognizing = false）：显示输入框，等待最终识别结果
  // 注意：isRecognizing 在初始化时就会变为 true，所以即使 isRecording 还没 true，也应该显示按钮
  const shouldShowVoiceButton = inputMode === 'voice' && isTouchDevice() && 
    (isRecording || isRecognizing || (!recognizedText && !value.trim()));
  
  // 识别中时输入框显示空白（不是"识别中..."）
  const displayValue = recognizedText || value;

  const displayPlaceholder = inputMode === 'voice' && !isRecording && !isRecognizing && !shouldShowVoiceButton
    ? (isTouchDevice() ? '按住说话，松开结束' : '点击说话，自动结束')
    : (placeholder || t('ui.inputPlaceholder'));

  return (
    <>
      {/* 音波效果显示区域（仅录音时显示） */}
      {isRecording && (
        <div style={getStyles().waveformArea}>
          {/* 识别内容显示区域（在波形上方） */}
          {recognizedText && (
            <div style={getStyles().transcriptArea}>
              <div style={getStyles().transcriptText}>
                {recognizedText}
              </div>
            </div>
          )}
          {/* 波形和时间显示容器 */}
          <div style={getStyles().waveformContainer}>
            <FourDotWaveform
              analyserNode={analyserRef.current}
              isRecording={isRecording}
              isDarkMode={isDarkMode}
              minRadius={8}
              maxRadius={24}
              spacing={24}
              sampleRate={audioContextRef.current?.sampleRate || 16000}
            />
            <div style={getStyles().recordingDuration}>
              {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:
              {String(recordingDuration % 60).padStart(2, '0')}
            </div>
          </div>
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
                  onChange(newValue);
                  if (recognizedText && newValue !== recognizedText) {
                    setRecognizedText(null);
                  }
                }
              }}
              onKeyPress={handleKeyPress}
              placeholder={displayPlaceholder}
              readOnly={inputMode === 'voice' && !isRecording && !isRecognizing && !recognizedText && !isTouchDevice()}
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
                }
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
          {/* 发送按钮（键盘模式或识别结果时显示） */}
          {/* 识别中时，只有电脑（VAD模式）才显示X按钮，手机（Manual模式）不显示 */}
          {(inputMode === 'keyboard' || recognizedText || (isRecognizing && !isTouchDevice())) && (
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
          {enableVoiceInput && !recognizedText && (
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
