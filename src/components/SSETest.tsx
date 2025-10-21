import React, { useState, useRef } from 'react';
import { createSSEForwarder, SSEForwarder } from '../utils/sseForwarder';

interface SSETestProps {
  className?: string;
}

const SSETest: React.FC<SSETestProps> = ({ className = '' }) => {
  const [messages, setMessages] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('你好，请介绍一下你自己');
  
  const forwarderRef = useRef<SSEForwarder | null>(null);

  const handleStartTest = async () => {
    try {
      setError(null);
      setMessages([]);
      
      const forwarder = createSSEForwarder({
        targetUrl: '/api/chat/stream',
        timeout: 30000,
        retryCount: 3,
        retryDelay: 1000
      });

      forwarder.setCallbacks({
        onStart: () => {
          console.log('[SSETest] 开始转发');
          setIsConnected(true);
          setMessages(prev => [...prev, '🚀 开始转发SSE消息...']);
        },
        onData: (data: string) => {
          console.log('[SSETest] 收到数据:', data);
          try {
            const event = JSON.parse(data);
            if (event.type === 'content') {
              setMessages(prev => [...prev, `📝 内容: ${event.content}`]);
            } else if (event.type === 'done') {
              setMessages(prev => [...prev, '✅ 转发完成']);
            } else if (event.type === 'error') {
              setMessages(prev => [...prev, `❌ 错误: ${event.error}`]);
            } else {
              setMessages(prev => [...prev, `📨 ${event.type}: ${JSON.stringify(event)}`]);
            }
          } catch (parseError) {
            setMessages(prev => [...prev, `📨 原始数据: ${data}`]);
          }
        },
        onComplete: () => {
          console.log('[SSETest] 转发完成');
          setIsConnected(false);
          setMessages(prev => [...prev, '🎉 转发完成']);
        },
        onError: (error: Error) => {
          console.error('[SSETest] 转发错误:', error);
          setIsConnected(false);
          setError(error.message);
          setMessages(prev => [...prev, `❌ 错误: ${error.message}`]);
        },
        onConnectionChange: (connected: boolean) => {
          console.log('[SSETest] 连接状态变化:', connected);
          setIsConnected(connected);
        }
      });

      forwarderRef.current = forwarder;
      
      await forwarder.forwardSSE({
        message: testMessage,
        contextMessages: []
      });

    } catch (error) {
      console.error('[SSETest] 测试失败:', error);
      setError(error instanceof Error ? error.message : '测试失败');
    }
  };

  const handleStopTest = () => {
    if (forwarderRef.current) {
      forwarderRef.current.stop();
      forwarderRef.current = null;
    }
    setIsConnected(false);
    setMessages(prev => [...prev, '⏹️ 测试已停止']);
  };

  const clearMessages = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className={className} style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>SSE消息转发测试</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px' }}>
          测试消息:
        </label>
        <textarea
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          style={{
            width: '100%',
            height: '80px',
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={handleStartTest}
          disabled={isConnected}
          style={{
            padding: '10px 20px',
            backgroundColor: isConnected ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isConnected ? 'not-allowed' : 'pointer'
          }}
        >
          {isConnected ? '测试中...' : '开始测试'}
        </button>

        <button
          onClick={handleStopTest}
          disabled={!isConnected}
          style={{
            padding: '10px 20px',
            backgroundColor: !isConnected ? '#ccc' : '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !isConnected ? 'not-allowed' : 'pointer'
          }}
        >
          停止测试
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

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <strong>错误:</strong> {error}
        </div>
      )}

      <div style={{
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '10px',
        height: '400px',
        overflowY: 'auto',
        backgroundColor: '#f8f9fa'
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
                  padding: '4px 0',
                  borderBottom: index < messages.length - 1 ? '1px solid #eee' : 'none',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              >
                {message}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#6c757d' }}>
        <p><strong>测试说明:</strong></p>
        <ul>
          <li>此测试页面用于验证SSE消息转发功能</li>
          <li>点击"开始测试"发送消息到后端SSE接口</li>
          <li>观察消息日志，确认所有消息都被正确转发</li>
          <li>如果只收到第一个消息就结束，说明存在转发问题</li>
        </ul>
      </div>
    </div>
  );
};

export default SSETest;
