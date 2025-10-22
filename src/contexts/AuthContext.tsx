import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '@/services/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  handleAuthCallback: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化时检查是否已登录
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          const userInfo = await authService.getUserInfo();
          setUser(userInfo);
          console.log('[认证上下文] 用户已登录:', userInfo.name);
        }
      } catch (error) {
        console.error('[认证上下文] 初始化失败:', error);
        // 如果获取用户信息失败，清除token
        authService.removeToken();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // 发起登录（跳转到企业微信授权页面）
  const login = async () => {
    try {
      console.log('[认证上下文] 发起登录');
      const authUrl = await authService.getAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('[认证上下文] 登录失败:', error);
      alert('登录失败，请稍后重试');
    }
  };

  // 处理授权回调
  const handleAuthCallback = async (code: string) => {
    try {
      console.log('[认证上下文] 处理授权回调');
      setIsLoading(true);
      const authResponse = await authService.authenticate(code);
      setUser(authResponse.user);
      console.log('[认证上下文] 登录成功:', authResponse.user.name);
    } catch (error) {
      console.error('[认证上下文] 授权回调处理失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 退出登录
  const logout = async () => {
    try {
      console.log('[认证上下文] 退出登录');
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('[认证上下文] 退出登录失败:', error);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    handleAuthCallback
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook for using auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

