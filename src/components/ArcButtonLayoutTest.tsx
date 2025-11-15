import React, { useState } from 'react';
import { X, Edit2, Mic } from 'lucide-react';
import ArcButtonLayout from './ArcButtonLayout';
import { ArcButtonConfig } from '@/types';

const ArcButtonLayoutTest: React.FC = () => {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  // 配置左侧按钮（取消）
  const leftButton: ArcButtonConfig = {
    text: '取消',
    icon: <X />,
    startAngle: -45,
    endAngle: -10,
    color: {
      normal: 'rgba(239, 68, 68, 0.08)',
      highlighted: 'rgba(239, 68, 68, 0.25)',
      border: 'rgba(239, 68, 68, 0.25)',
      borderHighlighted: '#ef4444',
    },
  };

  // 配置右侧按钮（编辑）
  const rightButton: ArcButtonConfig = {
    text: '编辑',
    icon: <Edit2 />,
    startAngle: 10,
    endAngle: 45,
    color: {
      normal: 'rgba(59, 130, 246, 0.08)',
      highlighted: 'rgba(59, 130, 246, 0.25)',
      border: 'rgba(59, 130, 246, 0.25)',
      borderHighlighted: '#3b82f6',
    },
  };

  // 处理回调函数
  const handleCancel = () => {
    setSelectedAction('取消');
    console.log('取消操作');
    setTimeout(() => {
      setSelectedAction(null);
    }, 100);
  };

  const handleEdit = () => {
    setSelectedAction('编辑');
    console.log('编辑操作');
    setTimeout(() => {
      setSelectedAction(null);
    }, 100);
  };

  const handleSend = () => {
    setSelectedAction('松开发送');
    console.log('发送操作');
    setTimeout(() => {
      setSelectedAction(null);
    }, 100);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        position: 'relative',
        backgroundColor: '#f9fafb',
        overflow: 'hidden',
      }}
    >
      <ArcButtonLayout
        onCancel={handleCancel}
        onEdit={handleEdit}
        onSend={handleSend}
        leftButton={leftButton}
        rightButton={rightButton}
        centerButton={{
          text: '松开发送',
          color: {
            normal: '#64748b',
            highlighted: '#2563eb',
          },
        }}
        initialButton={{
          show: true,
          text: '点击说话',
          icon: <Mic size={20} />,
          position: {
            bottom: 80,
          },
        }}
        debug={true}
        containerStyle={{
          width: '100%',
          height: '100vh',
        }}
      />

      {/* 操作结果显示（可选） */}
      {selectedAction && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '20px 40px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: '600',
            zIndex: 2000,
            pointerEvents: 'none',
            transition: 'opacity 0.3s ease',
          }}
        >
          {selectedAction}
        </div>
      )}
    </div>
  );
};

export default ArcButtonLayoutTest;