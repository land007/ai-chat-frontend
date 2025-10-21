/**
 * @fileoverview 高亮显示器组件
 * 负责在 Markdown 渲染过程中高亮显示当前正在播放的段落
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export interface HighlightRendererProps {
  /** 要渲染的文本内容 */
  text: string;
  /** 当前正在播放的段落文本 */
  currentPlayingParagraph?: string;
  /** 是否为暗色模式 */
  isDarkMode?: boolean;
  /** 打字机效果的速度（毫秒） */
  typewriterSpeed?: number;
  /** 打字机效果的回调 */
  onTypewriterComplete?: () => void;
  /** 段落完成回调 */
  onParagraphComplete?: (paragraph: string, index: number) => void;
}

/**
 * 高亮显示器组件
 * 结合打字机效果和段落高亮功能
 */
export const HighlightRenderer: React.FC<HighlightRendererProps> = ({
  text,
  currentPlayingParagraph,
  isDarkMode = false,
  typewriterSpeed = 30,
  onTypewriterComplete,
  onParagraphComplete,
}) => {
  const [displayedText, setDisplayedText] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);
  const [paragraphs, setParagraphs] = React.useState<string[]>([]);

  // 分割文本为段落
  React.useEffect(() => {
    const splitText = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    setParagraphs(splitText);
    setDisplayedText('');
  }, [text]);

  // 打字机效果
  const startTyping = React.useCallback(() => {
    if (paragraphs.length === 0) return;

    setIsTyping(true);
    let currentIndex = 0;
    let currentParagraph = 0;
    let currentText = '';

    const typeNextChar = () => {
      if (currentParagraph >= paragraphs.length) {
        setIsTyping(false);
        onTypewriterComplete?.();
        return;
      }

      const paragraph = paragraphs[currentParagraph];
      if (currentIndex < paragraph.length) {
        currentText += paragraph[currentIndex];
        setDisplayedText(currentText);
        currentIndex++;
        setTimeout(typeNextChar, typewriterSpeed);
      } else {
        // 段落完成
        onParagraphComplete?.(paragraph, currentParagraph);
        currentParagraph++;
        currentIndex = 0;
        if (currentParagraph < paragraphs.length) {
          currentText += '\n\n';
          setDisplayedText(currentText);
          setTimeout(typeNextChar, typewriterSpeed * 2); // 段落间稍长停顿
        } else {
          setIsTyping(false);
          onTypewriterComplete?.();
        }
      }
    };

    typeNextChar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paragraphs, typewriterSpeed]);

  // 开始打字机效果
  React.useEffect(() => {
    if (paragraphs.length > 0) {
      startTyping();
    }
  }, [paragraphs, startTyping]);

  // 重置打字机效果
  React.useEffect(() => {
    if (text) {
      setDisplayedText('');
      setIsTyping(false);
    }
  }, [text]);

  // 检查段落是否正在播放
  // 只有当 currentPlayingParagraph 不为 undefined 时才可能高亮
  // 这确保了高亮功能与TTS功能绑定
  const isParagraphPlaying = React.useCallback((paragraphText: string): boolean => {
    return Boolean(currentPlayingParagraph && paragraphText.includes(currentPlayingParagraph));
  }, [currentPlayingParagraph]);

  // 获取高亮样式
  const getHighlightStyle = React.useCallback((isPlaying: boolean) => {
    if (!isPlaying) return {};

    return {
      backgroundColor: isDarkMode ? '#2d3748' : '#f0f8ff',
      border: `2px solid ${isDarkMode ? '#3b82f6' : '#3b82f6'}`,
      borderRadius: '4px',
      padding: '8px',
      transition: 'all 0.3s ease',
    };
  }, [isDarkMode]);

  // 使用 useMemo 优化 components 对象
  const components = React.useMemo(() => ({
    // 自定义段落组件，支持高亮
    p: ({ children }: { children?: React.ReactNode }) => {
      const paragraphText = typeof children === 'string' ? children : '';
      const isPlaying = isParagraphPlaying(paragraphText);
      const highlightStyle = getHighlightStyle(isPlaying);

      return (
        <p style={{ 
          margin: '4px 0', 
          lineHeight: '1.5',
          ...highlightStyle
        }}>
          {children}
        </p>
      );
    },
    // 代码块样式
    code: ({ children, className, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode; className?: string }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code
            style={{
              backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
              color: isDarkMode ? '#f9fafb' : '#374151',
              padding: '2px 4px',
              borderRadius: '3px',
              fontSize: '0.9em',
            }}
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    // 表格样式
    table: ({ children }: { children?: React.ReactNode }) => (
      <table style={{
        borderCollapse: 'collapse',
        width: '100%',
        margin: '8px 0',
        border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
      }}>
        {children}
      </table>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
      <th style={{
        border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
        padding: '8px',
        backgroundColor: isDarkMode ? '#374151' : '#f9fafb',
        textAlign: 'left',
      }}>
        {children}
      </th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td style={{
        border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
        padding: '8px',
      }}>
        {children}
      </td>
    ),
    // 引用块样式
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote style={{
        borderLeft: `4px solid ${isDarkMode ? '#3b82f6' : '#3b82f6'}`,
        paddingLeft: '16px',
        margin: '8px 0',
        backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
        color: isDarkMode ? '#d1d5db' : '#374151',
      }}>
        {children}
      </blockquote>
    ),
    // 水平分割线样式
    hr: () => (
      <hr style={{
        border: 'none',
        borderTop: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
        margin: '16px 0',
      }} />
    ),
  }), [isParagraphPlaying, getHighlightStyle, isDarkMode]);

  return (
    <div style={{ position: 'relative' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {displayedText + (isTyping ? '|' : '')}
      </ReactMarkdown>
    </div>
  );
};

export default HighlightRenderer;
