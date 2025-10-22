// 企业微信认证服务
export interface User {
  userId: string;
  name: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

class AuthService {
  private readonly TOKEN_KEY = 'wework_auth_token';
  private readonly apiBaseUrl = '/api/auth';

  /**
   * 获取企业微信授权URL
   */
  async getAuthUrl(): Promise<string> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/wework/redirect`);
      
      if (!response.ok) {
        throw new Error('获取授权URL失败');
      }

      const data = await response.json();
      return data.redirectUrl;
    } catch (error) {
      console.error('[认证服务] 获取授权URL失败:', error);
      throw error;
    }
  }

  /**
   * 通过code换取token
   */
  async authenticate(code: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/wework/callback?code=${code}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '认证失败');
      }

      const data: AuthResponse = await response.json();
      
      // 保存token到localStorage
      this.setToken(data.token);
      
      return data;
    } catch (error) {
      console.error('[认证服务] 认证失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前登录用户信息
   */
  async getUserInfo(): Promise<User> {
    try {
      const token = this.getToken();
      
      if (!token) {
        throw new Error('未登录');
      }

      const response = await fetch(`${this.apiBaseUrl}/userinfo`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // token可能已过期
        this.removeToken();
        throw new Error('获取用户信息失败');
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error('[认证服务] 获取用户信息失败:', error);
      throw error;
    }
  }

  /**
   * 退出登录
   */
  async logout(): Promise<void> {
    try {
      const token = this.getToken();
      
      if (token) {
        await fetch(`${this.apiBaseUrl}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
      
      this.removeToken();
    } catch (error) {
      console.error('[认证服务] 退出登录失败:', error);
      // 即使退出失败也要清除本地token
      this.removeToken();
    }
  }

  /**
   * 保存token
   */
  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /**
   * 获取token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * 删除token
   */
  removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  /**
   * 检查是否已登录
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const authService = new AuthService();

