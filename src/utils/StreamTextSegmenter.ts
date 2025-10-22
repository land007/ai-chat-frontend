/**
 * 流式文本分段器
 * 
 * 用于处理SSE流式返回的文本内容，实时识别完整段落
 * 支持markdown格式的段落类型识别
 */

export interface TextSegment {
  id: string;
  text: string;
  type: 'paragraph' | 'code' | 'heading' | 'list' | 'quote';
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
    this.buffer += chunk;
    return this.extractCompleteSegments();
  }

  /**
   * 提取完整段落
   * 规则：
   * 1. 代码块（```...```）作为一个整体段落
   * 2. 普通段落遇到 \n\n 表示段落结束
   * 3. 标题、列表、引用等特殊格式单独成段
   */
  private extractCompleteSegments(): TextSegment[] {
    const newSegments: TextSegment[] = [];

    // 处理代码块
    if (this.handleCodeBlock(newSegments)) {
      return newSegments;
    }

    // 检查是否有完整段落（以\n\n分隔）
    // 使用[\s\S]代替.来匹配包括换行符的任意字符（兼容ES2017）
    const paragraphMatch = this.buffer.match(/([\s\S]*?)\n\n/);
    
    if (paragraphMatch) {
      const completeText = paragraphMatch[1].trim();
      
      if (completeText) {
        // 检查是否是多行内容需要进一步分割
        const lines = completeText.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            const segment = this.createSegment(trimmedLine, true);
            this.segments.push(segment);
            newSegments.push(segment);
          }
        }
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
      const codeEndMatch = this.codeBlockBuffer.match(/```[\s\S]*?```/);
      
      if (codeEndMatch) {
        // 找到完整代码块
        const codeBlock = codeEndMatch[0];
        const segment = this.createSegment(codeBlock, true);
        this.segments.push(segment);
        newSegments.push(segment);

        // 更新缓冲区
        const remainingAfterCode = this.codeBlockBuffer.substring(codeBlock.length);
        this.buffer = remainingAfterCode;
        this.codeBlockBuffer = '';
        this.inCodeBlock = false;

        return true;
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

    // 处理剩余缓冲区内容
    if (this.buffer.trim()) {
      const lines = this.buffer.trim().split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          const segment = this.createSegment(trimmed, true);
          this.segments.push(segment);
          newSegments.push(segment);
        }
      }
      
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
   */
  private detectType(text: string): TextSegment['type'] {
    const trimmed = text.trim();
    
    // 代码块
    if (trimmed.startsWith('```')) {
      return 'code';
    }
    
    // 标题
    if (trimmed.match(/^#{1,6}\s+/)) {
      return 'heading';
    }
    
    // 列表（无序或有序）
    if (trimmed.match(/^[-*+]\s+/) || trimmed.match(/^\d+\.\s+/)) {
      return 'list';
    }
    
    // 引用
    if (trimmed.startsWith('>')) {
      return 'quote';
    }
    
    // 默认为段落
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

