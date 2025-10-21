import React, { useState } from 'react';

const SimpleSSETest: React.FC = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const testSSE = async () => {
    setIsLoading(true);
    setMessages([]);
    
    try {
      const response = await fetch('/api/test-sse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      setMessages(prev => [...prev, '🚀 开始接收SSE数据...']);

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          setMessages(prev => [...prev, '✅ 流式响应完成']);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        setMessages(prev => [...prev, `📦 收到数据块: ${value.length} 字节`]);
        
        // 处理SSE事件
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            setMessages(prev => [...prev, `📝 处理行: ${line}`]);
            
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.slice(6));
                setMessages(prev => [...prev, `🎯 解析事件: ${JSON.stringify(eventData)}`]);
                
                if (eventData.type === 'content') {
                  setMessages(prev => [...prev, `💬 内容: ${eventData.content}`]);
                } else if (eventData.type === 'done') {
                  setMessages(prev => [...prev, '🏁 收到完成事件']);
                }
              } catch (parseError) {
                setMessages(prev => [...prev, `❌ 解析失败: ${parseError}`]);
              }
            }
          }
        }
      }

      reader.releaseLock();
    } catch (error) {
      setMessages(prev => [...prev, `❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>简单SSE测试</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={testSSE}
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            backgroundColor: isLoading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          {isLoading ? '测试中...' : '开始测试'}
        </button>

        <button
          onClick={clearMessages}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          清空消息
        </button>
      </div>

      <div style={{
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '10px',
        height: '400px',
        overflowY: 'auto',
        backgroundColor: '#f8f9fa',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        <h3>消息日志:</h3>
        {messages.length === 0 ? (
          <p style={{ color: '#6c757d', fontStyle: 'italic' }}>暂无消息</p>
        ) : (
          <div>
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  padding: '2px 0',
                  borderBottom: index < messages.length - 1 ? '1px solid #eee' : 'none'
                }}
              >
                {message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleSSETest;
