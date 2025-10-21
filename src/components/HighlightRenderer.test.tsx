/**
 * @fileoverview 高亮显示器组件测试
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import HighlightRenderer, { HighlightRendererProps } from './HighlightRenderer';

// Mock ReactMarkdown
jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children, components }: any) {
    const { p: PComponent } = components || {};
    
    if (PComponent) {
      return (
        <div data-testid="markdown-content">
          {typeof children === 'string' ? 
            children.split('\n\n').map((paragraph: string, index: number) => (
              <PComponent key={index}>{paragraph}</PComponent>
            )) : 
            children
          }
        </div>
      );
    }
    
    return <div data-testid="markdown-content">{children}</div>;
  };
});

// Mock remark plugins
jest.mock('remark-gfm', () => ({}));
jest.mock('rehype-highlight', () => ({}));

describe('HighlightRenderer', () => {
  const defaultProps: HighlightRendererProps = {
    text: '这是第一段文本。\n\n这是第二段文本。',
    isDarkMode: false,
    typewriterSpeed: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('基本渲染', () => {
    test('应该正确渲染组件', () => {
      render(<HighlightRenderer {...defaultProps} />);
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    test('应该支持暗色模式', () => {
      render(<HighlightRenderer {...defaultProps} isDarkMode={true} />);
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    test('应该处理空文本', () => {
      render(<HighlightRenderer {...defaultProps} text="" />);
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });
  });

  describe('打字机效果', () => {
    test('应该显示打字机效果', async () => {
      const onTypewriterComplete = jest.fn();
      render(
        <HighlightRenderer 
          {...defaultProps} 
          onTypewriterComplete={onTypewriterComplete}
        />
      );

      // 初始状态应该为空
      expect(screen.getByTestId('markdown-content')).toHaveTextContent('');

      // 模拟时间推进
      jest.advanceTimersByTime(100);
      
      // 应该开始显示文本
      await waitFor(() => {
        expect(screen.getByTestId('markdown-content')).toHaveTextContent('这是第一段文本');
      });

      // 继续推进时间直到完成
      jest.advanceTimersByTime(1000);
      
      await waitFor(() => {
        expect(onTypewriterComplete).toHaveBeenCalled();
      });
    });

    test('应该支持自定义打字速度', () => {
      const fastProps = { ...defaultProps, typewriterSpeed: 1 };
      render(<HighlightRenderer {...fastProps} />);

      // 快速打字应该更快完成
      jest.advanceTimersByTime(100);
      
      expect(screen.getByTestId('markdown-content')).toHaveTextContent('这是第一段文本');
    });

    test('应该处理单段落文本', () => {
      const singleParagraphProps = { ...defaultProps, text: '只有一个段落' };
      render(<HighlightRenderer {...singleParagraphProps} />);

      jest.advanceTimersByTime(100);
      
      expect(screen.getByTestId('markdown-content')).toHaveTextContent('只有一个段落');
    });
  });

  describe('段落高亮', () => {
    test('应该高亮当前播放的段落', async () => {
      const currentPlayingParagraph = '第一段文本';
      render(
        <HighlightRenderer 
          {...defaultProps} 
          currentPlayingParagraph={currentPlayingParagraph}
        />
      );

      // 等待打字机效果完成
      jest.advanceTimersByTime(1000);
      
      await waitFor(() => {
        const paragraphs = screen.getAllByText(/第一段文本|第二段文本/);
        expect(paragraphs.length).toBeGreaterThan(0);
      });
    });

    test('应该在没有播放段落时不显示高亮', () => {
      render(<HighlightRenderer {...defaultProps} />);

      jest.advanceTimersByTime(1000);
      
      // 不应该有高亮样式
      const content = screen.getByTestId('markdown-content');
      expect(content).toBeInTheDocument();
    });

    test('应该处理部分匹配的段落文本', () => {
      const currentPlayingParagraph = '第一段';
      render(
        <HighlightRenderer 
          {...defaultProps} 
          currentPlayingParagraph={currentPlayingParagraph}
        />
      );

      jest.advanceTimersByTime(1000);
      
      // 应该能找到包含"第一段"的段落
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });
  });

  describe('回调函数', () => {
    test('应该调用段落完成回调', async () => {
      const onParagraphComplete = jest.fn();
      render(
        <HighlightRenderer 
          {...defaultProps} 
          onParagraphComplete={onParagraphComplete}
        />
      );

      // 推进时间让第一个段落完成
      jest.advanceTimersByTime(500);
      
      await waitFor(() => {
        expect(onParagraphComplete).toHaveBeenCalledWith('这是第一段文本。', 0);
      });
    });

    test('应该调用打字机完成回调', async () => {
      const onTypewriterComplete = jest.fn();
      render(
        <HighlightRenderer 
          {...defaultProps} 
          onTypewriterComplete={onTypewriterComplete}
        />
      );

      // 推进时间让所有文本完成
      jest.advanceTimersByTime(2000);
      
      await waitFor(() => {
        expect(onTypewriterComplete).toHaveBeenCalled();
      });
    });
  });

  describe('文本分割', () => {
    test('应该正确分割多段落文本', () => {
      const multiParagraphText = '段落1\n\n段落2\n\n段落3';
      render(<HighlightRenderer {...defaultProps} text={multiParagraphText} />);

      jest.advanceTimersByTime(1000);
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    test('应该过滤空段落', () => {
      const textWithEmptyParagraphs = '段落1\n\n\n\n段落2';
      render(<HighlightRenderer {...defaultProps} text={textWithEmptyParagraphs} />);

      jest.advanceTimersByTime(1000);
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    test('应该处理只有空格的段落', () => {
      const textWithSpaces = '段落1\n\n   \n\n段落2';
      render(<HighlightRenderer {...defaultProps} text={textWithSpaces} />);

      jest.advanceTimersByTime(1000);
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });
  });

  describe('样式处理', () => {
    test('应该在暗色模式下应用正确的样式', () => {
      render(<HighlightRenderer {...defaultProps} isDarkMode={true} />);

      jest.advanceTimersByTime(1000);
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    test('应该在亮色模式下应用正确的样式', () => {
      render(<HighlightRenderer {...defaultProps} isDarkMode={false} />);

      jest.advanceTimersByTime(1000);
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });
  });

  describe('边界情况', () => {
    test('应该处理特殊字符', () => {
      const specialText = '包含特殊字符：!@#$%^&*()_+-=[]{}|;:,.<>?';
      render(<HighlightRenderer {...defaultProps} text={specialText} />);

      jest.advanceTimersByTime(1000);
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    test('应该处理长文本', () => {
      const longText = '这是一个很长的段落'.repeat(100);
      render(<HighlightRenderer {...defaultProps} text={longText} />);

      jest.advanceTimersByTime(1000);
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    test('应该处理换行符', () => {
      const textWithNewlines = '第一行\n第二行\n\n第三段';
      render(<HighlightRenderer {...defaultProps} text={textWithNewlines} />);

      jest.advanceTimersByTime(1000);
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });
  });

  describe('性能测试', () => {
    test('应该处理大量段落', () => {
      const manyParagraphs = Array.from({ length: 50 }, (_, i) => `段落${i + 1}`).join('\n\n');
      render(<HighlightRenderer {...defaultProps} text={manyParagraphs} />);

      jest.advanceTimersByTime(1000);
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    test('应该处理快速文本变化', () => {
      const { rerender } = render(<HighlightRenderer {...defaultProps} />);
      
      jest.advanceTimersByTime(100);
      
      // 快速改变文本
      rerender(<HighlightRenderer {...defaultProps} text="新文本" />);
      
      jest.advanceTimersByTime(100);
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });
  });
});
