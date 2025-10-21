import React from 'react';
import ChatInterface from './components/ChatInterface';
import SSETest from './components/SSETest';
import SimpleSSETest from './components/SimpleSSETest';
import './App.css';

function App() {
  const [showSSETest, setShowSSETest] = React.useState(false);
  const [showSimpleTest, setShowSimpleTest] = React.useState(false);

  return (
    <div className="App">
      <div style={{ 
        position: 'fixed', 
        top: '10px', 
        right: '10px', 
        zIndex: 1000,
        display: 'flex',
        gap: '10px'
      }}>
        <button
          onClick={() => setShowSSETest(!showSSETest)}
          style={{
            padding: '8px 16px',
            backgroundColor: showSSETest ? '#dc3545' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          {showSSETest ? '隐藏SSE测试' : '显示SSE测试'}
        </button>

        <button
          onClick={() => setShowSimpleTest(!showSimpleTest)}
          style={{
            padding: '8px 16px',
            backgroundColor: showSimpleTest ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          {showSimpleTest ? '隐藏简单测试' : '显示简单测试'}
        </button>
      </div>

      {showSSETest ? (
        <SSETest />
      ) : showSimpleTest ? (
        <SimpleSSETest />
      ) : (
        <ChatInterface />
      )}
    </div>
  );
}

export default App;
