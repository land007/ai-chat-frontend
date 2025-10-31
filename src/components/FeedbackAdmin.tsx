import React, { useState, useEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, X, User, Bot, ChevronDown } from 'lucide-react';
import { chatAPI } from '@/services/api';
import { FeedbackListItem, FeedbackData } from '@/types';

interface FeedbackAdminProps {
  isDarkMode: boolean;
  onClose: () => void;
}

const FeedbackAdmin: React.FC<FeedbackAdminProps> = ({ isDarkMode, onClose }) => {
  const [feedbackList, setFeedbackList] = useState<FeedbackListItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'like' | 'dislike'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackData | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 动态样式
  const getStyles = () => {
    const bgColor = isDarkMode ? '#1f2937' : '#f9fafb';
    const surfaceColor = isDarkMode ? '#374151' : 'white';
    const textColor = isDarkMode ? '#f9fafb' : '#111827';
    const borderColor = isDarkMode ? '#4b5563' : '#e5e7eb';
    const mutedColor = isDarkMode ? '#9ca3af' : '#6b7280';

    return {
      overlay: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      },
      container: {
        backgroundColor: surfaceColor,
        borderRadius: '16px',
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      },
      header: {
        padding: '20px 24px',
        borderBottom: `1px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      },
      title: {
        fontSize: '20px',
        fontWeight: '600',
        color: textColor,
        margin: 0
      },
      closeButton: {
        background: 'none',
        border: 'none',
        padding: '8px',
        borderRadius: '8px',
        cursor: 'pointer',
        color: mutedColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s'
      },
      filterBar: {
        padding: '16px 24px',
        borderBottom: `1px solid ${borderColor}`,
        display: 'flex',
        gap: '12px'
      },
      filterButton: {
        padding: '8px 16px',
        borderRadius: '8px',
        border: `1px solid ${borderColor}`,
        backgroundColor: surfaceColor,
        color: textColor,
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      },
      filterButtonActive: {
        backgroundColor: '#3b82f6',
        color: 'white',
        borderColor: '#3b82f6'
      },
      listContainer: {
        flex: 1,
        overflowY: 'auto' as const,
        padding: '16px 24px'
      },
      listItem: {
        padding: '16px',
        marginBottom: '12px',
        borderRadius: '12px',
        border: `1px solid ${borderColor}`,
        backgroundColor: surfaceColor,
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      },
      listItemHover: {
        borderColor: '#3b82f6',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1)'
      },
      feedbackIcon: {
        flexShrink: 0,
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      },
      feedbackIconLike: {
        backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
        color: isDarkMode ? '#10b981' : '#059669'
      },
      feedbackIconDislike: {
        backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
        color: isDarkMode ? '#ef4444' : '#dc2626'
      },
      listItemContent: {
        flex: 1,
        minWidth: 0
      },
      listItemTitle: {
        fontSize: '14px',
        fontWeight: '600',
        color: textColor,
        marginBottom: '4px'
      },
      listItemMeta: {
        fontSize: '12px',
        color: mutedColor,
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap' as const
      },
      loadingText: {
        textAlign: 'center' as const,
        padding: '20px',
        color: mutedColor
      },
      emptyText: {
        textAlign: 'center' as const,
        padding: '60px 20px',
        color: mutedColor
      },
      modalOverlay: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '20px'
      },
      modalContent: {
        backgroundColor: surfaceColor,
        borderRadius: '16px',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden'
      },
      modalHeader: {
        padding: '20px 24px',
        borderBottom: `1px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      },
      modalBody: {
        flex: 1,
        overflowY: 'auto' as const,
        padding: '24px'
      },
      messageContainer: {
        marginBottom: '16px'
      },
      messageHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '8px'
      },
      avatar: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      },
      avatarUser: {
        backgroundColor: '#3b82f6',
        color: 'white'
      },
      avatarBot: {
        backgroundColor: isDarkMode ? '#4b5563' : '#e5e7eb',
        color: isDarkMode ? '#f9fafb' : '#6b7280'
      },
      messageBubble: {
        padding: '12px 16px',
        borderRadius: '12px',
        backgroundColor: isDarkMode ? '#2d3748' : '#f3f4f6',
        border: `1px solid ${borderColor}`,
        whiteSpace: 'pre-wrap' as const,
        color: textColor,
        fontSize: '14px',
        lineHeight: '1.6'
      },
      messageBubbleUser: {
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none'
      }
    };
  };

  const styles = getStyles();

  // 加载反馈列表
  const loadFeedbackList = async (reset: boolean = false) => {
    if (isLoading || (!hasMore && !reset)) return;

    setIsLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const response = await chatAPI.getFeedbackList(currentPage, 20, filter);
      
      if (reset) {
        setFeedbackList(response.data);
        setPage(1);
      } else {
        setFeedbackList(prev => [...prev, ...response.data]);
      }
      
      setHasMore(response.pagination.hasMore);
      setPage(currentPage + 1);
    } catch (error) {
      console.error('[管理员面板] 加载反馈列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 初始加载和筛选变化时重新加载
  useEffect(() => {
    setFeedbackList([]);
    setPage(1);
    setHasMore(true);
    loadFeedbackList(true);
  }, [filter]);

  // 滚动到底部时加载更多
  const handleScroll = () => {
    if (!listRef.current || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadFeedbackList();
    }
  };

  useEffect(() => {
    const listElement = listRef.current;
    if (listElement) {
      listElement.addEventListener('scroll', handleScroll);
      return () => listElement.removeEventListener('scroll', handleScroll);
    }
  }, [isLoading, hasMore, page]);

  // 查看详情
  const handleViewDetail = async (filename: string) => {
    try {
      const response = await chatAPI.getFeedbackDetail(filename);
      setSelectedFeedback(response.data);
    } catch (error) {
      console.error('[管理员面板] 加载反馈详情失败:', error);
    }
  };

  // 格式化时间
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <>
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.container} onClick={(e) => e.stopPropagation()}>
          {/* 头部 */}
          <div style={styles.header}>
            <h2 style={styles.title}>用户反馈管理</h2>
            <button
              style={styles.closeButton}
              onClick={onClose}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* 筛选栏 */}
          <div style={styles.filterBar}>
            <button
              style={{
                ...styles.filterButton,
                ...(filter === 'all' ? styles.filterButtonActive : {})
              }}
              onClick={() => setFilter('all')}
            >
              全部
            </button>
            <button
              style={{
                ...styles.filterButton,
                ...(filter === 'like' ? styles.filterButtonActive : {})
              }}
              onClick={() => setFilter('like')}
            >
              <ThumbsUp size={14} />
              点赞
            </button>
            <button
              style={{
                ...styles.filterButton,
                ...(filter === 'dislike' ? styles.filterButtonActive : {})
              }}
              onClick={() => setFilter('dislike')}
            >
              <ThumbsDown size={14} />
              点踩
            </button>
          </div>

          {/* 列表 */}
          <div ref={listRef} style={styles.listContainer}>
            {feedbackList.length === 0 && !isLoading ? (
              <div style={styles.emptyText}>暂无反馈数据</div>
            ) : (
              feedbackList.map((item) => (
                <div
                  key={item.filename}
                  style={styles.listItem}
                  onClick={() => handleViewDetail(item.filename)}
                  onMouseEnter={(e) => {
                    Object.assign(e.currentTarget.style, styles.listItemHover);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isDarkMode ? '#4b5563' : '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div
                    style={{
                      ...styles.feedbackIcon,
                      ...(item.type === 'like'
                        ? styles.feedbackIconLike
                        : styles.feedbackIconDislike)
                    }}
                  >
                    {item.type === 'like' ? (
                      <ThumbsUp size={20} />
                    ) : (
                      <ThumbsDown size={20} />
                    )}
                  </div>
                  <div style={styles.listItemContent}>
                    <div style={styles.listItemTitle}>{item.filename}</div>
                    <div style={styles.listItemMeta}>
                      <span>用户: {item.username}</span>
                      <span>消息数: {item.messageCount}</span>
                      <span>{formatDate(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
            {isLoading && <div style={styles.loadingText}>加载中...</div>}
            {!hasMore && feedbackList.length > 0 && (
              <div style={styles.loadingText}>没有更多了</div>
            )}
          </div>
        </div>
      </div>

      {/* 详情模态框 */}
      {selectedFeedback && (
        <div style={styles.modalOverlay} onClick={() => setSelectedFeedback(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.title}>对话详情</h3>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                  {formatDate(selectedFeedback.timestamp)} · {selectedFeedback.username}
                </div>
              </div>
              <button
                style={styles.closeButton}
                onClick={() => setSelectedFeedback(null)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#4b5563' : '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              {selectedFeedback.messages.map((message, index) => (
                <div key={index} style={styles.messageContainer}>
                  <div style={styles.messageHeader}>
                    <div
                      style={{
                        ...styles.avatar,
                        ...(message.role === 'user'
                          ? styles.avatarUser
                          : styles.avatarBot)
                      }}
                    >
                      {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>
                      {message.role === 'user' ? '用户' : 'AI助手'}
                    </span>
                  </div>
                  <div
                    style={{
                      ...styles.messageBubble,
                      ...(message.role === 'user' ? styles.messageBubbleUser : {})
                    }}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackAdmin;

