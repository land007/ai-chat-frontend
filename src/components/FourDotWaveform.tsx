import React, { useRef, useEffect, useCallback } from 'react';

export interface FourDotWaveformProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
  isDarkMode?: boolean;
  minRadius?: number;
  maxRadius?: number;
  spacing?: number;
  sampleRate?: number; // AudioContext 的采样率
  className?: string;
}

const FourDotWaveform: React.FC<FourDotWaveformProps> = ({
  analyserNode,
  isRecording,
  isDarkMode = false,
  minRadius = 8,
  maxRadius = 24,
  spacing = 24,
  sampleRate = 16000, // 默认采样率，通常录音时是 16000 Hz
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousRadiiRef = useRef<number[]>([minRadius, minRadius, minRadius, minRadius]); // 用于时间平滑
  const previousEnergyRef = useRef<number>(0); // 用于跟踪总能量，实现衰减
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

    // 计算人声频段范围（300-3400 Hz）
    // 使用传入的采样率（通常录音时是 16000 Hz）
    const nyquistFreq = sampleRate / 2; // Nyquist 频率
    const freqPerBin = nyquistFreq / bufferLength; // 每个 bin 代表的频率
    
    // 人声频段：300-3400 Hz
    const voiceMinFreq = 300;  // 最低人声频率
    const voiceMaxFreq = 3400; // 最高人声频率
    
    // 计算对应的 bin 范围
    const voiceMinBin = Math.floor(voiceMinFreq / freqPerBin); // bin 5
    const voiceMaxBin = Math.floor(voiceMaxFreq / freqPerBin); // bin 54
    const voiceBinRange = voiceMaxBin - voiceMinBin; // 约 50 个 bins
    
    // 第一步：计算整体能量和更严格的阈值
    // 计算人声频段的总能量和平均能量
    let totalEnergy = 0;
    let energyCount = 0;
    for (let i = voiceMinBin; i <= voiceMaxBin && i < bufferLength; i++) {
      totalEnergy += dataArray[i];
      energyCount++;
    }
    const avgEnergy = energyCount > 0 ? totalEnergy / energyCount : 0;
    
    // 使用更严格的相对阈值：平均能量的50%（之前是30%）
    // 只有当整体能量明显超过环境噪音时，才认为是有效人声
    const relativeThreshold = Math.max(15, avgEnergy * 0.5); // 提高阈值到50%
    const absoluteThreshold = 20; // 绝对阈值，至少20
    
    // 总能量阈值：只有当总能量超过这个值时，才显示明显放大
    // 这样可以避免单个频段的持续噪音
    const totalEnergyThreshold = Math.max(30, avgEnergy * 0.8);
    const hasSignificantEnergy = totalEnergy > totalEnergyThreshold;
    
    // 将人声频段分成4个相等的子频段
    const frequencies: number[] = [];
    const segmentSize = Math.floor(voiceBinRange / dotCount);
    
    for (let i = 0; i < dotCount; i++) {
      // 计算该子频段的 bin 范围
      const segmentStart = voiceMinBin + i * segmentSize;
      const segmentEnd = Math.min(voiceMinBin + (i + 1) * segmentSize, voiceMaxBin);
      
      // 统计该频段的能量
      let maxValue = 0;
      let sum = 0;
      let count = 0;
      let peakSum = 0;
      let peakCount = 0;
      
      for (let j = segmentStart; j <= segmentEnd && j < bufferLength; j++) {
        const value = dataArray[j];
        sum += value;
        count++;
        if (value > maxValue) {
          maxValue = value;
        }
        // 检测峰值（超过相对阈值的值）
        if (value > relativeThreshold) {
          peakSum += value;
          peakCount++;
        }
      }
      
      const avgValue = count > 0 ? sum / count : 0;
      
      // 如果该频段有峰值（人声），使用峰值能量；否则使用平均值但降低权重
      let mixedValue;
      if (peakCount > 0 && maxValue > relativeThreshold && hasSignificantEnergy) {
        // 有人声且整体能量足够：使用峰值能量，突出人声
        const peakAvg = peakSum / peakCount;
        mixedValue = peakAvg * 0.85 + avgValue * 0.15;
      } else {
        // 无人声或整体能量不足：使用降低的平均值
        mixedValue = avgValue * 0.4; // 进一步降低权重
      }
      
      // 应用更严格的阈值过滤：如果能量太低，认为是环境噪音
      const effectiveThreshold = Math.max(relativeThreshold, absoluteThreshold);
      if (mixedValue < effectiveThreshold) {
        mixedValue = mixedValue * 0.2; // 更激进的衰减
      }
      
      frequencies.push(Math.min(255, mixedValue));
    }
    
    // 频段增益平衡：降低高频段的默认增益，避免右侧持续大
    // 高频段（右侧）的增益因子，范围从 1.0（左侧）到 0.80（右侧）
    // 这样可以减少高频环境噪音的影响
    const frequencyGainFactors = [1.0, 0.92, 0.85, 0.80];
    
    // 应用增益平衡（仅在整体能量足够时）
    if (hasSignificantEnergy) {
      for (let i = 0; i < dotCount; i++) {
        // 直接应用增益因子，降低高频段的响应
        frequencies[i] = Math.min(255, frequencies[i] * frequencyGainFactors[i]);
      }
    }

    // 时间衰减机制：当能量持续低于阈值时，快速衰减到基础大小
    const decayFactor = 0.85; // 衰减系数，值越小衰减越快
    
    // 使用原始总能量来判断是否需要衰减（更准确）
    // 如果当前原始总能量低于阈值，应用衰减
    if (totalEnergy < totalEnergyThreshold * energyCount) {
      // 快速衰减到基础大小
      previousEnergyRef.current = previousEnergyRef.current * decayFactor;
    } else {
      // 有足够能量，更新能量记录（使用原始总能量）
      previousEnergyRef.current = totalEnergy;
    }
    
    // 时间平滑系数：让人声变化更明显
    const smoothingFactor = hasSignificantEnergy ? 0.35 : 0.5; // 能量低时更平滑（衰减更快）
    const currentRadii: number[] = [];

    // 计算每个点的半径并应用平滑
    for (let i = 0; i < dotCount; i++) {
      // 使用更激进的非线性映射（平方），让人声变化更明显
      const normalizedValue = frequencies[i] / 255;
      // 使用平方映射替代平方根，增强动态范围
      const squaredValue = Math.pow(Math.max(0, normalizedValue), 1.5); // 1.5次方，介于平方根和平方之间
      
      // 映射到半径范围
      // 降低基础偏移到5%，让人声变化更明显
      // 当没有明显人声时，点会保持很小
      const baseOffset = 0.05; // 基础大小只有5%（之前是10%）
      const dynamicRange = 1 - baseOffset; // 动态范围95%
      
      // 目标半径：基础大小 + 动态范围 * 映射值
      let targetRadius = minRadius + baseOffset * (maxRadius - minRadius) + 
                         squaredValue * dynamicRange * (maxRadius - minRadius);
      
      // 如果整体能量不足，应用额外的衰减
      if (!hasSignificantEnergy) {
        targetRadius = minRadius + (targetRadius - minRadius) * 0.3;
      }
      
      // 时间平滑：让人声变化更流畅
      // 当能量低时，使用更强的衰减
      const previousRadius = previousRadiiRef.current[i] || minRadius;
      let smoothedRadius;
      
      if (hasSignificantEnergy && normalizedValue > 0.1) {
        // 有足够能量：正常平滑
        smoothedRadius = previousRadius * (1 - smoothingFactor) + targetRadius * smoothingFactor;
      } else {
        // 能量不足：快速衰减
        const decaySmoothingFactor = 0.6; // 更强的衰减
        smoothedRadius = previousRadius * (1 - decaySmoothingFactor) + targetRadius * decaySmoothingFactor;
      }
      
      // 确保半径不会低于基础大小
      smoothedRadius = Math.max(minRadius + baseOffset * (maxRadius - minRadius), smoothedRadius);
      
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
  }, [analyserNode, isRecording, isDarkMode, minRadius, maxRadius, spacing, sampleRate]);

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
      // 重置平滑历史值（使用基础大小，包含基础偏移5%）
      const baseRadius = minRadius + 0.05 * (maxRadius - minRadius);
      previousRadiiRef.current = [baseRadius, baseRadius, baseRadius, baseRadius];
      previousEnergyRef.current = 0;
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

