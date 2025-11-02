import React, { Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment } from '@react-three/drei';

interface Model3DViewerProps {
  url: string;
  isDarkMode?: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onError: (error: Error) => void;
  isDarkMode: boolean;
  url: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// 错误边界组件
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[3D模型] 错误边界捕获到错误:', error, errorInfo);
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          padding: '20px',
          textAlign: 'center',
          color: this.props.isDarkMode ? '#ef4444' : '#dc2626'
        }}>
          <div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>
              3D模型加载失败: {this.state.error.message || '未知错误'}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>{this.props.url}</div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 3D 模型组件
const Model: React.FC<{ url: string }> = ({ url }) => {
  const { scene } = useGLTF(url);
  
  return <primitive object={scene} />;
};

// 加载状态组件
const LoadingIndicator: React.FC<{ isDarkMode: boolean; url: string }> = ({ isDarkMode, url }) => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#1e293b' : '#f8f9fa',
      color: isDarkMode ? '#94a3b8' : '#64748b',
    }}
  >
    <div style={{ fontSize: '16px', marginBottom: '8px' }}>加载 3D 模型...</div>
    <div
      style={{
        fontSize: '12px',
        opacity: 0.7,
        wordBreak: 'break-all',
        maxWidth: '80%',
        textAlign: 'center',
      }}
    >
      {url}
    </div>
  </div>
);

const Model3DViewer: React.FC<Model3DViewerProps> = ({ url, isDarkMode = false }) => {
  const handleError = (error: Error) => {
    console.error('[3D模型] 加载失败:', error);
  };

  // 验证 URL
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return (
      <div style={{ 
        margin: '16px 0',
        padding: '12px',
        backgroundColor: isDarkMode ? '#2d1f1f' : '#fee',
        borderRadius: '6px',
        border: `1px solid ${isDarkMode ? '#ef4444' : '#dc2626'}`
      }}>
        <p style={{ 
          margin: 0, 
          color: isDarkMode ? '#ef4444' : '#dc2626',
          fontSize: '14px'
        }}>
          3D模型URL格式无效，必须是有效的HTTP或HTTPS链接
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      margin: '16px 0',
      position: 'relative',
      height: '400px',
      width: '100%',
      backgroundColor: isDarkMode ? '#1e293b' : '#f8f9fa',
      borderRadius: '8px',
      overflow: 'hidden',
      border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`
    }}>
      <ErrorBoundary onError={handleError} isDarkMode={isDarkMode} url={url}>
        <Suspense fallback={<LoadingIndicator isDarkMode={isDarkMode} url={url} />}>
          <Canvas
            camera={{ position: [0, 0, 5], fov: 50 }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <pointLight position={[-10, -10, -5]} intensity={0.5} />
            <Model url={url} />
            <OrbitControls 
              enableZoom={true}
              enablePan={true}
              enableRotate={true}
              minDistance={1}
              maxDistance={50}
            />
            <Environment preset="sunset" />
          </Canvas>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export default Model3DViewer;

