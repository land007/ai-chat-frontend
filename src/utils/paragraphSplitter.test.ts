/**
 * 段落拆分器测试
 */

import { splitIntoParagraphs, getParagraphStats, SplitOptions } from './paragraphSplitter';

describe('ParagraphSplitter', () => {
  describe('splitIntoParagraphs', () => {
    test('空字符串处理', () => {
      expect(splitIntoParagraphs('')).toEqual([]);
      expect(splitIntoParagraphs('   ')).toEqual([]);
      expect(splitIntoParagraphs('\n\n')).toEqual([]);
    });

    test('单段落文本', () => {
      const text = '这是一个单段落文本，没有换行符。';
      const result = splitIntoParagraphs(text);
      expect(result).toEqual([text]);
    });

    test('多段落文本（双换行符）', () => {
      const text = '第一段文本。\n\n第二段文本。\n\n第三段文本。';
      const result = splitIntoParagraphs(text);
      expect(result).toEqual(['第一段文本。', '第二段文本。', '第三段文本。']);
    });

    test('长段落自动分割', () => {
      const text = '这是一个很长的段落，超过了默认的最大长度限制，应该被自动分割成多个句子。这个句子也应该被分割。最后这个句子也会被分割。';
      const result = splitIntoParagraphs(text, { maxLength: 50 });
      expect(result.length).toBeGreaterThan(1);
      expect(result.every(p => p.length <= 50)).toBe(true);
    });

    test('混合分割策略', () => {
      const text = '第一段。\n\n这是一个很长的第二段，超过了最大长度限制，应该被分割成多个句子。这个句子也会被分割。\n\n第三段。';
      const result = splitIntoParagraphs(text, { maxLength: 30 });
      expect(result.length).toBeGreaterThan(3);
      expect(result).toContain('第一段。');
      expect(result).toContain('第三段。');
    });

    test('特殊字符处理', () => {
      const text = '包含特殊字符的段落：!@#$%^&*()_+{}|:"<>?[]\\;\',./\n\n另一个段落。';
      const result = splitIntoParagraphs(text);
      expect(result).toHaveLength(2);
      expect(result[0]).toContain('!@#$%^&*()');
    });

    test('自定义选项', () => {
      const text = '第一段。\n\n第二段。';
      const result = splitIntoParagraphs(text, { 
        splitByDoubleNewline: false,
        splitBySentence: false 
      });
      expect(result).toEqual([text]);
    });

    test('只按句子分割', () => {
      const text = '第一句。第二句！第三句？第四句。';
      const result = splitIntoParagraphs(text, { 
        splitByDoubleNewline: false,
        splitBySentence: true,
        maxLength: 10
      });
      expect(result).toEqual(['第一句', '第二句', '第三句', '第四句']);
    });

    test('包含空行的处理', () => {
      const text = '第一段。\n\n\n\n第二段。\n\n   \n\n第三段。';
      const result = splitIntoParagraphs(text);
      expect(result).toEqual(['第一段。', '第二段。', '第三段。']);
    });

    test('英文文本处理', () => {
      const text = 'This is the first paragraph.\n\nThis is the second paragraph with a very long sentence that should be split into multiple parts when it exceeds the maximum length limit.\n\nThis is the third paragraph.';
      const result = splitIntoParagraphs(text, { maxLength: 50 });
      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result[0]).toBe('This is the first paragraph.');
      expect(result[result.length - 1]).toBe('This is the third paragraph.');
    });
  });

  describe('getParagraphStats', () => {
    test('空数组统计', () => {
      const stats = getParagraphStats([]);
      expect(stats).toEqual({
        totalParagraphs: 0,
        totalLength: 0,
        averageLength: 0,
        maxLength: 0,
        minLength: 0
      });
    });

    test('单段落统计', () => {
      const paragraphs = ['这是一个测试段落'];
      const stats = getParagraphStats(paragraphs);
      expect(stats).toEqual({
        totalParagraphs: 1,
        totalLength: 8,
        averageLength: 8,
        maxLength: 8,
        minLength: 8
      });
    });

    test('多段落统计', () => {
      const paragraphs = ['短', '中等长度的段落', '这是一个比较长的段落内容'];
      const stats = getParagraphStats(paragraphs);
      expect(stats.totalParagraphs).toBe(3);
      expect(stats.totalLength).toBe(20);
      expect(stats.averageLength).toBe(7);
      expect(stats.maxLength).toBe(12);
      expect(stats.minLength).toBe(1);
    });

    test('包含空字符串的统计', () => {
      const paragraphs = ['段落1', '', '段落2'];
      const stats = getParagraphStats(paragraphs);
      expect(stats.totalParagraphs).toBe(3);
      expect(stats.minLength).toBe(0);
    });
  });

  describe('边界情况', () => {
    test('只有换行符的文本', () => {
      const text = '\n\n\n';
      const result = splitIntoParagraphs(text);
      expect(result).toEqual([]);
    });

    test('只有标点符号的文本', () => {
      const text = '。！？.!?';
      const result = splitIntoParagraphs(text, { splitBySentence: true });
      expect(result).toEqual(['。！？.!?']);
    });

    test('最大长度设置为0', () => {
      const text = '测试文本';
      const result = splitIntoParagraphs(text, { maxLength: 0 });
      expect(result).toEqual([text]);
    });

    test('最大长度设置为1', () => {
      const text = '测试文本';
      const result = splitIntoParagraphs(text, { maxLength: 1, splitBySentence: true });
      // 当没有句子分隔符时，会按字符分割
      expect(result.length).toBe(4);
      expect(result.every(p => p.length <= 1)).toBe(true);
    });
  });
});
