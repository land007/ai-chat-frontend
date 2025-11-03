import React from 'react';
import { Folder, File, FolderOpen } from 'lucide-react';

interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  level: number;
}

interface TreeViewerProps {
  code: string; // 原始文件树代码字符串
  isDarkMode?: boolean;
}

const TreeViewer: React.FC<TreeViewerProps> = ({ code, isDarkMode = false }) => {
  // 解析文件树代码，识别层级结构
  const parseTree = (treeCode: string): TreeNode[] => {
    if (!treeCode || !treeCode.trim()) {
      return [];
    }

    const lines = treeCode.split('\n').filter(line => line.trim());
    const result: TreeNode[] = [];
    
    // 用于跟踪每个级别的最后一个节点
    const levelNodes: TreeNode[] = [];
    
    lines.forEach((line) => {
      // 计算缩进级别（支持空格和制表符）
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      // 计算前置空格/制表符的数量
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      // 将制表符转换为 2 个空格来计算级别
      const indentLevel = Math.floor(indent.replace(/\t/g, '  ').length / 2);
      
      // 判断是文件还是文件夹（以 / 或 \ 结尾的是文件夹）
      const isFolder = trimmedLine.endsWith('/') || trimmedLine.endsWith('\\');
      const cleanName = isFolder ? trimmedLine.slice(0, -1) : trimmedLine;
      
      const node: TreeNode = {
        name: cleanName,
        type: isFolder ? 'folder' : 'file',
        level: indentLevel,
        children: isFolder ? [] : undefined
      };
      
      // 找到正确的父节点（缩进级别小于当前节点的最后一个节点）
      if (indentLevel === 0) {
        // 根级别节点
        result.push(node);
      } else {
        // 找到上一级节点作为父节点
        let parent: TreeNode | null = null;
        for (let i = indentLevel - 1; i >= 0; i--) {
          if (levelNodes[i]) {
            parent = levelNodes[i];
            break;
          }
        }
        
        if (parent && parent.children) {
          parent.children.push(node);
        } else {
          // 如果没有找到父节点，作为根节点处理
          result.push(node);
        }
      }
      
      // 更新当前级别的节点
      levelNodes[indentLevel] = node;
      
      // 清除更深级别的节点（因为我们已经到了新的分支）
      for (let i = indentLevel + 1; i < levelNodes.length; i++) {
        delete levelNodes[i];
      }
    });
    
    return result;
  };

  const treeNodes = parseTree(code);

  // 渲染单个树节点
  const renderNode = (node: TreeNode, isOpen: boolean = true): React.ReactNode => {
    const Icon = node.type === 'folder' 
      ? (isOpen ? FolderOpen : Folder)
      : File;
    
    const iconSize = 16;
    const iconColor = isDarkMode 
      ? (node.type === 'folder' ? '#60a5fa' : '#94a3b8')
      : (node.type === 'folder' ? '#3b82f6' : '#6b7280');

    return (
      <div key={`${node.name}-${node.level}`} style={{ marginLeft: `${node.level * 20}px` }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 0',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
          fontSize: '13px',
          lineHeight: '1.5',
          color: isDarkMode ? '#e5e7eb' : '#111827'
        }}>
          <Icon size={iconSize} style={{ flexShrink: 0, color: iconColor }} />
          <span>{node.name}</span>
        </div>
        {node.children && node.children.length > 0 && isOpen && (
          <div>
            {node.children.map(child => renderNode(child, isOpen))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      padding: '12px 16px',
      backgroundColor: isDarkMode ? '#2d3748' : '#f6f8fa',
      borderRadius: '6px',
      overflowX: 'auto',
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace'
    }}>
      {treeNodes.length > 0 ? (
        treeNodes.map(node => renderNode(node))
      ) : (
        <div style={{
          color: isDarkMode ? '#9ca3af' : '#6b7280',
          fontStyle: 'italic',
          fontSize: '13px'
        }}>
          空文件树
        </div>
      )}
    </div>
  );
};

export default TreeViewer;

