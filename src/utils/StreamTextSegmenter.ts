/**
 * 流式文本分段器
 * 
 * 用于处理SSE流式返回的文本内容，实时识别完整段落
 * 支持markdown格式的段落类型识别
 * 
 * 分段策略：
 * - 代码块（```...```）：保持完整，不拆分
 * - 标题（# ...）：单独成段
 * - 列表项：连续列表作为整体
 * - 表格：整张表格作为一个段落
 * - 引用块：整个引用块作为一个段落
 * - 普通段落：按句子分段（中英文标点：。！？.!?）
 */

export interface TextSegment {
  id: string;
  text: string;
  type: 'paragraph' | 'code' | 'heading' | 'list' | 'quote' | 'table';
  isComplete: boolean;
}

export class StreamTextSegmenter {
  private buffer: string = '';
  private segments: TextSegment[] = [];
  private segmentCounter: number = 0;
  private inCodeBlock: boolean = false;
  private codeBlockBuffer: string = '';

  /**
   * 添加新的文本块（SSE推送的内容）
   * @param chunk 新增的文本内容
   * @returns 新增的完整段落数组
   */
  addChunk(chunk: string): TextSegment[] {
    // 如果在代码块中，追加到codeBlockBuffer；否则追加到buffer
    if (this.inCodeBlock) {
      this.codeBlockBuffer += chunk;
    } else {
      this.buffer += chunk;
    }
    return this.extractCompleteSegments();
  }

  /**
   * 提取完整段落
   * 采用混合策略：
   * 1. 代码块（```...```）作为一个整体段落
   * 2. 表格（|...|）整张表格作为一个段落
   * 3. 标题、列表、引用等保持结构完整
   * 4. 普通段落按句子分段（中英文标点）
   */
  private extractCompleteSegments(): TextSegment[] {
    const newSegments: TextSegment[] = [];

    // 1. 优先处理代码块（如果已经在代码块中，继续等待结束标记）
    if (this.inCodeBlock) {
      // 如果在代码块中，不处理普通段落，直接返回
      if (this.handleCodeBlock(newSegments)) {
        return newSegments;
      }
      // 代码块未完成，返回空数组
      return newSegments;
    }

    // 2. 检测代码块开始（非代码块状态）
    if (this.handleCodeBlock(newSegments)) {
      return newSegments;
    }

    // 3. 检查是否有完整段落（以\n\n分隔）
    const paragraphMatch = this.buffer.match(/([\s\S]*?)\n\n/);
    
    if (paragraphMatch) {
      const completeText = paragraphMatch[1].trim();
      
      if (completeText) {
        // 4. 根据内容类型决定如何分段
        this.processBlock(completeText, newSegments);
      }

      // 更新缓冲区，移除已处理的内容
      this.buffer = this.buffer.substring(paragraphMatch[0].length);

      // 递归处理剩余内容
      const moreSegments = this.extractCompleteSegments();
      newSegments.push(...moreSegments);
    }

    return newSegments;
  }

  /**
   * 处理一个文本块，根据类型决定是否需要进一步拆分为句子
   */
  private processBlock(text: string, newSegments: TextSegment[]): void {
    const type = this.detectType(text);

    // 对于这些类型，保持完整，不拆分
    if (type === 'code' || type === 'table' || type === 'list' || type === 'quote' || type === 'heading') {
      const segment = this.createSegment(text, true);
      this.segments.push(segment);
      newSegments.push(segment);
      return;
    }

    // 普通段落：按句子拆分
    if (type === 'paragraph') {
      const sentences = this.splitIntoSentences(text);
      for (const sentence of sentences) {
        if (sentence.trim()) {
          const segment = this.createSegment(sentence.trim(), true);
          this.segments.push(segment);
          newSegments.push(segment);
        }
      }
    }
  }

  /**
   * 将文本按句子拆分
   * 支持中英文标点：。！？.!?
   * 
   * 注意事项：
   * - 避免拆分URL中的点号
   * - 避免拆分数字中的点号（如 3.14）
   * - 保留省略号（...）
   */
  private splitIntoSentences(text: string): string[] {
    const sentences: string[] = [];
    let current = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      current += char;
      
      // 检查是否是句子结束符
      if (this.isSentenceEnd(char)) {
        // 向前看，确保不是特殊情况
        const nextChar = text[i + 1];
        const prevChar = text[i - 1];
        
        // 跳过省略号中的点（...）
        if (char === '.' && prevChar === '.' && nextChar === '.') {
          continue;
        }
        
        // 跳过数字中的点（如 3.14）
        if (char === '.' && /\d/.test(prevChar) && /\d/.test(nextChar)) {
          continue;
        }
        
        // 跳过URL中的点（简单检测：前后都有字母数字）
        if (char === '.' && /[a-zA-Z0-9]/.test(prevChar) && /[a-zA-Z0-9/]/.test(nextChar)) {
          continue;
        }
        
        // 这是一个真正的句子结束
        sentences.push(current.trim());
        current = '';
      }
    }
    
    // 添加最后剩余的内容
    if (current.trim()) {
      sentences.push(current.trim());
    }
    
    return sentences;
  }

  /**
   * 判断字符是否是句子结束符
   */
  private isSentenceEnd(char: string): boolean {
    return char === '。' || char === '！' || char === '？' || 
           char === '.' || char === '!' || char === '?';
  }

  /**
   * 处理代码块
   * @returns 是否处理了代码块
   */
  private handleCodeBlock(newSegments: TextSegment[]): boolean {
    // 检测代码块开始
    if (!this.inCodeBlock && this.buffer.includes('```')) {
      const codeStartIndex = this.buffer.indexOf('```');
      
      // 处理代码块之前的内容
      if (codeStartIndex > 0) {
        const beforeCode = this.buffer.substring(0, codeStartIndex).trim();
        if (beforeCode) {
          const parts = beforeCode.split(/\n\n+/);
          parts.forEach(part => {
            const trimmed = part.trim();
            if (trimmed) {
              const segment = this.createSegment(trimmed, true);
              this.segments.push(segment);
              newSegments.push(segment);
            }
          });
        }
      }

      this.inCodeBlock = true;
      this.codeBlockBuffer = this.buffer.substring(codeStartIndex);
      this.buffer = '';
    }

    // 检测代码块结束
    if (this.inCodeBlock) {
      // 查找第二个```（代码块结束标记）
      const firstBacktick = this.codeBlockBuffer.indexOf('```');
      if (firstBacktick >= 0) {
        const secondBacktickIndex = this.codeBlockBuffer.indexOf('```', firstBacktick + 3);
        
        if (secondBacktickIndex > 0) {
          // 找到完整代码块，包含结束的```
          const codeBlock = this.codeBlockBuffer.substring(0, secondBacktickIndex + 3);
          const segment = this.createSegment(codeBlock.trim(), true);
          this.segments.push(segment);
          newSegments.push(segment);

          // 更新缓冲区
          const remainingAfterCode = this.codeBlockBuffer.substring(secondBacktickIndex + 3);
          this.buffer = remainingAfterCode;
          this.codeBlockBuffer = '';
          this.inCodeBlock = false;

          return true;
        }
      }
    }

    return false;
  }

  /**
   * 完成输入，处理缓冲区剩余内容
   * @returns 新增的段落数组
   */
  finalize(): TextSegment[] {
    const newSegments: TextSegment[] = [];

    // 处理未完成的代码块
    if (this.inCodeBlock && this.codeBlockBuffer.trim()) {
      const segment = this.createSegment(this.codeBlockBuffer.trim(), true);
      this.segments.push(segment);
      newSegments.push(segment);
      this.codeBlockBuffer = '';
      this.inCodeBlock = false;
    }

    // 处理剩余缓冲区内容（使用混合策略处理）
    if (this.buffer.trim()) {
      this.processBlock(this.buffer.trim(), newSegments);
      this.buffer = '';
    }

    return newSegments;
  }

  /**
   * 创建段落对象
   */
  private createSegment(text: string, isComplete: boolean): TextSegment {
    return {
      id: `segment-${this.segmentCounter++}`,
      text,
      type: this.detectType(text),
      isComplete
    };
  }

  /**
   * 检测段落类型
   * 优先级：代码块 > 表格 > 标题 > 列表 > 引用 > 段落
   */
  private detectType(text: string): TextSegment['type'] {
    const trimmed = text.trim();
    
    // 1. 代码块
    if (trimmed.startsWith('```')) {
      return 'code';
    }
    
    // 2. 表格（检测是否包含表格分隔符）
    // 表格特征：至少有一行包含 | 和 --- 
    if (trimmed.includes('|')) {
      const lines = trimmed.split('\n');
      const hasTableSeparator = lines.some(line => 
        line.includes('|') && line.includes('---')
      );
      if (hasTableSeparator) {
        return 'table';
      }
    }
    
    // 3. 标题
    if (trimmed.match(/^#{1,6}\s+/)) {
      return 'heading';
    }
    
    // 4. 列表（无序或有序）
    // 检测是否所有非空行都是列表项
    const lines = trimmed.split('\n').filter(line => line.trim());
    const isAllListItems = lines.every(line => {
      const trimmedLine = line.trim();
      return trimmedLine.match(/^[-*+]\s+/) || trimmedLine.match(/^\d+\.\s+/);
    });
    
    if (isAllListItems && lines.length > 0) {
      return 'list';
    }
    
    // 5. 引用
    if (trimmed.startsWith('>')) {
      return 'quote';
    }
    
    // 6. 默认为段落
    return 'paragraph';
  }

  /**
   * 获取所有段落
   */
  getSegments(): TextSegment[] {
    return this.segments;
  }

  /**
   * 获取当前缓冲区内容（未完成的段落）
   */
  getBuffer(): string {
    if (this.inCodeBlock) {
      return this.codeBlockBuffer;
    }
    return this.buffer;
  }

  /**
   * 重置分段器
   */
  reset(): void {
    this.buffer = '';
    this.segments = [];
    this.segmentCounter = 0;
    this.inCodeBlock = false;
    this.codeBlockBuffer = '';
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalSegments: this.segments.length,
      bufferLength: this.buffer.length,
      inCodeBlock: this.inCodeBlock,
      types: this.segments.reduce((acc, seg) => {
        acc[seg.type] = (acc[seg.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

