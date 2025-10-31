import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Search, Edit2, Trash2, X, Plus, Menu } from 'lucide-react';
import { chatAPI } from '@/services/api';
import { ChatSession } from '@/types';

interface ChatHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  currentSessionId: string | null;
  isDarkMode: boolean;
}

const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  isOpen,
  onClose,
  onSessionSelect,
  onNewChat,
  currentSessionId,
  isDarkMode
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 加载会话列表
  const loadSessions = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      setIsLoading(true);
      const response = await chatAPI.getSessionList(pageNum, 20);
      
      if (append) {
        setSessions(prev => [...prev, ...response.data]);
      } else {
        setSessions(response.data);
      }
      
      setHasMore(response.pagination.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('[历史侧边栏] 加载列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 搜索会话
  const searchSessions = useCallback(async (keyword: string, pageNum: number = 1, append: boolean = false) => {
    if (!keyword.trim()) {
      loadSessions(1, false);
      setIsSearching(false);
      return;
    }

    try {
      setIsLoading(true);
      setIsSearching(true);
      const response = await chatAPI.searchSessions(keyword.trim(), pageNum, 20);
      
      if (append) {
        setSessions(prev => [...prev, ...response.data]);
      } else {
        setSessions(response.data);
      }
      
      setHasMore(response.pagination.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('[历史侧边栏] 搜索失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadSessions]);

  // 处理搜索输入（防抖）
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchKeyword(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchSessions(value, 1, false);
    }, 500);
  };

  // 删除会话
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!window.confirm('确定要删除这个对话吗？')) {
      return;
    }

    try {
      await chatAPI.deleteSession(sessionId);
      
      // 从列表中移除
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      // 如果删除的是当前会话，创建新对话
      if (sessionId === currentSessionId) {
        onNewChat();
      }
    } catch (error) {
      console.error('[历史侧边栏] 删除失败:', error);
      alert('删除失败，请重试');
    }
  };

  // 开始编辑标题
  const handleStartEdit = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  // 保存标题
  const handleSaveTitle = async (sessionId: string) => {
    if (!editingTitle.trim()) {
      setEditingSessionId(null);
      return;
    }

    try {
      await chatAPI.updateSessionTitle(sessionId, editingTitle.trim());
      
      // 更新列表中的标题
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, title: editingTitle.trim() } : s
      ));
      
      setEditingSessionId(null);
    } catch (error) {
      console.error('[历史侧边栏] 更新标题失败:', error);
      alert('更新标题失败，请重试');
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  // 滚动加载更多
  const handleScroll = useCallback(() => {
    if (!listRef.current || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    
    // 距离底部小于100px时加载更多
    if (scrollHeight - scrollTop - clientHeight < 100) {
      if (isSearching && searchKeyword) {
        searchSessions(searchKeyword, page + 1, true);
      } else {
        loadSessions(page + 1, true);
      }
    }
  }, [isLoading, hasMore, page, isSearching, searchKeyword, searchSessions, loadSessions]);

  // 初始加载
  useEffect(() => {
    if (isOpen) {
      loadSessions(1, false);
    }
  }, [isOpen, loadSessions]);

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // 今天
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    
    // 昨天
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth()) {
      return '昨天';
    }
    
    // 一周内
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return days[date.getDay()];
    }
    
    // 其他
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  };

  // 样式
  const bgColor = isDarkMode ? '#1f2937' : '#ffffff';
  const surfaceColor = isDarkMode ? '#374151' : '#f9fafb';
  const textColor = isDarkMode ? '#f9fafb' : '#111827';
  const mutedColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const borderColor = isDarkMode ? '#4b5563' : '#e5e7eb';
  const hoverColor = isDarkMode ? '#4b5563' : '#f3f4f6';
  const activeColor = isDarkMode ? '#3b82f6' : '#3b82f6';

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层（移动端） */}
      <div
        className="sidebar-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          display: 'block'
        }}
        onClick={onClose}
      />
      
      {/* 侧边栏 */}
      <div
        className="chat-history-sidebar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '280px',
          backgroundColor: bgColor,
          borderRight: `1px solid ${borderColor}`,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          transition: 'transform 0.3s ease',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)'
        }}
      >
        {/* 头部 */}
        <div style={{
          padding: '16px',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: textColor,
            margin: 0
          }}>
            历史对话
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: mutedColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="关闭"
          >
            <X size={20} />
          </button>
        </div>

        {/* 新建对话按钮 */}
        <div style={{ padding: '12px' }}>
          <button
            onClick={onNewChat}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: activeColor,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <Plus size={18} />
            新建对话
          </button>
        </div>

        {/* 搜索框 */}
        <div style={{ padding: '0 12px 12px 12px' }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                color: mutedColor
              }}
            />
            <input
              type="text"
              placeholder="搜索对话..."
              value={searchKeyword}
              onChange={handleSearchChange}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                border: `1px solid ${borderColor}`,
                borderRadius: '6px',
                backgroundColor: surfaceColor,
                color: textColor,
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* 会话列表 */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 12px'
          }}
        >
          {sessions.length === 0 && !isLoading && (
            <div style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: mutedColor,
              fontSize: '14px'
            }}>
              {searchKeyword ? '没有找到相关对话' : '暂无历史对话'}
            </div>
          )}

          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => {
                onSessionSelect(session.id);
                onClose();
              }}
              style={{
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: session.id === currentSessionId ? activeColor + '20' : 'transparent',
                borderLeft: session.id === currentSessionId ? `3px solid ${activeColor}` : '3px solid transparent',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (session.id !== currentSessionId) {
                  e.currentTarget.style.backgroundColor = hoverColor;
                }
              }}
              onMouseLeave={(e) => {
                if (session.id !== currentSessionId) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {editingSessionId === session.id ? (
                // 编辑模式
                <div onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveTitle(session.id);
                      } else if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '4px',
                      backgroundColor: surfaceColor,
                      color: textColor,
                      fontSize: '14px',
                      outline: 'none',
                      marginBottom: '8px'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleSaveTitle(session.id)}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: activeColor,
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      保存
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: surfaceColor,
                        color: textColor,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                // 显示模式
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginBottom: '4px'
                  }}>
                    <MessageSquare size={16} style={{ color: mutedColor, marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: textColor,
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {session.title}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: mutedColor,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {session.preview}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '8px'
                  }}>
                    <span style={{
                      fontSize: '12px',
                      color: mutedColor
                    }}>
                      {formatTime(session.updatedAt)}
                    </span>
                    
                    <div style={{
                      display: 'flex',
                      gap: '4px',
                      opacity: 0.7
                    }}
                    className="session-actions">
                      <button
                        onClick={(e) => handleStartEdit(session, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          cursor: 'pointer',
                          color: mutedColor,
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '4px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverColor}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="重命名"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          cursor: 'pointer',
                          color: mutedColor,
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '4px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = hoverColor;
                          e.currentTarget.style.color = '#ef4444';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = mutedColor;
                        }}
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}

          {isLoading && (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              color: mutedColor,
              fontSize: '14px'
            }}>
              加载中...
            </div>
          )}
        </div>
      </div>

      {/* CSS样式 */}
      <style>{`
        .session-actions {
          opacity: 0;
          transition: opacity 0.2s;
        }
        
        .chat-history-sidebar > div > div:hover .session-actions {
          opacity: 1 !important;
        }
        
        @media (max-width: 768px) {
          .chat-history-sidebar {
            width: 100vw !important;
          }
          
          .sidebar-overlay {
            display: block !important;
          }
        }
        
        @media (min-width: 769px) {
          .sidebar-overlay {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default ChatHistorySidebar;

