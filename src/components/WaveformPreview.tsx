import React, { useRef, useEffect, useState, useCallback } from 'react';

interface WaveformPreviewProps {
  isDarkMode?: boolean;
  onSelectStyle?: (style: string) => void;
}

const WaveformPreview: React.FC<WaveformPreviewProps> = ({ 
  isDarkMode = false,
  onSelectStyle 
}) => {
  const canvas1Ref = useRef<HTMLCanvasElement>(null); // 样式A：对称柱状图
  const canvas2Ref = useRef<HTMLCanvasElement>(null); // 样式B：平滑曲线
  const canvas3Ref = useRef<HTMLCanvasElement>(null); // 样式C：粒子效果
  const canvas4Ref = useRef<HTMLCanvasElement>(null); // 样式D：流动渐变
  const canvas5Ref = useRef<HTMLCanvasElement>(null); // 当前样式（对比）
  
  const animationFrameRef = useRef<number | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  
  // 生成模拟音频数据（模拟实时录音效果）
  const generateMockAudioData = useCallback(() => {
    const bars = 64;
    const data = new Uint8Array(bars);
    const time = Date.now() * 0.005;
    
    for (let i = 0; i < bars; i++) {
      // 模拟声音波形，添加一些随机性和时间变化
      const position = i / bars;
      const wave1 = Math.sin(time + position * Math.PI * 4) * 0.5 + 0.5;
      const wave2 = Math.sin(time * 0.7 + position * Math.PI * 8) * 0.3 + 0.5;
      const wave3 = Math.sin(time * 1.3 + position * Math.PI * 2) * 0.2 + 0.5;
      const noise = (Math.random() - 0.5) * 0.1;
      
      data[i] = Math.min(255, Math.max(0, (wave1 + wave2 + wave3 + noise) * 255));
    }
    
    return data;
  }, []);
  
  // 样式A：对称柱状图（圆角、渐变、平滑动画）
  const drawStyleA = useCallback((canvas: HTMLCanvasElement, data: Uint8Array) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    const centerX = width / 2;
    const barWidth = 4;
    const barGap = 2;
    const maxBarHeight = height * 0.8;
    const halfBars = Math.floor(data.length / 2);
    
    ctx.clearRect(0, 0, width, height);
    
    // 绘制中心线
    ctx.strokeStyle = isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();
    
    // 从中心向两侧绘制
    for (let i = 0; i < halfBars; i++) {
      const value = data[i + halfBars];
      const barHeight = (value / 255) * maxBarHeight;
      const x = centerX - (halfBars - i) * (barWidth + barGap) - barWidth / 2;
      
      // 创建渐变
      const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
      gradient.addColorStop(0, isDarkMode ? '#60a5fa' : '#3b82f6');
      gradient.addColorStop(0.5, isDarkMode ? '#3b82f6' : '#2563eb');
      gradient.addColorStop(1, isDarkMode ? '#1e40af' : '#1e3a8a');
      
      // 绘制圆角矩形
      ctx.fillStyle = gradient;
      ctx.beginPath();
      const radius = 2;
      const y = height - barHeight;
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, height);
      ctx.lineTo(x, height);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
      
      // 右侧对称
      const x2 = centerX + i * (barWidth + barGap) + barGap;
      ctx.beginPath();
      ctx.moveTo(x2 + radius, y);
      ctx.lineTo(x2 + barWidth - radius, y);
      ctx.quadraticCurveTo(x2 + barWidth, y, x2 + barWidth, y + radius);
      ctx.lineTo(x2 + barWidth, height);
      ctx.lineTo(x2, height);
      ctx.lineTo(x2, y + radius);
      ctx.quadraticCurveTo(x2, y, x2 + radius, y);
      ctx.closePath();
      ctx.fill();
    }
  }, [isDarkMode]);
  
  // 样式B：平滑波形曲线
  const drawStyleB = useCallback((canvas: HTMLCanvasElement, data: Uint8Array) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    const centerY = height / 2;
    const maxAmplitude = height * 0.4;
    const stepX = width / data.length;
    
    ctx.clearRect(0, 0, width, height);
    
    // 绘制中心线
    ctx.strokeStyle = isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // 绘制上波形
    ctx.strokeStyle = isDarkMode ? '#60a5fa' : '#3b82f6';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 4;
    ctx.shadowColor = isDarkMode ? 'rgba(96, 165, 250, 0.5)' : 'rgba(59, 130, 246, 0.5)';
    ctx.beginPath();
    
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const value = data[i] / 255;
      const y = centerY - value * maxAmplitude;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // 绘制下波形（镜像）
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const value = data[i] / 255;
      const y = centerY + value * maxAmplitude;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    
    // 填充区域
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(37, 99, 235, 0.1)');
    gradient.addColorStop(0.5, isDarkMode ? 'rgba(59, 130, 246, 0.05)' : 'rgba(37, 99, 235, 0.05)');
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const value = data[i] / 255;
      const y = centerY - value * maxAmplitude;
      ctx.lineTo(x, y);
    }
    for (let i = data.length - 1; i >= 0; i--) {
      const x = i * stepX;
      const value = data[i] / 255;
      const y = centerY + value * maxAmplitude;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }, [isDarkMode]);
  
  // 样式C：粒子效果
  const drawStyleC = useCallback((canvas: HTMLCanvasElement, data: Uint8Array) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    const centerY = height / 2;
    const maxAmplitude = height * 0.4;
    const stepX = width / data.length;
    const particleRadius = 3;
    
    ctx.clearRect(0, 0, width, height);
    
    // 绘制中心线
    ctx.strokeStyle = isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // 绘制上粒子
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const value = data[i] / 255;
      const y = centerY - value * maxAmplitude;
      const alpha = 0.6 + value * 0.4;
      
      // 创建径向渐变
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, particleRadius);
      gradient.addColorStop(0, isDarkMode ? `rgba(96, 165, 250, ${alpha})` : `rgba(59, 130, 246, ${alpha})`);
      gradient.addColorStop(1, isDarkMode ? `rgba(59, 130, 246, ${alpha * 0.3})` : `rgba(37, 99, 235, ${alpha * 0.3})`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, particleRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // 绘制连接线
      if (i > 0) {
        const prevX = (i - 1) * stepX;
        const prevValue = data[i - 1] / 255;
        const prevY = centerY - prevValue * maxAmplitude;
        
        ctx.strokeStyle = isDarkMode ? `rgba(59, 130, 246, ${alpha * 0.3})` : `rgba(37, 99, 235, ${alpha * 0.3})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
    
    // 绘制下粒子（镜像）
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const value = data[i] / 255;
      const y = centerY + value * maxAmplitude;
      const alpha = 0.6 + value * 0.4;
      
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, particleRadius);
      gradient.addColorStop(0, isDarkMode ? `rgba(96, 165, 250, ${alpha})` : `rgba(59, 130, 246, ${alpha})`);
      gradient.addColorStop(1, isDarkMode ? `rgba(59, 130, 246, ${alpha * 0.3})` : `rgba(37, 99, 235, ${alpha * 0.3})`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, particleRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [isDarkMode]);
  
  // 样式D：流动渐变柱状图
  const drawStyleD = useCallback((canvas: HTMLCanvasElement, data: Uint8Array) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    const barWidth = (width / data.length) * 0.8;
    const barGap = (width / data.length) * 0.2;
    const maxBarHeight = height * 0.9;
    const time = Date.now() * 0.001;
    
    ctx.clearRect(0, 0, width, height);
    
    for (let i = 0; i < data.length; i++) {
      const value = data[i] / 255;
      const barHeight = value * maxBarHeight;
      const x = i * (barWidth + barGap);
      const y = height - barHeight;
      
      // 创建流动渐变
      const gradient = ctx.createLinearGradient(0, y, 0, height);
      const hue = (i / data.length + time * 0.1) % 1;
      const r = Math.sin(hue * Math.PI * 2) * 0.5 + 0.5;
      const g = Math.sin((hue + 0.33) * Math.PI * 2) * 0.5 + 0.5;
      const b = Math.sin((hue + 0.66) * Math.PI * 2) * 0.5 + 0.5;
      
      if (isDarkMode) {
        gradient.addColorStop(0, `rgba(${59 + r * 100}, ${130 + g * 50}, ${246 + b * 10}, 1)`);
        gradient.addColorStop(1, `rgba(${30 + r * 50}, ${64 + g * 30}, ${175 + b * 20}, 0.8)`);
      } else {
        gradient.addColorStop(0, `rgba(${37 + r * 100}, ${99 + g * 50}, ${235 + b * 10}, 1)`);
        gradient.addColorStop(1, `rgba(${30 + r * 50}, ${58 + g * 30}, ${138 + b * 20}, 0.8)`);
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // 添加高光
      const highlightGradient = ctx.createLinearGradient(x, y, x, y + barHeight * 0.3);
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      highlightGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = highlightGradient;
      ctx.fillRect(x, y, barWidth, barHeight * 0.3);
    }
  }, [isDarkMode]);
  
  // 当前样式（对比用）
  const drawCurrentStyle = useCallback((canvas: HTMLCanvasElement, data: Uint8Array) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    const barWidth = (width / data.length) * 2.5;
    let x = 0;
    
    ctx.clearRect(0, 0, width, height);
    
    for (let i = 0; i < data.length; i++) {
      const barHeight = (data[i] / 255) * height;
      
      const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
      gradient.addColorStop(0, isDarkMode ? '#3b82f6' : '#2563eb');
      gradient.addColorStop(1, isDarkMode ? '#60a5fa' : '#3b82f6');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      
      x += barWidth + 1;
    }
  }, [isDarkMode]);
  
  // 动画循环
  useEffect(() => {
    const animate = () => {
      const data = generateMockAudioData();
      
      if (canvas1Ref.current) drawStyleA(canvas1Ref.current, data);
      if (canvas2Ref.current) drawStyleB(canvas2Ref.current, data);
      if (canvas3Ref.current) drawStyleC(canvas3Ref.current, data);
      if (canvas4Ref.current) drawStyleD(canvas4Ref.current, data);
      if (canvas5Ref.current) drawCurrentStyle(canvas5Ref.current, data);
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [generateMockAudioData, drawStyleA, drawStyleB, drawStyleC, drawStyleD, drawCurrentStyle]);
  
  // 处理样式选择
  const handleStyleClick = (style: string) => {
    setSelectedStyle(style);
    onSelectStyle?.(style);
  };
  
  const canvasContainerStyle = {
    padding: '16px',
    backgroundColor: isDarkMode ? '#374151' : '#f9fafb',
    borderRadius: '8px',
    border: `2px solid ${selectedStyle ? '#3b82f6' : (isDarkMode ? '#4b5563' : '#e5e7eb')}`,
    cursor: 'pointer',
    transition: 'all 0.3s',
    marginBottom: '16px'
  };
  
  const selectedContainerStyle = {
    ...canvasContainerStyle,
    borderColor: '#3b82f6',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
  };
  
  return (
    <div style={{
      padding: '24px',
      backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
      minHeight: 'calc(100vh - 60px)',
      paddingBottom: '48px'
    }}>
      <h2 style={{
        color: isDarkMode ? '#f9fafb' : '#111827',
        marginBottom: '24px',
        fontSize: '24px',
        fontWeight: '600'
      }}>
        波形显示效果预览
      </h2>
      <p style={{
        color: isDarkMode ? '#9ca3af' : '#6b7280',
        marginBottom: '32px',
        fontSize: '14px'
      }}>
        点击下方样式卡片选择你喜欢的波形显示效果（实时模拟音频数据）
      </p>
      
      {/* 样式A：对称柱状图 */}
      <div
        onClick={() => handleStyleClick('styleA')}
        style={selectedStyle === 'styleA' ? selectedContainerStyle : canvasContainerStyle}
      >
        <div style={{
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            color: isDarkMode ? '#f9fafb' : '#111827',
            fontSize: '18px',
            fontWeight: '600',
            margin: 0
          }}>
            样式A：对称柱状图（圆角渐变）
          </h3>
          {selectedStyle === 'styleA' && (
            <span style={{
              color: '#3b82f6',
              fontSize: '14px',
              fontWeight: '600'
            }}>✓ 已选择</span>
          )}
        </div>
        <canvas
          ref={canvas1Ref}
          width={600}
          height={80}
          style={{
            width: '100%',
            maxWidth: '600px',
            height: '80px',
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#1f2937' : '#ffffff'
          }}
        />
        <p style={{
          color: isDarkMode ? '#9ca3af' : '#6b7280',
          fontSize: '12px',
          marginTop: '8px',
          marginBottom: 0
        }}>
          从中心向两侧对称分布，圆角矩形，蓝色渐变，适合语音录音场景
        </p>
      </div>
      
      {/* 样式B：平滑曲线 */}
      <div
        onClick={() => handleStyleClick('styleB')}
        style={selectedStyle === 'styleB' ? selectedContainerStyle : canvasContainerStyle}
      >
        <div style={{
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            color: isDarkMode ? '#f9fafb' : '#111827',
            fontSize: '18px',
            fontWeight: '600',
            margin: 0
          }}>
            样式B：平滑波形曲线
          </h3>
          {selectedStyle === 'styleB' && (
            <span style={{
              color: '#3b82f6',
              fontSize: '14px',
              fontWeight: '600'
            }}>✓ 已选择</span>
          )}
        </div>
        <canvas
          ref={canvas2Ref}
          width={600}
          height={80}
          style={{
            width: '100%',
            maxWidth: '600px',
            height: '80px',
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#1f2937' : '#ffffff'
          }}
        />
        <p style={{
          color: isDarkMode ? '#9ca3af' : '#6b7280',
          fontSize: '12px',
          marginTop: '8px',
          marginBottom: 0
        }}>
          平滑的波形曲线，上下对称，带有半透明填充，类似音乐播放器
        </p>
      </div>
      
      {/* 样式C：粒子效果 */}
      <div
        onClick={() => handleStyleClick('styleC')}
        style={selectedStyle === 'styleC' ? selectedContainerStyle : canvasContainerStyle}
      >
        <div style={{
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            color: isDarkMode ? '#f9fafb' : '#111827',
            fontSize: '18px',
            fontWeight: '600',
            margin: 0
          }}>
            样式C：粒子效果
          </h3>
          {selectedStyle === 'styleC' && (
            <span style={{
              color: '#3b82f6',
              fontSize: '14px',
              fontWeight: '600'
            }}>✓ 已选择</span>
          )}
        </div>
        <canvas
          ref={canvas3Ref}
          width={600}
          height={80}
          style={{
            width: '100%',
            maxWidth: '600px',
            height: '80px',
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#1f2937' : '#ffffff'
          }}
        />
        <p style={{
          color: isDarkMode ? '#9ca3af' : '#6b7280',
          fontSize: '12px',
          marginTop: '8px',
          marginBottom: 0
        }}>
          圆形粒子点，带有连接线和透明度变化，科技感强
        </p>
      </div>
      
      {/* 样式D：流动渐变 */}
      <div
        onClick={() => handleStyleClick('styleD')}
        style={selectedStyle === 'styleD' ? selectedContainerStyle : canvasContainerStyle}
      >
        <div style={{
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            color: isDarkMode ? '#f9fafb' : '#111827',
            fontSize: '18px',
            fontWeight: '600',
            margin: 0
          }}>
            样式D：流动渐变柱状图
          </h3>
          {selectedStyle === 'styleD' && (
            <span style={{
              color: '#3b82f6',
              fontSize: '14px',
              fontWeight: '600'
            }}>✓ 已选择</span>
          )}
        </div>
        <canvas
          ref={canvas4Ref}
          width={600}
          height={80}
          style={{
            width: '100%',
            maxWidth: '600px',
            height: '80px',
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#1f2937' : '#ffffff'
          }}
        />
        <p style={{
          color: isDarkMode ? '#9ca3af' : '#6b7280',
          fontSize: '12px',
          marginTop: '8px',
          marginBottom: 0
        }}>
          传统柱状图，带有流动的彩色渐变和高光效果，视觉效果丰富
        </p>
      </div>
      
      {/* 当前样式（对比） */}
      <div
        onClick={() => handleStyleClick('current')}
        style={selectedStyle === 'current' ? selectedContainerStyle : canvasContainerStyle}
      >
        <div style={{
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            color: isDarkMode ? '#f9fafb' : '#111827',
            fontSize: '18px',
            fontWeight: '600',
            margin: 0
          }}>
            当前样式（对比参考）
          </h3>
          {selectedStyle === 'current' && (
            <span style={{
              color: '#3b82f6',
              fontSize: '14px',
              fontWeight: '600'
            }}>✓ 已选择</span>
          )}
        </div>
        <canvas
          ref={canvas5Ref}
          width={600}
          height={80}
          style={{
            width: '100%',
            maxWidth: '600px',
            height: '80px',
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#1f2937' : '#ffffff'
          }}
        />
        <p style={{
          color: isDarkMode ? '#9ca3af' : '#6b7280',
          fontSize: '12px',
          marginTop: '8px',
          marginBottom: 0
        }}>
          当前实现的简单柱状图样式，用于对比参考
        </p>
      </div>
      
      {selectedStyle && (
        <div style={{
          marginTop: '32px',
          padding: '16px',
          backgroundColor: isDarkMode ? '#374151' : '#eff6ff',
          borderRadius: '8px',
          border: `1px solid ${isDarkMode ? '#4b5563' : '#bfdbfe'}`
        }}>
          <p style={{
            color: isDarkMode ? '#f9fafb' : '#1e40af',
            fontSize: '14px',
            margin: 0,
            fontWeight: '500'
          }}>
            ✓ 你已选择：{selectedStyle === 'styleA' ? '样式A：对称柱状图' :
                           selectedStyle === 'styleB' ? '样式B：平滑波形曲线' :
                           selectedStyle === 'styleC' ? '样式C：粒子效果' :
                           selectedStyle === 'styleD' ? '样式D：流动渐变柱状图' :
                           '当前样式'}
          </p>
        </div>
      )}
    </div>
  );
};

export default WaveformPreview;

