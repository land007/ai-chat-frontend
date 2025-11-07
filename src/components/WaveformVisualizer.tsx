import React, { useRef, useEffect, useCallback } from 'react';

export interface WaveformVisualizerProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
  isDarkMode?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  analyserNode,
  isRecording,
  isDarkMode = false,
  width = 600,
  height = 40,
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousValuesRef = useRef<number[]>([]); // 用于时间平滑

  // 绘制单向柱状图（从左到右，从底部向上）
  const drawWaveform = useCallback(() => {
    if (!canvasRef.current || !analyserNode) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserNode.getByteFrequencyData(dataArray);

    // 设置canvas尺寸
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.offsetWidth;
    const displayHeight = canvas.offsetHeight;
    
    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // 优化配置：居中显示，不铺满横向
    const maxContentWidth = displayWidth * 0.85; // 最大内容宽度85%，左右留白
    const contentWidth = Math.min(maxContentWidth, width);
    const contentStartX = (displayWidth - contentWidth) / 2; // 居中位置
    
    // 柱子数量（适中，不要太多）
    const barCount = 32; // 固定柱子数量，保证一致性
    const barWidth = Math.max(2, (contentWidth / barCount) * 0.7); // 柱子宽度
    const barGap = (contentWidth / barCount) * 0.3; // 柱子间隙
    const maxBarHeight = displayHeight * 0.9; // 最大高度
    
    // 时间平滑系数（0-1，越大越平滑）
    const smoothingFactor = 0.3;
    
    // 初始化历史值数组
    if (previousValuesRef.current.length !== barCount) {
      previousValuesRef.current = new Array(barCount).fill(0);
    }
    
    // 对数分布采样函数：将线性索引转换为对数分布的频率索引
    const getLogIndex = (linearIndex: number, totalBars: number, totalFreqBins: number): number => {
      // 使用对数分布，让低频和高频采样更均匀
      // 低频部分采样更密集，高频部分采样更稀疏
      const normalizedPos = linearIndex / (totalBars - 1); // 0 到 1
      // 使用指数函数映射：让左侧（低频）采样更多点
      const logPos = Math.pow(normalizedPos, 1.5); // 1.5次方，可以根据需要调整
      return Math.floor(logPos * (totalFreqBins - 1));
    };

    for (let i = 0; i < barCount; i++) {
      // 使用对数分布获取频率索引
      const freqIndex = getLogIndex(i, barCount, bufferLength);
      
      // 频率混合：取相邻几个频率的平均值，让显示更平滑
      const mixRange = 2; // 混合范围
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, freqIndex - mixRange); j <= Math.min(bufferLength - 1, freqIndex + mixRange); j++) {
        sum += dataArray[j];
        count++;
      }
      const avgValue = sum / count;
      
      // 应用动态范围压缩：增强低频表现，适当压缩高频
      // 左侧（低频）增强，右侧（高频）保持原样或轻微压缩
      const positionFactor = i / barCount; // 0到1，左侧到右侧
      const compressedValue = avgValue * (0.8 + 0.4 * (1 - positionFactor)); // 左侧增强更多
      const normalizedValue = Math.min(255, compressedValue);
      
      // 时间平滑：与上一次的值混合，减少跳动
      const previousValue = previousValuesRef.current[i] || 0;
      const smoothedValue = previousValue * (1 - smoothingFactor) + normalizedValue * smoothingFactor;
      previousValuesRef.current[i] = smoothedValue;
      
      // 转换为柱状图高度
      const barHeight = (smoothedValue / 255) * maxBarHeight;
      
      // 最小高度（基线）
      const minHeight = 1.5;
      const finalBarHeight = Math.max(minHeight, barHeight);
      
      // 计算柱子位置（在居中区域内）
      const x = contentStartX + i * (barWidth + barGap);
      const y = displayHeight - finalBarHeight;
      
      // 创建渐变（从顶部到底部）
      const gradient = ctx.createLinearGradient(0, y, 0, displayHeight);
      gradient.addColorStop(0, isDarkMode ? '#60a5fa' : '#3b82f6');
      gradient.addColorStop(0.5, isDarkMode ? '#3b82f6' : '#2563eb');
      gradient.addColorStop(1, isDarkMode ? '#1e40af' : '#1e3a8a');

      // 绘制圆角矩形（从底部向上）
      ctx.fillStyle = gradient;
      const radius = Math.min(2, barWidth / 4);
      
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, displayHeight);
      ctx.lineTo(x, displayHeight);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
    }

    // 如果正在录音，继续动画循环
    if (isRecording && analyserNode) {
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    }
  }, [analyserNode, isRecording, isDarkMode]);

  // 动画循环
  useEffect(() => {
    if (isRecording && analyserNode && canvasRef.current) {
      // 启动动画循环
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    } else {
      // 停止动画，清除canvas和重置平滑历史
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // 重置平滑历史值
      previousValuesRef.current = [];
      // 清除canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    }

    // 清理函数
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isRecording, analyserNode, drawWaveform]);

  // 处理窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && isRecording) {
        drawWaveform();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isRecording, drawWaveform]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: `${height}px`,
        maxWidth: `${width}px`,
        display: 'block'
      }}
      className={className}
    />
  );
};

export default WaveformVisualizer;

