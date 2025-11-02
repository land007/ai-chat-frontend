import React from 'react';
import { Check, Square } from 'lucide-react';

interface ChecklistItemProps {
  checked: boolean;
  children: React.ReactNode;
  isDarkMode?: boolean;
}

const ChecklistItem: React.FC<ChecklistItemProps> = ({ 
  checked, 
  children, 
  isDarkMode = false 
}) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      padding: '6px 0',
      lineHeight: '1.5',
      minHeight: '24px'
    }}>
      {/* 自定义复选框 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          minWidth: '20px',
          minHeight: '20px',
          borderRadius: '4px',
          border: `2px solid ${isDarkMode 
            ? (checked ? '#10b981' : '#6b7280') 
            : (checked ? '#059669' : '#d1d5db')}`,
          backgroundColor: checked 
            ? (isDarkMode ? '#064e3b' : '#d1fae5')
            : 'transparent',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          flexShrink: 0,
          marginTop: '2px'
        }}
      >
        {checked && (
          <Check 
            size={14} 
            style={{ 
              color: isDarkMode ? '#10b981' : '#059669',
              strokeWidth: 3
            }} 
          />
        )}
      </div>
      
      {/* 任务文本 */}
      <div
        style={{
          flex: 1,
          color: checked 
            ? (isDarkMode ? '#9ca3af' : '#6b7280')
            : (isDarkMode ? '#e5e7eb' : '#111827'),
          textDecoration: checked ? 'line-through' : 'none',
          opacity: checked ? 0.7 : 1,
          transition: 'all 0.2s ease'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ChecklistItem;

