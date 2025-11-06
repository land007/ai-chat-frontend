#!/usr/bin/env node
/**
 * postinstall脚本：复制pdfjs-dist文件到public目录
 * 用于Docker构建和本地开发
 */

const fs = require('fs');
const path = require('path');

// 检查是否在生产环境（只安装生产依赖时，pdfjs-dist可能不存在）
const isProductionOnly = process.env.NODE_ENV === 'production' && !fs.existsSync('node_modules/pdfjs-dist');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`[postinstall] Source directory does not exist: ${src}, skipping...`);
    return;
  }
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const files = fs.readdirSync(src);
  files.forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`[postinstall] Copied: ${file}`);
    }
  });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`[postinstall] Source file does not exist: ${src}, skipping...`);
    return false;
  }
  
  // 确保目标目录存在
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  fs.copyFileSync(src, dest);
  console.log(`[postinstall] Copied: ${path.basename(src)} -> ${dest}`);
  return true;
}

// 主逻辑
console.log('[postinstall] Starting pdfjs-dist file copy...');

// 如果只安装生产依赖且pdfjs-dist不存在，跳过复制（文件应该已经在构建阶段复制）
if (isProductionOnly) {
  console.log('[postinstall] Production-only mode: pdfjs-dist not installed, skipping copy (files should already be in public directory)');
  process.exit(0);
}

// 确保public目录存在
if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
  console.log('[postinstall] Created public directory');
}

// 复制pdf.worker.min.mjs
const workerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
if (copyFile(workerSrc, 'public/pdf.worker.min.mjs')) {
  console.log('[postinstall] ✓ pdf.worker.min.mjs copied');
} else {
  console.log('[postinstall] ⚠ pdf.worker.min.mjs not found, this is OK if pdfjs-dist is not installed');
}

// 复制cmaps目录
copyDir('node_modules/pdfjs-dist/cmaps', 'public/cmaps');
if (fs.existsSync('public/cmaps')) {
  console.log('[postinstall] ✓ cmaps directory copied');
}

// 复制standard_fonts目录
copyDir('node_modules/pdfjs-dist/standard_fonts', 'public/standard_fonts');
if (fs.existsSync('public/standard_fonts')) {
  console.log('[postinstall] ✓ standard_fonts directory copied');
}

console.log('[postinstall] Finished!');

