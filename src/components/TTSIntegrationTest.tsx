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
  
  // 流式模式状态
  const [isStreamMode, setIsStreamMode] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState(0);
  const [buffer, setBuffer] = useState('');
  const [streamSpeed, setStreamSpeed] = useState<'fast' | 'medium' | 'slow'>('medium');
  
  // 队列优化：待处理segments
  const [pendingSegments, setPendingSegments] = useState<TextSegment[]>([]);
  const maxQueueSize = 2; // 最大队列长度（当前播放 + 预加载）
  
  // Refs
  const audioPlayerRef = useRef<AudioQueuePlayerHandle>(null);
  const segmenterRef = useRef<StreamTextSegmenter>(new StreamTextSegmenter());
  const currentStreamIndexRef = useRef(0);
  
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

  // 将markdown文本转换为适合TTS的纯文本
  const convertToTTSText = (text: string, type: string): string => {
    // 处理表格：提取单元格内容，用逗号分隔
    if (type === 'table') {
      const lines = text.trim().split('\n');
      const cleanedLines = lines
        .filter(line => !line.match(/^\|[-\s:|]+\|$/)) // 移除表格分隔行
        .map(line => {
          // 提取单元格内容
          return line
            .split('|')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0)
            .join('，'); // 用中文逗号分隔
        })
        .filter(line => line.length > 0);
      
      return cleanedLines.join('。'); // 每行用句号分隔
    }
    
    // 处理代码块：返回描述性文本，不朗读代码内容
    if (type === 'code') {
      // 检测代码语言
      const langMatch = text.match(/```(\w+)/);
      let language = '代码';
      
      if (langMatch) {
        const lang = langMatch[1].toLowerCase();
        // 常见编程语言的友好名称映射
        const langMap: { [key: string]: string } = {
          'javascript': 'JavaScript',
          'js': 'JavaScript',
          'typescript': 'TypeScript',
          'ts': 'TypeScript',
          'python': 'Python',
          'py': 'Python',
          'java': 'Java',
          'cpp': 'C++',
          'c': 'C',
          'csharp': 'C#',
          'cs': 'C#',
          'go': 'Go',
          'rust': 'Rust',
          'php': 'PHP',
          'ruby': 'Ruby',
          'swift': 'Swift',
          'kotlin': 'Kotlin',
          'sql': 'SQL',
          'html': 'HTML',
          'css': 'CSS',
          'scss': 'SCSS',
          'json': 'JSON',
          'xml': 'XML',
          'yaml': 'YAML',
          'yml': 'YAML',
          'markdown': 'Markdown',
          'md': 'Markdown',
          'bash': 'Bash',
          'sh': 'Shell',
          'shell': 'Shell',
          'powershell': 'PowerShell',
          'r': 'R',
          'matlab': 'MATLAB',
          'scala': 'Scala',
          'lua': 'Lua',
          'perl': 'Perl',
          'dart': 'Dart'
        };
        
        language = langMap[lang] || lang;
      }
      
      // 统计代码行数
      const codeContent = text.replace(/```[\s\S]*?\n/, '').replace(/```$/, '').trim();
      const lineCount = codeContent.split('\n').length;
      
      return `这里是一段${language}代码，共${lineCount}行`;
    }
    
    // 处理标题：移除#号
    if (type === 'heading') {
      return text.replace(/^#+\s*/, '');
    }
    
    // 处理列表：移除列表标记
    if (type === 'list') {
      return text
        .split('\n')
        .map(line => line.replace(/^[-*+]\s*/, '').replace(/^\d+\.\s*/, ''))
        .join('，');
    }
    
    // 处理引用：移除引用标记
    if (type === 'quote') {
      return text.replace(/^>\s*/gm, '');
    }
    
    // 普通段落直接返回
    return text;
  };
  
  // TTS URL生成函数
  const generateTTSUrl = (text: string, type: string = 'paragraph'): string => {
    const cleanedText = convertToTTSText(text, type);
    const encodedText = encodeURIComponent(cleanedText);
    return `https://dub.qhkly.com/download?text=${encodedText}&name=zh-CN-XuyuNeural&lang=zh-CN&role=Default&style=Default&rate=%2B0&pitch=%2B0&volume=%2B0&format=riff-24khz-16bit-mo-pcm`;
  };

  // 速度映射
  const speedMap = {
    fast: 20,
    medium: 50,
    slow: 100
  };

  // 初始化：静态模式分段处理
  useEffect(() => {
    if (!isStreamMode) {
      const segmenter = new StreamTextSegmenter();
      
      // 模拟流式输入，逐字符添加
      for (const char of testMarkdown) {
        segmenter.addChunk(char);
      }
      
      // 完成输入，获取最终segments
      const finalSegments = segmenter.finalize();
      setSegments(finalSegments);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreamMode]);

  // 自动入队：当队列有空位时，从pendingSegments入队
  useEffect(() => {
    if (pendingSegments.length > 0) {
      // 获取AudioQueuePlayer的实际剩余队列长度
      const actualRemaining = audioPlayerRef.current?.getQueueRemaining() || 0;
      
      if (actualRemaining < maxQueueSize) {
        const canEnqueue = maxQueueSize - actualRemaining;
        const toEnqueue = pendingSegments.slice(0, canEnqueue);
        
        console.log(`📤 [自动入队] 剩余${actualRemaining}个，入队${toEnqueue.length}个`);
        
        toEnqueue.forEach(segment => {
          audioPlayerRef.current?.enqueue({
            url: generateTTSUrl(segment.text, segment.type),
            textRef: segment
          });
        });
        
        setPendingSegments(prev => prev.slice(canEnqueue));
        
        // 更新显示的队列长度
        const newRemaining = audioPlayerRef.current?.getQueueRemaining() || 0;
        setQueueLength(newRemaining);
      }
    }
  }, [pendingSegments, maxQueueSize]);

  // 播放状态回调
  const handlePlayingChange = (textRef: any) => {
    if (textRef?.id) {
      // 开始播放新segment
      console.log('▶️ [播放回调] 开始播放新segment:', textRef.text?.substring(0, 30));
      setCurrentSegmentId(textRef.id);
      
      // 同步队列长度（从AudioQueuePlayer获取真实值）
      const actualRemaining = audioPlayerRef.current?.getQueueRemaining() || 0;
      setQueueLength(actualRemaining);
      console.log(`📊 [播放回调] 队列剩余: ${actualRemaining}个`);
      
      // 触发自动入队（通过更新pending触发useEffect）
      setPendingSegments(prev => [...prev]);
      
    } else {
      // 队列播放完成或停止
      console.log('⏹️ [播放回调] 播放完成或停止');
      setCurrentSegmentId(null);
      setIsPlaying(false);
      setIsPaused(false);
      setQueueLength(0);
    }
  };

  // 播放全文
  const handlePlayAll = () => {
    audioPlayerRef.current?.clear();
    segments.forEach(segment => {
      audioPlayerRef.current?.enqueue({
        url: generateTTSUrl(segment.text, segment.type),
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
        url: generateTTSUrl(segments[i].text, segments[i].type),
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
    setPendingSegments([]);
  };

  // 流式播放：开始
  const handleStartStream = async () => {
    // 重置状态
    segmenterRef.current = new StreamTextSegmenter();
    setSegments([]);
    setBuffer('');
    setStreamProgress(0);
    currentStreamIndexRef.current = 0;
    setIsStreaming(true);
    setIsPlaying(true);
    setPendingSegments([]);
    setQueueLength(0);
    
    // 清空队列
    audioPlayerRef.current?.clear();
    
    // 开始流式输入
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    for (let i = 0; i < testMarkdown.length; i++) {
      if (!isStreaming && i > currentStreamIndexRef.current) break;
      
      const char = testMarkdown[i];
      
      // 添加字符到分段器
      const newSegments = segmenterRef.current.addChunk(char);
      
      // 更新缓冲区
      setBuffer(segmenterRef.current.getBuffer());
      
      // 如果有新的完整segments，智能入队
      if (newSegments.length > 0) {
        const allSegments = segmenterRef.current.getSegments();
        setSegments(allSegments);
        
        // 获取实际队列剩余
        const actualRemaining = audioPlayerRef.current?.getQueueRemaining() || 0;
        
        // 智能入队：只入队到达maxQueueSize，其余暂存
        const canEnqueue = Math.max(0, maxQueueSize - actualRemaining);
        const toEnqueue = newSegments.slice(0, canEnqueue);
        const toPending = newSegments.slice(canEnqueue);
        
        console.log(`📝 [流式入队] 识别${newSegments.length}个，队列剩余${actualRemaining}，入队${toEnqueue.length}，暂存${toPending.length}`);
        
        // 入队部分
        toEnqueue.forEach(segment => {
          audioPlayerRef.current?.enqueue({
            url: generateTTSUrl(segment.text, segment.type),
            textRef: segment
          });
        });
        
        // 暂存剩余
        if (toPending.length > 0) {
          setPendingSegments(prev => [...prev, ...toPending]);
        }
        
        // 更新队列长度显示
        const newRemaining = audioPlayerRef.current?.getQueueRemaining() || 0;
        setQueueLength(newRemaining);
      }
      
      // 更新进度
      setStreamProgress(((i + 1) / testMarkdown.length) * 100);
      currentStreamIndexRef.current = i + 1;
      
      // 延迟（模拟打字机）
      await sleep(speedMap[streamSpeed]);
    }
    
    // 完成输入，处理剩余缓冲区
    const finalSegments = segmenterRef.current.finalize();
    if (finalSegments.length > 0) {
      const allSegments = segmenterRef.current.getSegments();
      setSegments(allSegments);
      
      // 获取实际队列剩余
      const actualRemaining = audioPlayerRef.current?.getQueueRemaining() || 0;
      
      // 智能入队最后的segments
      const canEnqueue = Math.max(0, maxQueueSize - actualRemaining);
      const toEnqueue = finalSegments.slice(0, canEnqueue);
      const toPending = finalSegments.slice(canEnqueue);
      
      console.log(`🏁 [流式完成] 最后${finalSegments.length}个，队列剩余${actualRemaining}，入队${toEnqueue.length}，暂存${toPending.length}`);
      
      toEnqueue.forEach(segment => {
        audioPlayerRef.current?.enqueue({
          url: generateTTSUrl(segment.text, segment.type),
          textRef: segment
        });
      });
      
      if (toPending.length > 0) {
        setPendingSegments(prev => [...prev, ...toPending]);
      }
      
      // 更新队列长度显示
      const newRemaining = audioPlayerRef.current?.getQueueRemaining() || 0;
      setQueueLength(newRemaining);
    }
    
    setBuffer('');
    setIsStreaming(false);
    setStreamProgress(100);
  };

  // 流式播放：暂停
  const handlePauseStream = () => {
    setIsStreaming(false);
  };

  // 流式播放：继续
  const handleResumeStream = async () => {
    if (currentStreamIndexRef.current >= testMarkdown.length) {
      return;
    }
    
    setIsStreaming(true);
    
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    for (let i = currentStreamIndexRef.current; i < testMarkdown.length; i++) {
      if (!isStreaming) break;
      
      const char = testMarkdown[i];
      
      const newSegments = segmenterRef.current.addChunk(char);
      setBuffer(segmenterRef.current.getBuffer());
      
      if (newSegments.length > 0) {
        const allSegments = segmenterRef.current.getSegments();
        setSegments(allSegments);
        
        // 智能入队
        const canEnqueue = Math.max(0, maxQueueSize - queueLength);
        const toEnqueue = newSegments.slice(0, canEnqueue);
        const toPending = newSegments.slice(canEnqueue);
        
        toEnqueue.forEach(segment => {
          audioPlayerRef.current?.enqueue({
            url: generateTTSUrl(segment.text, segment.type),
            textRef: segment
          });
        });
        
        if (toPending.length > 0) {
          setPendingSegments(prev => [...prev, ...toPending]);
        }
        
        setQueueLength(prev => prev + toEnqueue.length);
      }
      
      setStreamProgress(((i + 1) / testMarkdown.length) * 100);
      currentStreamIndexRef.current = i + 1;
      
      await sleep(speedMap[streamSpeed]);
    }
    
    const finalSegments = segmenterRef.current.finalize();
    if (finalSegments.length > 0) {
      const allSegments = segmenterRef.current.getSegments();
      setSegments(allSegments);
      
      // 智能入队最后的segments
      const canEnqueue = Math.max(0, maxQueueSize - queueLength);
      const toEnqueue = finalSegments.slice(0, canEnqueue);
      const toPending = finalSegments.slice(canEnqueue);
      
      toEnqueue.forEach(segment => {
        audioPlayerRef.current?.enqueue({
          url: generateTTSUrl(segment.text, segment.type),
          textRef: segment
        });
      });
      
      if (toPending.length > 0) {
        setPendingSegments(prev => [...prev, ...toPending]);
      }
      
      setQueueLength(prev => prev + toEnqueue.length);
    }
    
    setBuffer('');
    setIsStreaming(false);
    setStreamProgress(100);
  };

  // 流式播放：停止
  const handleStopStream = () => {
    setIsStreaming(false);
    audioPlayerRef.current?.clear();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSegmentId(null);
    setQueueLength(0);
    setStreamProgress(0);
    setBuffer('');
    currentStreamIndexRef.current = 0;
    setPendingSegments([]);
  };

  // 切换模式
  const handleToggleMode = () => {
    // 停止当前播放
    handleStop();
    setIsStreaming(false);
    setStreamProgress(0);
    setBuffer('');
    currentStreamIndexRef.current = 0;
    setPendingSegments([]); // 清空待处理队列
    
    // 切换模式
    setIsStreamMode(!isStreamMode);
    
    // 如果切换到静态模式，重新加载segments
    if (isStreamMode) {
      setSegments([]);
    }
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
        flexShrink: 0,
        flexWrap: 'wrap'
      }}>
        {/* 模式切换 */}
        <button 
          onClick={handleToggleMode}
          style={{
            ...buttonStyle(),
            backgroundColor: isStreamMode ? '#10b981' : '#6b7280'
          }}
        >
          {isStreamMode ? '🌊 流式模式' : '📄 静态模式'}
        </button>
        
        <div style={{ width: '1px', height: '24px', backgroundColor: '#d1d5db' }} />
        
        {/* 静态模式控制 */}
        {!isStreamMode && (
          <>
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
          </>
        )}
        
        {/* 流式模式控制 */}
        {isStreamMode && (
          <>
            {!isStreaming && streamProgress === 0 && (
              <button 
                onClick={handleStartStream}
                style={buttonStyle()}
              >
                <Play size={16} />
                开始流式播放
              </button>
            )}
            
            {isStreaming && (
              <>
                <button onClick={handlePauseStream} style={buttonStyle()}>
                  <Pause size={16} />
                  暂停输入
                </button>
                <button onClick={handleStopStream} style={stopButtonStyle}>
                  <Square size={16} />
                  停止
                </button>
              </>
            )}
            
            {!isStreaming && streamProgress > 0 && streamProgress < 100 && (
              <>
                <button onClick={handleResumeStream} style={buttonStyle()}>
                  <Play size={16} />
                  继续输入
                </button>
                <button onClick={handleStopStream} style={stopButtonStyle}>
                  <Square size={16} />
                  停止
                </button>
              </>
            )}
            
            {/* 速度控制 */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>速度:</span>
              {(['fast', 'medium', 'slow'] as const).map(speed => (
                <button
                  key={speed}
                  onClick={() => setStreamSpeed(speed)}
                  disabled={isStreaming}
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    backgroundColor: streamSpeed === speed ? '#3b82f6' : '#e5e7eb',
                    color: streamSpeed === speed ? 'white' : '#6b7280',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isStreaming ? 'not-allowed' : 'pointer',
                    opacity: isStreaming ? 0.5 : 1
                  }}
                >
                  {speed === 'fast' ? '快' : speed === 'medium' ? '中' : '慢'}
                </button>
              ))}
            </div>
            
            {/* 进度条 */}
            {streamProgress > 0 && (
              <div style={{ 
                flex: 1, 
                minWidth: '120px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  flex: 1,
                  height: '6px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${streamProgress}%`,
                    backgroundColor: '#3b82f6',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <span style={{ fontSize: '12px', color: '#6b7280', minWidth: '45px' }}>
                  {streamProgress.toFixed(0)}%
                </span>
              </div>
            )}
          </>
        )}
        
        <div style={{
          marginLeft: 'auto',
          fontSize: '14px',
          color: '#6b7280',
          display: 'flex',
          gap: '16px',
          alignItems: 'center'
        }}>
          <span>队列: <strong>{queueLength}</strong> 个</span>
          {pendingSegments.length > 0 && (
            <span style={{ color: '#f59e0b', fontSize: '13px' }}>
              待入队: <strong>{pendingSegments.length}</strong>
            </span>
          )}
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
            
            {/* 流式模式：显示缓冲区 */}
            {isStreamMode && buffer && (
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

