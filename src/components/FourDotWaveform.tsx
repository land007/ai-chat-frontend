import React, { useRef, useEffect, useCallback } from 'react';

export interface FourDotWaveformProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
  isDarkMode?: boolean;
  minRadius?: number;
  maxRadius?: number;
  spacing?: number;
  className?: string;
}

const FourDotWaveform: React.FC<FourDotWaveformProps> = ({
  analyserNode,
  isRecording,
  isDarkMode = false,
  minRadius = 8,
  maxRadius = 24,
  spacing = 24,
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousRadiiRef = useRef<number[]>([minRadius, minRadius, minRadius, minRadius]); // 用于时间平滑
  const dotCount = 4;

  // 绘制4个点的波形
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
    const displayWidth = canvas.offsetWidth || 200;
    const displayHeight = canvas.offsetHeight || 40;
    
    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const centerY = displayHeight / 2;

    // 将频率数据分成4个频段，使用更智能的分段策略
    // 使用对数分布，让低频和高频段的采样更合理
    const frequencies: number[] = [];
    // 不同频段的敏感度增益，让每个频段独立响应
    const frequencySensitivity = [1.0, 1.15, 1.3, 1.45]; // 高频段更敏感

    for (let i = 0; i < dotCount; i++) {
      // 使用对数分布计算频段范围
      // 低频段采样更多数据点，高频段采样更少但更敏感
      const logStart = Math.pow(i / dotCount, 0.65) * bufferLength;
      const logEnd = Math.pow((i + 1) / dotCount, 0.65) * bufferLength;
      
      const start = Math.floor(logStart);
      const end = Math.min(Math.floor(logEnd), bufferLength);
      
      // 使用最大值而不是平均值，让峰值更突出，增强视觉差异
      let maxValue = 0;
      let sum = 0;
      let count = 0;
      let peakCount = 0; // 峰值数量
      
      // 计算峰值阈值（超过平均值的值）
      for (let j = start; j < end; j++) {
        const value = dataArray[j];
        sum += value;
        count++;
        if (value > maxValue) {
          maxValue = value;
        }
      }
      
      const avgValue = count > 0 ? sum / count : 0;
      const peakThreshold = avgValue * 1.5; // 峰值阈值
      
      // 统计峰值数量和平均值
      let peakSum = 0;
      for (let j = start; j < end; j++) {
        const value = dataArray[j];
        if (value > peakThreshold) {
          peakSum += value;
          peakCount++;
        }
      }
      
      // 混合策略：峰值能量 + 平均值
      // 如果该频段有峰值，优先使用峰值；否则使用平均值
      let mixedValue;
      if (peakCount > 0 && maxValue > peakThreshold) {
        // 有峰值：70%峰值能量 + 30%平均值
        const peakAvg = peakSum / peakCount;
        mixedValue = peakAvg * 0.7 + avgValue * 0.3;
      } else {
        // 无峰值：使用增强的平均值
        mixedValue = avgValue * 1.2;
      }
      
      // 应用频段敏感度，让不同频段更独立
      // 高频段更敏感，能更好地响应声音变化
      const adjustedValue = Math.min(255, mixedValue * frequencySensitivity[i]);
      
      frequencies.push(adjustedValue);
    }

    // 减少平滑系数，让变化更明显（从0.4降到0.25）
    const smoothingFactor = 0.25;
    const currentRadii: number[] = [];

    // 计算每个点的半径并应用平滑
    for (let i = 0; i < dotCount; i++) {
      // 使用非线性映射（平方根），让小的变化更明显，大的变化不会过度
      // 同时添加基础偏移，确保即使没有声音也有可见的基础大小
      const normalizedValue = frequencies[i] / 255;
      const sqrtValue = Math.sqrt(Math.max(0, normalizedValue)); // 平方根映射
      
      // 映射到半径范围，添加基础偏移（20%的基础大小）
      const baseOffset = 0.2; // 即使没有声音也有20%的大小
      const targetRadius = minRadius + baseOffset * (maxRadius - minRadius) + 
                          sqrtValue * (1 - baseOffset) * (maxRadius - minRadius);
      
      // 时间平滑：减少平滑度，让变化更明显
      const previousRadius = previousRadiiRef.current[i] || minRadius;
      const smoothedRadius = previousRadius * (1 - smoothingFactor) + targetRadius * smoothingFactor;
      
      currentRadii.push(smoothedRadius);
      previousRadiiRef.current[i] = smoothedRadius;
    }

    // 计算4个点的位置（水平居中排列）
    // 使用当前最大半径动态计算位置，让布局更紧凑
    const currentMaxRadius = Math.max(...currentRadii);
    const totalWidth = (dotCount - 1) * spacing + dotCount * currentMaxRadius * 2;
    const startX = (displayWidth - totalWidth) / 2 + currentMaxRadius;

    // 绘制4个圆点
    for (let i = 0; i < dotCount; i++) {
      const radius = currentRadii[i];
      // 动态计算位置，根据当前最大半径
      const x = startX + i * (spacing + currentMaxRadius * 2);
      
      // 创建径向渐变
      const gradient = ctx.createRadialGradient(x, centerY, 0, x, centerY, radius);
      
      // 根据声音大小调整颜色强度
      const intensity = (radius - minRadius) / (maxRadius - minRadius);
      const alpha = 0.7 + intensity * 0.3; // 透明度随声音大小变化
      
      if (isDarkMode) {
        gradient.addColorStop(0, `rgba(96, 165, 250, ${alpha})`); // #60a5fa
        gradient.addColorStop(0.5, `rgba(59, 130, 246, ${alpha * 0.8})`); // #3b82f6
        gradient.addColorStop(1, `rgba(37, 99, 235, ${alpha * 0.6})`); // #2563eb
      } else {
        gradient.addColorStop(0, `rgba(59, 130, 246, ${alpha})`); // #3b82f6
        gradient.addColorStop(0.5, `rgba(37, 99, 235, ${alpha * 0.8})`); // #2563eb
        gradient.addColorStop(1, `rgba(30, 64, 175, ${alpha * 0.6})`); // #1e40af
      }

      // 添加外发光效果（当声音较大时）
      if (intensity > 0.3) {
        ctx.shadowBlur = radius * 0.5;
        ctx.shadowColor = isDarkMode 
          ? `rgba(96, 165, 250, ${alpha * 0.5})` 
          : `rgba(59, 130, 246, ${alpha * 0.5})`;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // 重置阴影
      ctx.shadowBlur = 0;
    }

    // 如果正在录音，继续动画循环
    if (isRecording && analyserNode) {
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    }
  }, [analyserNode, isRecording, isDarkMode, minRadius, maxRadius, spacing]);

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
      // 重置平滑历史值（使用基础大小，包含基础偏移）
      const baseRadius = minRadius + 0.2 * (maxRadius - minRadius);
      previousRadiiRef.current = [baseRadius, baseRadius, baseRadius, baseRadius];
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
  }, [isRecording, analyserNode, drawWaveform, minRadius]);

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
        height: '60px',
        maxWidth: '320px',
        display: 'block',
        margin: '0 auto'
      }}
      className={className}
    />
  );
};

export default FourDotWaveform;

