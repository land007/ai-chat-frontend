/**
 * 段落拆分器 - 将文本按规则拆分为段落数组
 * 纯函数，无副作用，易于测试
 */

export interface SplitOptions {
  /** 段落最大长度，超过此长度会自动分割 */
  maxLength?: number;
  /** 是否按双换行符分割 */
  splitByDoubleNewline?: boolean;
  /** 是否按句子结尾分割 */
  splitBySentence?: boolean;
}

/**
 * 将文本拆分为段落数组
 * @param text 要拆分的文本
 * @param options 拆分选项
 * @returns 段落数组
 */
export function splitIntoParagraphs(text: string, options: SplitOptions = {}): string[] {
  const {
    maxLength = 200,
    splitByDoubleNewline = true,
    splitBySentence = true
  } = options;

  // 处理空字符串
  if (!text || text.trim().length === 0) {
    return [];
  }

  console.log('[ParagraphSplitter] 开始分割文本:', text);

  // 按双换行符分割
  let paragraphs: string[] = [];
  if (splitByDoubleNewline) {
    paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  } else {
    paragraphs = [text.trim()];
  }

  console.log('[ParagraphSplitter] 按双换行符分割结果:', paragraphs);

  // 处理长段落
  const result: string[] = [];
  paragraphs.forEach((paragraph, index) => {
    console.log(`[ParagraphSplitter] 处理第${index + 1}个段落，长度: ${paragraph.length}`);

    if (paragraph.length > maxLength && splitBySentence) {
      // 按句子分割长段落
      const sentences = paragraph.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
      console.log(`[ParagraphSplitter] 长段落分割为${sentences.length}个句子:`, sentences);
      
      // 检查是否有实际的句子分隔符
      const hasSentenceSeparators = /[。！？.!?]/.test(paragraph);
      
      if (hasSentenceSeparators && sentences.length > 0) {
        sentences.forEach(sentence => {
          if (sentence.trim().length > 0) {
            result.push(sentence.trim());
          }
        });
      } else {
        // 如果没有句子分隔符，按字符分割
        console.log(`[ParagraphSplitter] 没有句子分隔符，按字符分割，长度${paragraph.length}，最大长度${maxLength}`);
        if (maxLength > 0) {
          for (let i = 0; i < paragraph.length; i += maxLength) {
            result.push(paragraph.slice(i, i + maxLength));
          }
        } else {
          // maxLength为0时，不分割
          result.push(paragraph);
        }
      }
    } else if (paragraph.length > maxLength) {
      // 不按句子分割，直接按字符分割
      console.log(`[ParagraphSplitter] 不按句子分割，直接按字符分割，长度${paragraph.length}，最大长度${maxLength}`);
      if (maxLength > 0) {
        for (let i = 0; i < paragraph.length; i += maxLength) {
          result.push(paragraph.slice(i, i + maxLength));
        }
      } else {
        // maxLength为0时，不分割
        result.push(paragraph);
      }
    } else {
      result.push(paragraph);
    }
  });

  console.log('[ParagraphSplitter] 最终分割结果:', result);
  return result;
}

/**
 * 获取段落统计信息
 * @param paragraphs 段落数组
 * @returns 统计信息
 */
export function getParagraphStats(paragraphs: string[]): {
  totalParagraphs: number;
  totalLength: number;
  averageLength: number;
  maxLength: number;
  minLength: number;
} {
  if (paragraphs.length === 0) {
    return {
      totalParagraphs: 0,
      totalLength: 0,
      averageLength: 0,
      maxLength: 0,
      minLength: 0
    };
  }

  const lengths = paragraphs.map(p => p.length);
  const totalLength = lengths.reduce((sum, len) => sum + len, 0);

  return {
    totalParagraphs: paragraphs.length,
    totalLength,
    averageLength: Math.round(totalLength / paragraphs.length),
    maxLength: Math.max(...lengths),
    minLength: Math.min(...lengths)
  };
}
