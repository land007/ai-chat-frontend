import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { StreamTextSegmenter } from '../utils/StreamTextSegmenter';
import AudioQueuePlayer from './AudioQueuePlayer';
import { TextSegment, AudioQueuePlayerHandle } from '@/types';
import 'highlight.js/styles/github.css';

const TTSIntegrationTest: React.FC = () => {
  // 状态管理
  const [segments, setSegments] = useState<TextSegment[]>([]);
  const [currentSegmentId, setCurrentSegmentId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  
  // Refs
  const audioPlayerRef = useRef<AudioQueuePlayerHandle>(null);
  
  // 测试数据 - 复用StreamSegmentationTest的markdown
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

  // TTS URL生成函数
  const generateTTSUrl = (text: string): string => {
    const encodedText = encodeURIComponent(text);
    return `https://dub.qhkly.com/download?text=${encodedText}&name=zh-CN-XuyuNeural&lang=zh-CN&role=Default&style=Default&rate=%2B0&pitch=%2B0&volume=%2B0&format=riff-24khz-16bit-mono-pcm`;
  };

  // 初始化：分段处理
  useEffect(() => {
    const segmenter = new StreamTextSegmenter();
    
    // 模拟流式输入，逐字符添加
    for (const char of testMarkdown) {
      segmenter.addChunk(char);
    }
    
    // 完成输入，获取最终segments
    const finalSegments = segmenter.finalize();
    setSegments(finalSegments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 播放状态回调
  const handlePlayingChange = (textRef: any) => {
    if (textRef?.id) {
      setCurrentSegmentId(textRef.id);
    } else {
      setCurrentSegmentId(null);
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  // 播放全文
  const handlePlayAll = () => {
    audioPlayerRef.current?.clear();
    segments.forEach(segment => {
      audioPlayerRef.current?.enqueue({
        url: generateTTSUrl(segment.text),
        textRef: segment
      });
    });
    setQueueLength(segments.length);
    setIsPlaying(true);
    setIsPaused(false);
  };

  // 从指定segment播放到结尾
  const handlePlaySegment = (segment: TextSegment, index: number) => {
    audioPlayerRef.current?.clear();
    
    // 从当前segment开始，依次入队到结尾
    for (let i = index; i < segments.length; i++) {
      audioPlayerRef.current?.enqueue({
        url: generateTTSUrl(segments[i].text),
        textRef: segments[i]
      });
    }
    
    setQueueLength(segments.length - index);
    setIsPlaying(true);
    setIsPaused(false);
  };

  // 暂停
  const handlePause = () => {
    audioPlayerRef.current?.pause();
    setIsPaused(true);
  };

  // 继续
  const handleResume = () => {
    audioPlayerRef.current?.resume();
    setIsPaused(false);
  };

  // 停止
  const handleStop = () => {
    audioPlayerRef.current?.clear();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSegmentId(null);
    setQueueLength(0);
  };

  // 统计信息计算
  const getSegmentStats = () => {
    const stats = {
      total: segments.length,
      paragraph: 0,
      heading: 0,
      code: 0,
      list: 0,
      quote: 0,
      table: 0
    };
    
    segments.forEach(seg => {
      stats[seg.type]++;
    });
    
    return stats;
  };

  const stats = getSegmentStats();

  // 按钮样式
  const buttonStyle = (disabled = false) => ({
    padding: '8px 16px',
    backgroundColor: disabled ? '#9ca3af' : '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
    opacity: disabled ? 0.6 : 1
  });

  const stopButtonStyle = {
    ...buttonStyle(),
    backgroundColor: '#ef4444'
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 音频播放器（隐藏） */}
      <AudioQueuePlayer 
        ref={audioPlayerRef} 
        onPlayingChange={handlePlayingChange}
        autoPlay={true}
      />
      
      {/* 控制栏 */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        alignItems: 'center',
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        flexShrink: 0
      }}>
        <button 
          onClick={handlePlayAll} 
          disabled={isPlaying}
          style={buttonStyle(isPlaying)}
        >
          <Play size={16} />
          播放全文
        </button>
        
        {isPlaying && (
          <>
            {isPaused ? (
              <button onClick={handleResume} style={buttonStyle()}>
                <Play size={16} />
                继续
              </button>
            ) : (
              <button onClick={handlePause} style={buttonStyle()}>
                <Pause size={16} />
                暂停
              </button>
            )}
            <button onClick={handleStop} style={stopButtonStyle}>
              <Square size={16} />
              停止
            </button>
          </>
        )}
        
        <div style={{
          marginLeft: 'auto',
          fontSize: '14px',
          color: '#6b7280',
          display: 'flex',
          gap: '16px'
        }}>
          <span>队列: <strong>{queueLength}</strong> 个segment</span>
          {isPlaying && (
            <span style={{ 
              color: isPaused ? '#f59e0b' : '#10b981',
              fontWeight: '600'
            }}>
              {isPaused ? '⏸️ 已暂停' : '▶️ 播放中'}
            </span>
          )}
        </div>
      </div>

      {/* 统计面板 */}
      <div style={{ 
        padding: '12px 16px',
        backgroundColor: '#f0f9ff',
        borderBottom: '1px solid #bae6fd',
        flexShrink: 0
      }}>
        <div style={{ 
          fontSize: '14px', 
          fontWeight: '600',
          color: '#0c4a6e',
          marginBottom: '8px'
        }}>
          📊 分段统计: 总计 <strong>{stats.total}</strong> 个segments
        </div>
        <div style={{ 
          display: 'flex', 
          gap: '16px',
          fontSize: '13px',
          color: '#0369a1'
        }}>
          <span>📝 段落: <strong>{stats.paragraph}</strong></span>
          <span>📌 标题: <strong>{stats.heading}</strong></span>
          <span>💻 代码: <strong>{stats.code}</strong></span>
          <span>📋 列表: <strong>{stats.list}</strong></span>
          <span>💬 引用: <strong>{stats.quote}</strong></span>
          <span>📊 表格: <strong>{stats.table}</strong></span>
        </div>
      </div>

      {/* Markdown渲染区 */}
      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        backgroundColor: '#ffffff'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div className="markdown-with-segments">
            {segments.map((segment, index) => (
              <div
                key={segment.id}
                data-segment-id={segment.id}
                className={`segment-wrapper ${currentSegmentId === segment.id ? 'segment-highlighted' : ''}`}
                onClick={() => handlePlaySegment(segment, index)}
                style={{ cursor: 'pointer' }}
                title={`点击从此处播放到结尾 (${segments.length - index} 个segments)`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
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
          </div>
        </div>
      </div>

      <style>{`
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

        /* 代码块样式优化 */
        .markdown-with-segments pre {
          background-color: #f6f8fa;
          padding: 16px;
          border-radius: 6px;
          overflow-x: auto;
        }

        /* 表格样式优化 */
        .markdown-with-segments table {
          border-collapse: collapse;
          width: 100%;
          margin: 16px 0;
        }

        .markdown-with-segments th,
        .markdown-with-segments td {
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          text-align: left;
        }

        .markdown-with-segments th {
          background-color: #f9fafb;
          font-weight: 600;
        }

        /* 引用块样式优化 */
        .markdown-with-segments blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 16px;
          color: #6b7280;
          margin: 16px 0;
        }

        /* 列表样式优化 */
        .markdown-with-segments ul,
        .markdown-with-segments ol {
          margin: 12px 0;
          padding-left: 24px;
        }

        .markdown-with-segments li {
          margin: 4px 0;
        }
      `}</style>
    </div>
  );
};

export default TTSIntegrationTest;

