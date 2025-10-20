import React, { useEffect, useRef, useState } from 'react';

interface TextHighlighterProps {
  text: string;
  progress: number; // 0-1之间的进度
  className?: string;
  highlightColor?: string;
  currentParagraph?: string; // 当前正在播放的段落
}

const TextHighlighter: React.FC<TextHighlighterProps> = ({
  text,
  progress,
  className = '',
  highlightColor = '#3b82f6',
  currentParagraph
}) => {
  const [highlightedText, setHighlightedText] = useState<React.ReactNode[]>([]);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!text || progress <= 0) {
      setHighlightedText([text]);
      return;
    }

    // 如果有当前段落，使用段落高亮模式
    if (currentParagraph) {
      const elements: React.ReactNode[] = [];
      const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
      
      paragraphs.forEach((paragraph, paragraphIndex) => {
        const isCurrentParagraph = paragraph === currentParagraph;
        const isCompletedParagraph = paragraphIndex < Math.floor(progress * paragraphs.length);
        
        if (isCompletedParagraph) {
          // 已完成的段落 - 高亮显示
          elements.push(
            <div
              key={paragraphIndex}
              style={{
                backgroundColor: highlightColor,
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                margin: '4px 0',
                transition: 'all 0.3s ease'
              }}
            >
              {paragraph}
            </div>
          );
        } else if (isCurrentParagraph) {
          // 当前播放的段落 - 部分高亮
          const paragraphProgress = (progress * paragraphs.length) - paragraphIndex;
          const highlightedChars = Math.floor(paragraph.length * paragraphProgress);
          
          const paragraphElements: React.ReactNode[] = [];
          paragraph.split('').forEach((char, charIndex) => {
            if (charIndex < highlightedChars) {
              paragraphElements.push(
                <span
                  key={charIndex}
                  style={{
                    backgroundColor: highlightColor,
                    color: 'white',
                    padding: '1px 2px',
                    borderRadius: '2px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {char}
                </span>
              );
            } else {
              paragraphElements.push(
                <span key={charIndex}>{char}</span>
              );
            }
          });
          
          elements.push(
            <div
              key={paragraphIndex}
              style={{
                backgroundColor: '#f0f8ff',
                padding: '4px 8px',
                borderRadius: '4px',
                margin: '4px 0',
                border: `2px solid ${highlightColor}`,
                transition: 'all 0.3s ease'
              }}
            >
              {paragraphElements}
            </div>
          );
        } else {
          // 未播放的段落 - 正常显示
          elements.push(
            <div
              key={paragraphIndex}
              style={{
                padding: '4px 8px',
                margin: '4px 0',
                transition: 'all 0.3s ease'
              }}
            >
              {paragraph}
            </div>
          );
        }
      });
      
      setHighlightedText(elements);
    } else {
      // 传统字符高亮模式
      const characters = text.split('');
      const totalChars = characters.length;
      const highlightedChars = Math.floor(totalChars * progress);

      const elements: React.ReactNode[] = [];

      characters.forEach((char, index) => {
        if (index < highlightedChars) {
          elements.push(
            <span
              key={index}
              style={{
                backgroundColor: highlightColor,
                color: 'white',
                padding: '1px 2px',
                borderRadius: '2px',
                transition: 'all 0.3s ease'
              }}
            >
              {char}
            </span>
          );
        } else {
          elements.push(
            <span key={index}>{char}</span>
          );
        }
      });

      setHighlightedText(elements);
    }
  }, [text, progress, highlightColor, currentParagraph]);

  return (
    <div ref={textRef} className={className}>
      {highlightedText}
    </div>
  );
};

export default TextHighlighter;
