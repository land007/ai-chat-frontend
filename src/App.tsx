import React, { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import AudioQueuePlayerTest from './components/AudioQueuePlayerTest';
import './App.css';

function App() {
  const [showTest, setShowTest] = useState(true); // 默认显示测试页面

  return (
    <div className="App">
      <div style={{ padding: '10px', backgroundColor: '#f0f0f0', borderBottom: '1px solid #ccc' }}>
        <button 
          onClick={() => setShowTest(!showTest)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showTest ? '切换到聊天界面' : '切换到音频测试'}
        </button>
      </div>
      
      {showTest ? <AudioQueuePlayerTest /> : <ChatInterface />}
    </div>
  );
}

export default App;
