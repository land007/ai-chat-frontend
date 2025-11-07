import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ChatInterface from './components/ChatInterface';
import Login from './components/Login';
import { Loader2 } from 'lucide-react';
import './App.css';

// 懒加载测试页面组件
const AudioQueuePlayerTest = lazy(() => import('./components/AudioQueuePlayerTest'));
const StreamSegmentationTest = lazy(() => import('./components/StreamSegmentationTest'));
const TTSIntegrationTest = lazy(() => import('./components/TTSIntegrationTest'));
const TypewriterCodeTest = lazy(() => import('./components/TypewriterCodeTest'));
const FeedbackAdmin = lazy(() => import('./components/FeedbackAdmin'));
const WaveformPreview = lazy(() => import('./components/WaveformPreview'));

type Page = 'chat' | 'audio' | 'stream-segment' | 'tts' | 'feedback' | 'typewriter-code' | 'waveform-preview';

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('chat');
  const [debugMode, setDebugMode] = useState(false);
  const [adminUsers, setAdminUsers] = useState<string[]>(['admin']);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // 自动检测系统主题偏好
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  // 检查是否是管理员
  const isAdmin = user?.userId && adminUsers.includes(user.userId);

  // 获取调试模式配置
  useEffect(() => {
    const fetchDebugConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const config = await response.json();
          setDebugMode(config.enableDebugMode === true);
          // 设置管理员列表
          if (config.adminUsers && Array.isArray(config.adminUsers)) {
            setAdminUsers(config.adminUsers);
          }
          // 如果启用调试模式，默认显示测试页面
          if (config.enableDebugMode === true) {
            setCurrentPage('typewriter-code');
          }
        }
      } catch (error) {
        console.log('使用默认调试配置');
      }
    };
    fetchDebugConfig();
  }, []);

  // 显示加载状态
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f9fafb',
        gap: '16px'
      }}>
        <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
        <p style={{ color: '#6b7280', fontSize: '16px' }}>加载中...</p>
        <style>
          {`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  // 未认证则显示登录页面
  if (!isAuthenticated) {
    return <Login />;
  }

  // 已认证则显示主应用

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
      {debugMode && currentPage !== 'chat' && (
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
            onClick={() => setCurrentPage('typewriter-code')}
            style={buttonStyle('typewriter-code')}
          >
            📝 打字机代码测试
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
          <button 
            onClick={() => setCurrentPage('tts')}
            style={buttonStyle('tts')}
          >
            🎙️ TTS集成测试
          </button>
          {isAdmin && (
            <button 
              onClick={() => setCurrentPage('feedback')}
              style={buttonStyle('feedback')}
            >
              📊 反馈管理
            </button>
          )}
          <button 
            onClick={() => setCurrentPage('waveform-preview')}
            style={buttonStyle('waveform-preview')}
          >
            📊 波形预览
          </button>
        </div>
      )}
      
      {currentPage === 'chat' && <ChatInterface />}
      {currentPage === 'audio' && (
        <Suspense fallback={
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '16px'
          }}>
            <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
            <p style={{ color: '#6b7280', fontSize: '16px' }}>加载音频队列测试...</p>
          </div>
        }>
          <AudioQueuePlayerTest />
        </Suspense>
      )}
      {currentPage === 'stream-segment' && (
        <Suspense fallback={
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '16px'
          }}>
            <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
            <p style={{ color: '#6b7280', fontSize: '16px' }}>加载流式分段测试...</p>
          </div>
        }>
          <StreamSegmentationTest />
        </Suspense>
      )}
      {currentPage === 'tts' && (
        <Suspense fallback={
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '16px'
          }}>
            <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
            <p style={{ color: '#6b7280', fontSize: '16px' }}>加载TTS集成测试...</p>
          </div>
        }>
          <TTSIntegrationTest />
        </Suspense>
      )}
      {currentPage === 'typewriter-code' && (
        <Suspense fallback={
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '16px'
          }}>
            <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
            <p style={{ color: '#6b7280', fontSize: '16px' }}>加载打字机代码测试...</p>
          </div>
        }>
          <TypewriterCodeTest />
        </Suspense>
      )}
      {currentPage === 'feedback' && isAdmin && (
        <Suspense fallback={
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '16px'
          }}>
            <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
            <p style={{ color: '#6b7280', fontSize: '16px' }}>加载反馈管理...</p>
          </div>
        }>
          <div style={{ height: '100vh', overflow: 'hidden' }}>
            <FeedbackAdmin isDarkMode={isDarkMode} onClose={() => setCurrentPage('chat')} />
          </div>
        </Suspense>
      )}
      {currentPage === 'waveform-preview' && (
        <Suspense fallback={
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '16px'
          }}>
            <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
            <p style={{ color: '#6b7280', fontSize: '16px' }}>加载波形预览...</p>
          </div>
        }>
          <div style={{
            height: debugMode ? 'calc(100vh - 52px)' : '100vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch'
          }}>
            <WaveformPreview 
              isDarkMode={isDarkMode}
              onSelectStyle={(style) => {
                console.log('选择的波形样式:', style);
              }}
            />
          </div>
        </Suspense>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
