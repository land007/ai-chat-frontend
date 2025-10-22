import React, { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import AudioQueuePlayerTest from './components/AudioQueuePlayerTest';
import StreamSegmentationTest from './components/StreamSegmentationTest';
import './App.css';

type Page = 'chat' | 'audio' | 'stream-segment';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('stream-segment');

  const buttonStyle = (page: Page) => ({
    padding: '8px 16px',
    backgroundColor: currentPage === page ? '#3b82f6' : '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '8px',
    fontSize: '14px',
    transition: 'all 0.2s'
  });

  return (
    <div className="App">
      <div style={{ 
        padding: '12px 20px', 
        backgroundColor: '#f9fafb', 
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '14px', fontWeight: '600', marginRight: '12px' }}>
          测试导航:
        </span>
        <button 
          onClick={() => setCurrentPage('chat')}
          style={buttonStyle('chat')}
        >
          💬 聊天界面
        </button>
        <button 
          onClick={() => setCurrentPage('stream-segment')}
          style={buttonStyle('stream-segment')}
        >
          🔄 流式分段测试
        </button>
        <button 
          onClick={() => setCurrentPage('audio')}
          style={buttonStyle('audio')}
        >
          🎵 音频队列测试
        </button>
      </div>
      
      {currentPage === 'chat' && <ChatInterface />}
      {currentPage === 'audio' && <AudioQueuePlayerTest />}
      {currentPage === 'stream-segment' && <StreamSegmentationTest />}
    </div>
  );
}

export default App;
