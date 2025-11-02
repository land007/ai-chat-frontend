import React from 'react';

interface DiffViewerProps {
  code: string; // 原始 diff 代码字符串
  isDarkMode?: boolean;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ code, isDarkMode = false }) => {
  // 确保 code 是字符串
  const codeString = typeof code === 'string' ? code : String(code || '');
  
  // 解析 diff 代码，识别添加和删除的行
  const parseDiffLines = (diffCode: string) => {
    if (!diffCode || !diffCode.trim()) {
      return [];
    }
    
    const lines = diffCode.split('\n');
    return lines.map((line, lineIndex) => {
      // 确保 line 是字符串
      const lineStr = typeof line === 'string' ? line : String(line || '');
      const trimmedLine = lineStr.trim();
      let type: 'addition' | 'deletion' | 'context' | 'header' = 'context';
      let content: string = lineStr;
      
      // 检查是否是 diff 头部信息
      if (trimmedLine.startsWith('---') || trimmedLine.startsWith('+++') || trimmedLine.startsWith('@@')) {
        type = 'header';
      }
      // 检查是否是添加的行（+ 开头，但不是 +++）
      else if (lineStr.startsWith('+') && !trimmedLine.startsWith('+++')) {
        type = 'addition';
        content = lineStr.substring(1); // 移除行首的 + 符号
      }
      // 检查是否是删除的行（- 开头，但不是 ---）
      else if (lineStr.startsWith('-') && !trimmedLine.startsWith('---')) {
        type = 'deletion';
        content = lineStr.substring(1); // 移除行首的 - 符号
      }
      // 上下文行（空格开头）
      else if (lineStr.startsWith(' ')) {
        type = 'context';
        content = lineStr.substring(1); // 移除行首的空格
      }
      // 其他情况（可能是空行）
      else {
        type = 'context';
        content = lineStr; // 保持原样
      }
      
      // 确保 content 是字符串
      const contentStr = typeof content === 'string' ? content : String(content || '');
      
      return { type, content: contentStr, original: lineStr };
    });
  };

  const diffLines = parseDiffLines(codeString);

  const getLineStyle = (type: string): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      display: 'block',
      padding: '2px 12px',
      margin: '2px 0',
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
      fontSize: '13px',
      lineHeight: '1.5',
      whiteSpace: 'pre',
    };

    switch (type) {
      case 'addition':
        return {
          ...baseStyle,
          backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
          borderLeft: `3px solid ${isDarkMode ? '#10b981' : '#059669'}`,
          color: isDarkMode ? '#d1fae5' : '#065f46',
        };
      case 'deletion':
        return {
          ...baseStyle,
          backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)',
          borderLeft: `3px solid ${isDarkMode ? '#ef4444' : '#dc2626'}`,
          color: isDarkMode ? '#fee2e2' : '#991b1b',
        };
      case 'header':
        return {
          ...baseStyle,
          color: isDarkMode ? '#9ca3af' : '#6b7280',
          fontStyle: 'italic',
        };
      default:
        return {
          ...baseStyle,
          color: isDarkMode ? '#e5e7eb' : '#24292e',
        };
    }
  };

  const getPrefix = (type: string): React.ReactNode => {
    switch (type) {
      case 'addition':
        return (
          <span style={{ 
            color: isDarkMode ? '#10b981' : '#059669',
            fontWeight: 'bold',
            marginRight: '8px'
          }}>
            +
          </span>
        );
      case 'deletion':
        return (
          <span style={{ 
            color: isDarkMode ? '#ef4444' : '#dc2626',
            fontWeight: 'bold',
            marginRight: '8px'
          }}>
            -
          </span>
        );
      default:
        return <span style={{ marginRight: '12px', opacity: 0.5 }}> </span>;
    }
  };

  return (
    <div style={{ 
      margin: '16px 0',
      borderRadius: '6px',
      overflow: 'auto',
      backgroundColor: isDarkMode ? '#2d3748' : '#f6f8fa',
      border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`
    }}>
      <pre style={{
        margin: 0,
        padding: '12px',
        backgroundColor: 'transparent',
        fontSize: '13px',
        lineHeight: '1.5',
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace'
      }}>
        <code style={{ display: 'block' }}>
          {diffLines.map((line, index) => {
            // 确保 content 是字符串
            const contentStr = typeof line.content === 'string' ? line.content : String(line.content || '');
            return (
              <div key={index} style={getLineStyle(line.type)}>
                {getPrefix(line.type)}
                <span>{contentStr || ' '}</span>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
};

export default DiffViewer;

