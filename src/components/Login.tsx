import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const { login, handleAuthCallback, isLoading } = useAuth();
  const [error, setError] = useState<string>('');

  // 检查URL中是否有授权回调的code参数
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      console.log('[登录组件] 检测到授权回调code');
      handleAuthCallback(code)
        .then(() => {
          // 清除URL中的code参数
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => {
          console.error('[登录组件] 授权回调失败:', err);
          setError('登录失败，请重试');
          // 清除URL中的code参数
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, [handleAuthCallback]);

  const handleLogin = () => {
    setError('');
    login();
  };

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f9fafb',
      padding: '24px'
    },
    card: {
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '48px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      maxWidth: '400px',
      width: '100%',
      textAlign: 'center' as const
    },
    icon: {
      width: '64px',
      height: '64px',
      backgroundColor: '#3b82f6',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 24px',
      color: 'white'
    },
    title: {
      fontSize: '24px',
      fontWeight: '600',
      color: '#111827',
      marginBottom: '12px'
    },
    description: {
      fontSize: '14px',
      color: '#6b7280',
      marginBottom: '32px',
      lineHeight: '1.5'
    },
    button: {
      width: '100%',
      padding: '12px 24px',
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontSize: '16px',
      fontWeight: '500',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      transition: 'background-color 0.2s'
    },
    buttonHover: {
      backgroundColor: '#2563eb'
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    error: {
      marginTop: '16px',
      padding: '12px',
      backgroundColor: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      color: '#dc2626',
      fontSize: '14px'
    },
    loader: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: '12px',
      color: '#6b7280'
    }
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loader}>
            <Loader2 size={48} style={{ animation: 'spin 1s linear infinite' }} />
            <p>正在验证身份...</p>
          </div>
        </div>
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

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>
          <LogIn size={32} />
        </div>
        <h1 style={styles.title}>企业微信登录</h1>
        <p style={styles.description}>
          请使用企业微信账号登录以访问AI智能助手
        </p>
        <button
          onClick={handleLogin}
          disabled={isLoading}
          style={{
            ...styles.button,
            ...(isLoading ? styles.buttonDisabled : {})
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#2563eb';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#3b82f6';
            }
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              登录中...
            </>
          ) : (
            <>
              <LogIn size={20} />
              使用企业微信登录
            </>
          )}
        </button>
        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;

