import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { StreamTextSegmenter } from '../utils/StreamTextSegmenter';
import { TextSegment } from '@/types';
import 'highlight.js/styles/github.css';

const StreamSegmentationTest: React.FC = () => {
  const segmenterRef = useRef(new StreamTextSegmenter());
  const [inputText, setInputText] = useState('');
  const [segments, setSegments] = useState<TextSegment[]>([]);
  const [buffer, setBuffer] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<'fast' | 'medium' | 'slow'>('medium');
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(0);

  // 测试数据 - 专门测试新的句子级分段功能
  const testMarkdown = `# 智能分段测试

## 1. 句子级分段测试

这是一个包含多个句子的段落。第一句话测试中文句号。第二句话测试感叹号！第三句话测试问号？

这段测试英文标点. This is the first English sentence. The second one tests exclamation mark! And this one tests question mark?

## 2. 特殊情况测试

这段包含数字3.14和小数点，还有网址www.example.com，不应该被错误拆分。文件名test.js也应该保持完整。省略号...也不应该被当作句子结束。

## 3. 列表保持完整

以下是功能列表，应该作为一个整体：
- 实时响应用户输入
- 内存使用效率高
- 提供更好的用户体验
- 支持复杂markdown结构

## 4. 表格保持完整

| 功能 | 状态 | 说明 |
|------|------|------|
| 句子分段 | ✅ | 支持中英文标点：。！？.!? |
| 列表识别 | ✅ | 连续列表项作为整体 |
| 表格识别 | ✅ | 整张表格不拆分 |
| 代码块 | ✅ | 保持代码完整性 |

## 5. 代码块保持完整

` + '```javascript\n' + `// 代码中的句号不应该被拆分
const API_URL = "https://api.example.com/v1";
const PI = 3.14159;
console.log("Hello. World!"); // 字符串中的句号
function calculate() {
  return 2.5 * 3.0; // 小数点
}
` + '```' + `

## 6. 引用块测试

> 这是一个引用块。它包含多个句子。应该保持完整！

## 7. 混合内容测试

人工智能技术正在快速发展。AI可以帮助我们解决很多问题！你觉得未来会怎样？让我们拭目以待。

这段演示了TTS播放的理想分段效果。每个句子会被单独高亮。用户体验会更好！`;


  const speedMap = {
    fast: 30,
    medium: 80,
    slow: 150
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // SSE模拟器
  const simulateSSE = async () => {
    setIsRunning(true);
    currentIndexRef.current = 0;
    
    for (let i = currentIndexRef.current; i < testMarkdown.length; i++) {
      if (!isRunning && i > currentIndexRef.current) break;
      
      const char = testMarkdown[i];
      const newSegments = segmenterRef.current.addChunk(char);
      
      setInputText(prev => prev + char);
      setBuffer(segmenterRef.current.getBuffer());
      
      if (newSegments.length > 0) {
        setSegments(segmenterRef.current.getSegments());
      }
      
      setProgress(((i + 1) / testMarkdown.length) * 100);
      currentIndexRef.current = i + 1;
      
      await sleep(speedMap[speed]);
    }
    
    // 完成后处理剩余缓冲区
    const finalSegments = segmenterRef.current.finalize();
    if (finalSegments.length > 0) {
      setSegments(segmenterRef.current.getSegments());
      setBuffer('');
    }
    
    setIsRunning(false);
    setProgress(100);
  };

  // 暂停/继续
  const togglePause = () => {
    if (isRunning) {
      setIsRunning(false);
    } else {
      if (currentIndexRef.current < testMarkdown.length) {
        simulateSSE();
      }
    }
  };

  // 重置
  const handleReset = () => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    segmenterRef.current.reset();
    setInputText('');
    setSegments([]);
    setBuffer('');
    setProgress(0);
    currentIndexRef.current = 0;
    setHighlightedSegmentId(null);
  };

  // 点击段落高亮
  const handleSegmentClick = (segmentId: string) => {
    setHighlightedSegmentId(segmentId);
  };

  // 清理effect
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // 获取段落类型标签颜色
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      paragraph: '#6b7280',
      heading: '#3b82f6',
      code: '#10b981',
      list: '#f59e0b',
      quote: '#8b5cf6',
      table: '#ec4899'
    };
    return colors[type] || '#6b7280';
  };

  // 获取段落类型图标
  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      paragraph: '¶',
      heading: '#',
      code: '</>',
      list: '•',
      quote: '"',
      table: '⊞'
    };
    return icons[type] || '¶';
  };

  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    },
    header: {
      marginBottom: '24px'
    },
    title: {
      fontSize: '28px',
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: '8px'
    },
    subtitle: {
      fontSize: '14px',
      color: '#6b7280'
    },
    controls: {
      display: 'flex',
      gap: '12px',
      marginBottom: '20px',
      padding: '16px',
      background: '#f9fafb',
      borderRadius: '12px',
      alignItems: 'center',
      flexWrap: 'wrap' as const
    },
    button: {
      padding: '10px 16px',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s'
    },
    primaryButton: {
      background: '#3b82f6',
      color: 'white'
    },
    successButton: {
      background: '#10b981',
      color: 'white'
    },
    warningButton: {
      background: '#f59e0b',
      color: 'white'
    },
    speedButton: {
      padding: '6px 12px',
      border: '1px solid #e5e7eb',
      borderRadius: '6px',
      background: 'white',
      cursor: 'pointer',
      fontSize: '13px',
      transition: 'all 0.2s'
    },
    speedButtonActive: {
      background: '#3b82f6',
      color: 'white',
      borderColor: '#3b82f6'
    },
    progressContainer: {
      flex: 1,
      minWidth: '200px'
    },
    progressBar: {
      width: '100%',
      height: '8px',
      background: '#e5e7eb',
      borderRadius: '4px',
      overflow: 'hidden'
    },
    progressFill: {
      height: '100%',
      background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
      transition: 'width 0.3s',
      borderRadius: '4px'
    },
    progressText: {
      fontSize: '12px',
      color: '#6b7280',
      marginTop: '4px'
    },
    content: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px'
    },
    panel: {
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '20px',
      minHeight: '500px'
    },
    panelTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#111827',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    inputArea: {
      background: '#f9fafb',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '16px',
      fontFamily: 'monospace',
      fontSize: '14px',
      lineHeight: '1.6',
      minHeight: '400px',
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-word' as const,
      position: 'relative' as const
    },
    markdownContainer: {
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '16px',
      minHeight: '400px',
      maxHeight: '520px',
      overflowY: 'auto' as const
    },
    markdownSegment: {
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '8px',
      transition: 'all 0.3s ease',
      position: 'relative' as const
    },
    markdownSegmentHighlight: {
      background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
      borderLeft: '4px solid #3b82f6',
      paddingLeft: '16px',
      boxShadow: '0 2px 12px rgba(59, 130, 246, 0.2)',
      transform: 'translateX(4px)'
    },
    cursor: {
      display: 'inline-block',
      width: '2px',
      height: '1em',
      background: '#3b82f6',
      animation: 'blink 1s infinite'
    },
    bufferInfo: {
      marginTop: '12px',
      padding: '12px',
      background: '#fef3c7',
      border: '1px solid #fbbf24',
      borderRadius: '6px',
      fontSize: '13px'
    },
    bufferLabel: {
      fontWeight: '600',
      color: '#92400e',
      marginBottom: '4px'
    },
    bufferContent: {
      color: '#78350f',
      fontFamily: 'monospace',
      fontSize: '12px'
    },
    segmentsList: {
      maxHeight: '520px',
      overflowY: 'auto' as const
    },
    segment: {
      marginBottom: '12px',
      padding: '12px',
      background: '#f9fafb',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      transition: 'all 0.2s',
      cursor: 'pointer'
    },
    segmentHighlighted: {
      background: '#dbeafe',
      borderColor: '#3b82f6',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
    },
    segmentHover: {
      background: '#f3f4f6',
      borderColor: '#9ca3af'
    },
    segmentHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '8px'
    },
    segmentType: {
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '600',
      color: 'white'
    },
    segmentId: {
      fontSize: '11px',
      color: '#9ca3af',
      fontFamily: 'monospace'
    },
    segmentText: {
      fontSize: '13px',
      color: '#374151',
      lineHeight: '1.5',
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-word' as const
    },
    emptyState: {
      textAlign: 'center' as const,
      padding: '60px 20px',
      color: '#9ca3af'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🔄 流式文本分段测试</h1>
        <p style={styles.subtitle}>
          模拟SSE流式返回，实时识别完整段落并加入数组
        </p>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <button
          style={{
            ...styles.button,
            ...(isRunning ? styles.warningButton : styles.primaryButton)
          }}
          onClick={togglePause}
        >
          {isRunning ? <Pause size={16} /> : <Play size={16} />}
          {isRunning ? '暂停' : currentIndexRef.current > 0 ? '继续' : '开始模拟'}
        </button>

        <button
          style={{ ...styles.button, ...styles.successButton }}
          onClick={handleReset}
        >
          <RotateCcw size={16} />
          重置
        </button>

        <div style={{ borderLeft: '1px solid #e5e7eb', height: '32px', margin: '0 4px' }} />

        <Zap size={16} color="#6b7280" />
        <span style={{ fontSize: '13px', color: '#6b7280', marginRight: '8px' }}>速度:</span>
        
        {(['fast', 'medium', 'slow'] as const).map(s => (
          <button
            key={s}
            style={{
              ...styles.speedButton,
              ...(speed === s ? styles.speedButtonActive : {})
            }}
            onClick={() => setSpeed(s)}
          >
            {s === 'fast' ? '快' : s === 'medium' ? '中' : '慢'}
          </button>
        ))}

        {/* Progress */}
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <div style={styles.progressText}>
            进度: {Math.round(progress)}% ({currentIndexRef.current}/{testMarkdown.length} 字符)
          </div>
        </div>
      </div>

      {/* Stats Panel */}
      {segments.length > 0 && (
        <div style={{
          backgroundColor: '#f0f9ff',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          border: '1px solid #bae6fd',
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap' as const
        }}>
          <div style={{ flex: '1', minWidth: '150px' }}>
            <div style={{ fontSize: '12px', color: '#0369a1', marginBottom: '4px' }}>
              总段落数
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0c4a6e' }}>
              {segments.length}
            </div>
          </div>
          
          {Object.entries(segmenterRef.current.getStats().types || {}).map(([type, count]) => (
            <div key={type} style={{ flex: '1', minWidth: '120px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ 
                  backgroundColor: getTypeColor(type), 
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: '600'
                }}>
                  {getTypeIcon(type)} {type}
                </span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#374151' }}>
                {count}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={styles.content}>
        {/* Left Panel - Markdown Rendering */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>
            📝 Markdown渲染区（点击右侧段落高亮对应内容）
          </div>
          
          {segments.length === 0 ? (
            <div style={styles.inputArea}>
              {inputText}
              {isRunning && <span style={styles.cursor} />}
            </div>
          ) : (
            <div style={styles.markdownContainer} className="markdown-with-segments">
              {/* 按segment逐个渲染，实现句子级精准高亮 */}
              {segments.map((segment) => (
                <div
                  key={segment.id}
                  data-segment-id={segment.id}
                  className={`segment-wrapper ${highlightedSegmentId === segment.id ? 'segment-highlighted' : ''}`}
                  style={{
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleSegmentClick(segment.id)}
                  onMouseEnter={() => setHoveredSegmentId(segment.id)}
                  onMouseLeave={() => setHoveredSegmentId(null)}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      // 对于普通段落（句子），去掉外层<p>标签的margin，作为inline显示
                      p: ({ node, children, ...props }) => {
                        if (segment.type === 'paragraph') {
                          return <span {...props}>{children}</span>;
                        }
                        return <p {...props}>{children}</p>;
                      }
                    }}
                  >
                    {segment.text}
                  </ReactMarkdown>
                </div>
              ))}
              
              {/* 缓冲区内容：丝滑显示在segments后面，不突兀 */}
              {buffer && (
                <span style={{
                  display: 'inline',
                  color: '#9ca3af',
                  opacity: 0.7,
                  fontStyle: 'italic',
                  transition: 'opacity 0.3s ease'
                }}>
                  {buffer}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Segments */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>
            📦 已完成段落 ({segments.length} 个)
          </div>
          <div style={styles.segmentsList}>
            {segments.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <div>等待段落完成...</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                  遇到双换行符（\n\n）时段落会自动加入
                </div>
              </div>
            ) : (
              segments.map((segment, index) => {
                const isHighlighted = highlightedSegmentId === segment.id;
                const isHovered = hoveredSegmentId === segment.id;
                
                return (
                  <div 
                    key={segment.id} 
                    style={{
                      ...styles.segment,
                      ...(isHighlighted ? styles.segmentHighlighted : {}),
                      ...(isHovered && !isHighlighted ? styles.segmentHover : {})
                    }}
                    onClick={() => handleSegmentClick(segment.id)}
                    onMouseEnter={() => setHoveredSegmentId(segment.id)}
                    onMouseLeave={() => setHoveredSegmentId(null)}
                  >
                    <div style={styles.segmentHeader}>
                      <span
                        style={{
                          ...styles.segmentType,
                          background: getTypeColor(segment.type)
                        }}
                      >
                        {getTypeIcon(segment.type)} {segment.type}
                      </span>
                      <span style={styles.segmentId}>{segment.id}</span>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                        {segment.text.length} 字符
                      </span>
                      {isHighlighted && (
                        <span style={{ 
                          fontSize: '11px', 
                          color: '#3b82f6',
                          fontWeight: '600',
                          marginLeft: 'auto'
                        }}>
                          ✓ 已高亮
                        </span>
                      )}
                    </div>
                    <div style={styles.segmentText}>{segment.text}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        /* Segment包装器基础样式 */
        .markdown-with-segments .segment-wrapper {
          display: block;
          margin-bottom: 12px;
          border-radius: 6px;
          transition: all 0.3s ease;
          position: relative;
        }

        /* 悬停效果 */
        .markdown-with-segments .segment-wrapper:hover {
          background-color: rgba(156, 163, 175, 0.05);
        }

        /* 句子级segment（paragraph类型）- inline显示 */
        .markdown-with-segments .segment-wrapper span {
          display: inline;
        }

        /* 高亮样式 */
        .markdown-with-segments .segment-highlighted {
          background: linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%);
          border-left: 4px solid #3b82f6;
          padding: 8px 12px 8px 16px;
          margin-left: -4px;
          margin-bottom: 8px;
          border-radius: 6px;
          box-shadow: 0 2px 12px rgba(59, 130, 246, 0.2);
          transform: translateX(4px);
          display: inline-block;
        }

        /* 块级元素（表格、代码块、列表）的高亮 */
        .markdown-with-segments .segment-wrapper.segment-highlighted {
          display: block;
        }

        /* Markdown基础样式 */
        .markdown-with-segments {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
          line-height: 1.6;
        }

        .markdown-with-segments h1 {
          font-size: 2em;
          font-weight: 600;
          margin-top: 24px;
          margin-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 8px;
        }

        .markdown-with-segments h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin-top: 20px;
          margin-bottom: 12px;
          border-bottom: 1px solid #f3f4f6;
          padding-bottom: 6px;
        }

        .markdown-with-segments h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin-top: 16px;
          margin-bottom: 10px;
        }

        .markdown-with-segments p {
          margin-top: 0;
          margin-bottom: 16px;
        }

        .markdown-with-segments ul, 
        .markdown-with-segments ol {
          padding-left: 24px;
          margin-bottom: 16px;
        }

        .markdown-with-segments li {
          margin-bottom: 4px;
        }

        .markdown-with-segments table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .markdown-with-segments table th,
        .markdown-with-segments table td {
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          text-align: left;
        }

        .markdown-with-segments table th {
          background-color: #f9fafb;
          font-weight: 600;
        }

        .markdown-with-segments table tr:hover {
          background-color: #f9fafb;
        }

        .markdown-with-segments pre {
          background-color: #f6f8fa;
          border-radius: 6px;
          padding: 16px;
          overflow-x: auto;
          margin-bottom: 16px;
        }

        .markdown-with-segments code {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
        }

        .markdown-with-segments :not(pre) > code {
          background-color: #f6f8fa;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 85%;
        }
      `}</style>
    </div>
  );
};

export default StreamSegmentationTest;

