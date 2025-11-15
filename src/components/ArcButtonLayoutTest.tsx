import React, { useState, useEffect, useRef } from 'react';
import { X, Edit2, Mic } from 'lucide-react';
import VoiceRecognitionArcLayout from './VoiceRecognitionArcLayout';
import { ArcButtonConfig } from '@/types';

const ArcButtonLayoutTest: React.FC = () => {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [finalText, setFinalText] = useState('');
  const [currentSegment, setCurrentSegment] = useState('');
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const segmentSimulationRef = useRef<NodeJS.Timeout | null>(null);

  // 配置左侧按钮（取消）
  const leftButton: ArcButtonConfig = {
    text: '取消',
    icon: <X />,
    startAngle: -45,
    endAngle: -10,
    color: {
      normal: 'rgba(239, 68, 68, 0.08)',
      highlighted: 'rgba(239, 68, 68, 0.25)',
      border: 'rgba(239, 68, 68, 0.25)',
      borderHighlighted: '#ef4444',
    },
  };

  // 配置右侧按钮（编辑）
  const rightButton: ArcButtonConfig = {
    text: '编辑',
    icon: <Edit2 />,
    startAngle: 10,
    endAngle: 45,
    color: {
      normal: 'rgba(59, 130, 246, 0.08)',
      highlighted: 'rgba(59, 130, 246, 0.25)',
      border: 'rgba(59, 130, 246, 0.25)',
      borderHighlighted: '#3b82f6',
    },
  };

  // 初始化模拟的 AudioContext 和 AnalyserNode
  useEffect(() => {
    const initAudioContext = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        // 创建模拟音频源（使用振荡器生成测试音频）
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(analyser);
        
        // 设置低音量，避免实际播放声音
        gainNode.gain.value = 0.01;
        oscillator.frequency.value = 440; // A4 音符
        oscillator.type = 'sine';
        
        oscillator.start();
        
        audioContextRef.current = audioContext;
        setAnalyserNode(analyser);
      } catch (error) {
        console.error('初始化 AudioContext 失败:', error);
      }
    };

    initAudioContext();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // 模拟识别结果更新
  useEffect(() => {
    if (isRecording) {
      // 模拟实时识别文本更新
      const sampleTexts = [
        '这是',
        '这是一段',
        '这是一段测试',
        '这是一段测试文本',
        '这是一段测试文本，',
        '这是一段测试文本，用于',
        '这是一段测试文本，用于演示',
        '这是一段测试文本，用于演示语音',
        '这是一段测试文本，用于演示语音识别',
        '这是一段测试文本，用于演示语音识别功能',
      ];

      let index = 0;
      setFinalText('');
      setCurrentSegment('');
      
      segmentSimulationRef.current = setInterval(() => {
        if (index < sampleTexts.length) {
          const currentText = sampleTexts[index];
          const previousText = index > 0 ? sampleTexts[index - 1] : '';
          
          // 模拟已确定文本和正在识别的段落
          setFinalText(previousText);
          setCurrentSegment(currentText.substring(previousText.length));
          index++;
        } else {
          // 完成识别，将当前段落移到已确定文本
          setFinalText(sampleTexts[sampleTexts.length - 1]);
          setCurrentSegment('');
        }
      }, 800);
    } else {
      if (segmentSimulationRef.current) {
        clearInterval(segmentSimulationRef.current);
        segmentSimulationRef.current = null;
      }
    }

    return () => {
      if (segmentSimulationRef.current) {
        clearInterval(segmentSimulationRef.current);
      }
    };
  }, [isRecording]);

  // 录音时长计时器
  useEffect(() => {
    if (isRecording) {
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [isRecording]);

  // 处理回调函数
  const handleCancel = () => {
    setSelectedAction('取消');
    setIsRecording(false);
    setFinalText('');
    setCurrentSegment('');
    setRecordingDuration(0);
    console.log('取消操作');
    setTimeout(() => {
      setSelectedAction(null);
    }, 100);
  };

  const handleEdit = () => {
    setSelectedAction('编辑');
    setIsRecording(false);
    console.log('编辑操作');
    setTimeout(() => {
      setSelectedAction(null);
    }, 100);
  };

  const handleSend = () => {
    setSelectedAction('松开发送');
    setIsRecording(false);
    setFinalText('');
    setCurrentSegment('');
    setRecordingDuration(0);
    console.log('发送操作，识别文本:', finalText + currentSegment);
    setTimeout(() => {
      setSelectedAction(null);
    }, 100);
  };

  // 处理初始按钮按下（开始录音）
  const handleInitialButtonPress = () => {
    if (!isRecording) {
      // 按下初始按钮，开始录音
      setIsRecording(true);
      setRecordingDuration(0);
      setFinalText('');
      setCurrentSegment('');
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        position: 'relative',
        backgroundColor: '#f9fafb',
        overflow: 'hidden',
      }}
    >
      <VoiceRecognitionArcLayout
        finalText={finalText}
        currentSegment={currentSegment}
        analyserNode={analyserNode}
        isRecording={isRecording}
        sampleRate={audioContextRef.current?.sampleRate || 16000}
        recordingDuration={recordingDuration}
        onCancel={handleCancel}
        onEdit={handleEdit}
        onSend={handleSend}
        onInitialButtonPress={handleInitialButtonPress}
        leftButton={leftButton}
        rightButton={rightButton}
        centerButton={{
          text: '松开发送',
          color: {
            normal: '#64748b',
            highlighted: '#10b981', // 绿色，与编辑按钮的蓝色区分开
          },
        }}
        initialButton={{
          show: !isRecording,
          text: '点击说话',
          icon: <Mic size={20} />,
          position: {
            bottom: 20, // 从 80 降低到 20，更靠近底部
          },
        }}
        debug={true}
        disabled={false}
      />

      {/* 操作结果显示（可选） */}
      {selectedAction && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '20px 40px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: '600',
            zIndex: 2000,
            pointerEvents: 'none',
            transition: 'opacity 0.3s ease',
          }}
        >
          {selectedAction}
        </div>
      )}
    </div>
  );
};

export default ArcButtonLayoutTest;