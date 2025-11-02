# PDF 查看器配置说明

## 本地 Worker 配置（支持 HTTP 和 HTTPS）

### 配置完成 ✅

PDF.js worker 文件已配置为本地加载，**完全支持 HTTP 协议**（开发环境）和 HTTPS 协议（生产环境）。

### 文件位置

```
public/
  └── pdf.worker.min.mjs  (1.0MB)

build/
  └── pdf.worker.min.mjs  (构建时自动包含)
```

### Worker 配置

**文件**: `src/components/PDFViewer.tsx`

```typescript
// 使用本地 worker（支持 http 和 https）
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
```

### 自动化维护

**文件**: `package.json`

```json
{
  "scripts": {
    "postinstall": "node -e \"require('fs').copyFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'public/pdf.worker.min.mjs')\""
  }
}
```

每次运行 `npm install` 后会自动复制最新的 worker 文件。

---

## CORS 代理配置

### 后端代理

**文件**: `server.js`

```javascript
// PDF 文件代理接口（绕过 CORS）
app.get('/api/pdf/proxy', async (req, res) => {
  const pdfUrl = decodeURIComponent(req.query.url || '');
  // 使用 axios 获取 PDF 并转发
  // ...
});
```

### 前端使用

**文件**: `src/components/PDFViewer.tsx`

- 默认启用代理（`useProxy={true}`）
- 自动将原始 URL 转换为代理 URL
- 支持 HTTP 和 HTTPS 源

```typescript
// 原始 URL
https://example.com/document.pdf

// 自动转换为代理 URL
/api/pdf/proxy?url=https%3A%2F%2Fexample.com%2Fdocument.pdf
```

---

## 问题排查

### 常见错误

#### 1. Worker 404 错误

**症状**: `GET /pdf.worker.min.mjs net::ERR_ABORTED 404`

**解决**:
```bash
# 重新复制 worker 文件
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs

# 或运行 postinstall
npm run postinstall
```

#### 2. CORS 错误

**症状**: `Access to fetch at 'https://...' has been blocked by CORS policy`

**解决**: 确保使用代理（`useProxy={true}`，默认已启用）

#### 3. sendWithPromise 错误

**症状**: `Cannot read properties of null (reading 'sendWithPromise')`

**原因**: 多个 PDF 同时加载导致 worker 冲突

**解决**: 
- 每个 PDF 测试用例分开（已优化）
- Document 组件添加了 `key` prop（已实现）

---

## HTTP vs HTTPS

### HTTP（开发环境）✅ 完全支持

```
本地开发: http://localhost:3000
Worker: /pdf.worker.min.mjs (本地文件)
代理: /api/pdf/proxy?url=... (同源)
```

**无需 HTTPS**，所有资源都是同源或本地文件。

### HTTPS（生产环境）✅ 完全支持

```
生产环境: https://your-domain.com
Worker: /pdf.worker.min.mjs (本地文件)
代理: /api/pdf/proxy?url=... (同源)
```

---

## 测试用例

### 基础测试

```markdown
## 测试 PDF 查看器

\`\`\`pdf
https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
\`\`\`
```

### 功能说明

- ✅ 缩放：按钮 / Ctrl+滚轮 / 双指捏合（移动端）
- ✅ 平移：拖拽 / 单指滑动（移动端）
- ✅ 页面导航：上一页/下一页按钮
- ✅ 移动端适配：响应式布局和触摸手势
- ✅ 暗色模式：根据 `isDarkMode` prop 自动切换

---

## 部署清单

### 生产环境部署前检查

- [ ] `public/pdf.worker.min.mjs` 文件存在
- [ ] `npm run build` 成功
- [ ] `build/pdf.worker.min.mjs` 已包含
- [ ] 后端代理接口 `/api/pdf/proxy` 正常工作
- [ ] 测试页面能正常显示 PDF

### 验证命令

```bash
# 检查 worker 文件
ls -lh public/pdf.worker.min.mjs
ls -lh build/pdf.worker.min.mjs

# 构建
npm run build

# 测试后端代理（需要后端服务运行）
curl "http://localhost:3000/api/pdf/proxy?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" -I
```

---

## 性能优化

### Worker 文件大小

- 原始大小: ~1.0 MB
- Gzip 后: ~300 KB
- 首次加载后缓存（Cache-Control: public, max-age=3600）

### 代理优化

- 超时: 30 秒
- 最大文件大小: 50 MB
- 缓存: 1 小时

---

## 版本信息

- **pdfjs-dist**: 5.4.296
- **react-pdf**: 10.x
- **Worker**: pdf.worker.min.mjs (本地)
- **cmaps**: 本地目录（1.7MB）
- **standard_fonts**: 本地目录（804KB）
- **代理**: Node.js + axios

---

## PDF.js 资源文件说明

### 1. `pdf.worker.min.mjs` (1.0MB)

**作用**: PDF.js Worker 文件，用于在后台线程处理 PDF 解析

**位置**: `public/pdf.worker.min.mjs`

**配置**:
```typescript
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
```

---

### 2. `cmaps/` 目录 (1.7MB)

**作用**: 字符映射表（CMap），用于支持中日韩等多字节字符编码

**位置**: `public/cmaps/`

**内容**: 包含 100+ 个字符映射文件（.bcmap 格式）

**示例文件**:
```
78-EUC-H.bcmap          # 日文 EUC-JP 编码
78-RKSJ-H.bcmap         # 日文 Shift-JIS 编码
GB1-H.bcmap             # 中文 GB2312 编码
GBK-EUC-H.bcmap         # 中文 GBK 编码
KSC-EUC-H.bcmap         # 韩文编码
... (共约 100+ 个文件)
```

**用途**:
- ✅ **必需**: 如果 PDF 包含中文、日文、韩文文字
- ❌ **不需要**: 纯英文 PDF（虽然建议保留）

**如果不使用**:
- 中日韩文字可能显示为乱码或方块
- 某些 PDF 可能无法正确渲染

**配置**:
```typescript
options={{
  cMapUrl: '/cmaps/',
  cMapPacked: true,
}}
```

---

### 3. `standard_fonts/` 目录 (804KB)

**作用**: 提供 PDF 中常用的 14 种标准字体

**位置**: `public/standard_fonts/`

**内容**: 包含标准字体文件（.pfb 和 .ttf 格式）

**示例文件**:
```
FoxitFixed.pfb           # 等宽字体（Regular）
FoxitFixedBold.pfb       # 等宽字体（加粗）
FoxitSerif.pfb           # 衬线字体（Regular）
FoxitSerifBold.pfb       # 衬线字体（加粗）
FoxitSymbol.pfb          # 符号字体
LiberationSans-Regular.ttf  # 无衬线字体（Liberation Sans）
... (共 14 个字体文件)
```

**标准字体列表**:
- Times (Roman, Bold, Italic, BoldItalic)
- Helvetica (Regular, Bold, Oblique, BoldOblique)
- Courier (Regular, Bold, Oblique, BoldOblique)
- Symbol
- ZapfDingbats

**用途**:
- ✅ **建议**: 所有 PDF（某些 PDF 使用标准字体）
- ❌ **可能不需要**: PDF 已嵌入所有字体

**如果不使用**:
- 使用标准字体的文本可能无法正确渲染
- 可能回退到系统默认字体（样式可能不匹配）

**配置**:
```typescript
options={{
  standardFontDataUrl: '/standard_fonts/',
}}
```

---

## 资源文件需求总结

| PDF 内容类型 | Worker | cmaps | standard_fonts |
|------------|--------|-------|---------------|
| **纯英文 PDF** | ✅ 必需 | ❌ 不需要 | ⚠️ 建议 |
| **包含中文的 PDF** | ✅ 必需 | ✅ **必需** | ⚠️ 建议 |
| **包含日文/韩文的 PDF** | ✅ 必需 | ✅ **必需** | ⚠️ 建议 |
| **嵌入所有字体的 PDF** | ✅ 必需 | ⚠️ 可能不需要 | ⚠️ 可能不需要 |

**最佳实践**: 建议保留所有资源文件，确保 PDF 在各种情况下都能正确渲染。

---

## 自动化维护

所有资源文件通过 `postinstall` 脚本自动维护：

```json
{
  "scripts": {
    "postinstall": "自动复制 worker、cmaps、standard_fonts 到 public 目录"
  }
}
```

每次运行 `npm install` 后，脚本会：
1. 复制 `pdf.worker.min.mjs` 到 `public/`
2. 递归复制 `cmaps/` 目录到 `public/cmaps/`
3. 递归复制 `standard_fonts/` 目录到 `public/standard_fonts/`

---

## 联系和支持

如有问题，请检查：
1. 浏览器控制台日志
2. 后端服务日志（`npm run server:logs`）
3. Network 面板（查看请求和响应）
4. 确认资源文件是否已正确复制（检查 `public/` 和 `build/` 目录）

最后更新: 2025-11-02

